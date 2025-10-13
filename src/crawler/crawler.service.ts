import { JobsService } from './../jobs/jobs.service';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import axios, { AxiosInstance } from 'axios';
import type { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { Book, BookDocument } from 'src/books/schemas/book.schema';
import { TikiProduct } from './interfaces/tiki-product.interface';
import { KAFKA_SERVICE } from 'src/common/constants';
import { ClientKafka } from '@nestjs/microservices';
import mongoose from 'mongoose';
import { log } from 'console';

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly TIKI_API_BASE =
    'https://tiki.vn/api/personalish/v1/blocks/listings';
  private readonly TIKI_CATEGORY = '839'; // Literature category
  private readonly BOOKS_PER_PAGE = 40;
  private readonly MAX_PAGES = 25;
  private readonly BULK_BATCH_SIZE = 100;

  constructor(
    @InjectModel(Book.name) private bookModel: SoftDeleteModel<BookDocument>,
    private jobService: JobsService,
    @Inject(KAFKA_SERVICE) private kafkaClient: ClientKafka,
  ) {
    this.axiosInstance = axios.create({
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });
  }

  async triggerCrawl(): Promise<{ jobId: mongoose.Types.ObjectId }> {
    const jobId = await this.jobService.createJob('CRAWL_TIKI_BOOKS');
    this.logger.log(`Crawler job triggered: ${jobId}`);

    // Emit event to Kafka
    this.kafkaClient.emit('crawl-tasks', {
      jobId,
      type: 'CRAWL_TIKI_BOOKS',
      timestamp: new Date().toISOString(),
    });

    return { jobId };
  }

  async crawlTikiBooks(jobId: string): Promise<void> {
    try {
      await this.jobService.startJob(jobId);

      let totalBooks = 0;
      let newBooks = 0;
      let duplicates = 0;
      let errors = 0;

      for (let page = 1; page <= this.MAX_PAGES; page++) {
        this.logger.log(`[${jobId}] Crawling page ${page}/${this.MAX_PAGES}`);

        try {
          const products = await this.fetchTikiPage(page);

          if (!products || products.length === 0) {
            this.logger.log(
              `[${jobId}] No more products found at page ${page}`,
            );
            break;
          }

          // Process products in batches
          for (let i = 0; i < products.length; i += this.BULK_BATCH_SIZE) {
            const batch = products.slice(i, i + this.BULK_BATCH_SIZE);

            const { newCount, duplicateCount, errorCount } =
              await this.processBatch(batch);

            newBooks += newCount;
            duplicates += duplicateCount;
            errors += errorCount;
            totalBooks += batch.length;

            // Update job progress
            await this.jobService.updateJobProgress(
              jobId,
              totalBooks,
              this.MAX_PAGES * this.BOOKS_PER_PAGE,
              newBooks,
              duplicates,
              errors,
            );

            this.logger.debug(
              `[${jobId}] Batch processed: New=${newCount}, Duplicates=${duplicateCount}, Errors=${errorCount}`,
            );
          }

          await this.delay(500);
        } catch (error) {
          this.logger.error(
            `[${jobId}] Error crawling page ${page}: ${error.message}`,
            error.stack,
          );
          errors++;
          continue;
        }
      }

      await this.jobService.completeJob(jobId, newBooks, duplicates, errors);
      this.logger.log(
        `[${jobId}] Crawling completed: Total=${totalBooks}, New=${newBooks}, Duplicates=${duplicates}, Errors=${errors}`,
      );
    } catch (error) {
      await this.jobService.failJob(jobId, error.message);
      this.logger.error(
        `[${jobId}] Crawling failed: ${error.message}`,
        error.stack,
      );
    }
  }

  private async fetchTikiPage(page: number): Promise<TikiProduct[]> {
    try {
      const params = {
        limit: this.BOOKS_PER_PAGE,
        include: 'advertisement',
        aggregations: '2',
        version: 'home-persionalized',
        category: this.TIKI_CATEGORY,
        page: page,
        urlKey: 'sach-van-hoc',
      };

      const response = await this.axiosInstance.get(this.TIKI_API_BASE, {
        params,
      });

      if (response.data?.data?.length > 0) {
        return response.data.data;
      }

      return [];
    } catch (error) {
      this.logger.error(
        `Failed to fetch page ${page}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async processBatch(products: TikiProduct[]): Promise<{
    newCount: number;
    duplicateCount: number;
    errorCount: number;
  }> {
    const bulkOps: any[] = [];
    let newCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    for (const product of products) {
      try {
        // Check if product exists
        const existingBook = await this.bookModel.findOne({
          externalId: product.id.toString(),
          source: 'Tiki',
        });

        if (existingBook) {
          duplicateCount++;
        } else {
          // Prepare upsert operation
          bulkOps.push({
            updateOne: {
              filter: {
                externalId: product.id.toString(),
                source: 'Tiki',
              },
              update: {
                $set: {
                  title: product.name,
                  description: product.name,
                  externalId: product.id.toString(),
                  source: 'Tiki',
                  originalPrice:
                    product.original_price || product.list_price || 0,
                  promotionalPrice: product.price || 0,
                  quantitySold: product.quantity_sold?.value || 0,
                  bookImage: product.thumbnail_url || null,
                  isFromCrawler: true,
                  isPremium: false,
                  authors: [],
                  updatedAt: new Date(),
                },
                $setOnInsert: {
                  createdAt: new Date(),
                },
              },
              upsert: true,
            },
          });
          newCount++;
          // this.logger.debug(`Processed product ${newCount}: ${product.id}`);
        }
      } catch (error) {
        this.logger.error(
          `Error processing product ${product.id}: ${error.message}`,
        );
        errorCount++;
      }
    }

    // Execute bulk operations if any
    if (bulkOps.length > 0) {
      try {
        await this.bookModel.bulkWrite(bulkOps);
        this.logger.debug(`Bulk write completed: ${bulkOps.length} operations`);
      } catch (error) {
        this.logger.error(`Bulk write failed: ${error.message}`, error.stack);
        errorCount += bulkOps.length; // Count all as errors if bulk write fails
      }
    }

    return { newCount, duplicateCount, errorCount };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
