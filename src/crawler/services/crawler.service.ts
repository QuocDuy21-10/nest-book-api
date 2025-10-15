import { JobsService } from '../../jobs/jobs.service';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import axios, { AxiosInstance } from 'axios';
import type { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { Book, BookDocument } from 'src/books/schemas/book.schema';
import { TikiProductListItem } from '../interfaces/tiki-product.interface';
import { JOB_TYPE, KAFKA_SERVICE } from 'src/common/constants';
import { ClientKafka } from '@nestjs/microservices';
import mongoose from 'mongoose';
import { ProductDetailService } from './product-detail.service';

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly TIKI_API_BASE =
    'https://tiki.vn/api/personalish/v1/blocks/listings';
  private readonly TIKI_CATEGORY = '839'; // Literature category
  private readonly BOOKS_PER_PAGE = 40;
  private readonly MAX_PAGES = 25;
  private readonly SOURCE_NAME = 'Tiki';
  private readonly BULK_BATCH_SIZE = 100;
  private readonly DETAIL_BATCH_SIZE = 40; // For concurrent detail requests

  constructor(
    @InjectModel(Book.name) private bookModel: SoftDeleteModel<BookDocument>,
    private jobService: JobsService,
    private bookDetailService: ProductDetailService,
    @Inject(KAFKA_SERVICE) private kafkaClient: ClientKafka,
  ) {
    this.axiosInstance = axios.create({
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      },
    });
  }

  async triggerCrawl(): Promise<{ jobId: mongoose.Types.ObjectId }> {
    const jobId = await this.jobService.createJob(JOB_TYPE);
    this.logger.log(`Crawler job triggered: ${jobId}`);

    // Emit event to Kafka
    this.kafkaClient.emit('crawl-tasks', {
      jobId,
      type: JOB_TYPE,
      timestamp: new Date().toISOString(),
    });
    return {
      jobId,
    };
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
              await this.processBatchWithDetails(batch, jobId);

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

  private async fetchTikiPage(page: number): Promise<TikiProductListItem[]> {
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

  private async processBatchWithDetails(
    products: TikiProductListItem[],
    jobId: string,
  ): Promise<{
    newCount: number;
    duplicateCount: number;
    errorCount: number;
  }> {
    try {
      const productsForDetail = products.map((product) => ({
        id: product.id,
      }));

      this.logger.debug(
        `[${jobId}] Fetching details for ${productsForDetail.length} products`,
      );

      // Fetch book details
      const detailsMap = await this.bookDetailService.fetchBookDetails(
        productsForDetail,
        this.DETAIL_BATCH_SIZE,
        300,
      );
      const bulkOps = products
        .map((product) => {
          try {
            const detail = detailsMap.get(product.id);

            // Merge basic info with detailed info
            const bookData = {
              title: detail?.name || product.name,
              description:
                detail?.description || detail?.short_description || '',
              externalId: product.id.toString(),
              source: this.SOURCE_NAME,
              originalPrice:
                detail?.original_price ||
                product.original_price ||
                product.list_price ||
                0,
              promotionalPrice: detail?.price || product.price || 0,
              quantitySold:
                detail?.all_time_quantity_sold ||
                detail?.quantity_sold?.value ||
                product.quantity_sold?.value ||
                0,
              bookImage: detail?.thumbnail_url || product.thumbnail_url || null,
              authors: detail?.authors || [],
              isFromCrawler: true,
              isPremium: false,
              updatedAt: new Date(),
            };

            return {
              updateOne: {
                filter: {
                  externalId: product.id.toString(),
                  source: this.SOURCE_NAME,
                },
                update: {
                  $set: bookData,
                  $setOnInsert: {
                    createdAt: new Date(),
                  },
                },
                upsert: true,
              },
            };
          } catch (error) {
            this.logger.error(
              `[${jobId}] Error preparing product ${product.id}: ${error.message}`,
            );
            return null;
          }
        })
        .filter((op) => op !== null); // Remove failed operations

      // Execute bulk operations and analyze results
      if (bulkOps.length === 0) {
        return { newCount: 0, duplicateCount: 0, errorCount: products.length };
      }

      const result = await this.bookModel.bulkWrite(bulkOps);

      const newCount = result.upsertedCount;
      const duplicateCount = result.modifiedCount;
      const errorCount = products.length - bulkOps.length;

      this.logger.debug(
        `[${jobId}] Bulk write completed: ${bulkOps.length} operations (Inserted: ${newCount}, Updated: ${duplicateCount})`,
      );

      return { newCount, duplicateCount, errorCount };
    } catch (error) {
      this.logger.error(
        `[${jobId}] Batch processing failed: ${error.message}`,
        error.stack,
      );

      return { newCount: 0, duplicateCount: 0, errorCount: products.length };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
