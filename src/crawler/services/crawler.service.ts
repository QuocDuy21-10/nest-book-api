import { JobsService } from '../../jobs/jobs.service';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import axios, { AxiosInstance } from 'axios';
import type { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { Book, BookDocument } from 'src/books/schemas/book.schema';
import { TikiProductListItem } from '../interfaces/tiki-product.interface';
import {
  CRAWL_PRODUCT_DETAIL,
  CRAWL_PRODUCT_LIST,
  JOB_TYPE,
  KAFKA_SERVICE,
} from 'src/common/constants';
import { ClientKafka } from '@nestjs/microservices';
import mongoose from 'mongoose';

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly TIKI_API_BASE =
    'https://tiki.vn/api/personalish/v1/blocks/listings';
  private readonly TIKI_CATEGORY = '839'; // Literature category
  private readonly BOOKS_PER_PAGE = 40;
  private readonly MAX_PAGES = 3;
  private readonly SOURCE_NAME = 'Tiki';
  private readonly BULK_BATCH_SIZE = 100;

  constructor(
    @InjectModel(Book.name) private bookModel: SoftDeleteModel<BookDocument>,
    private jobService: JobsService,
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

    // Emit event to Kafka for list crawling
    this.kafkaClient.emit(CRAWL_PRODUCT_LIST, {
      jobId,
      type: JOB_TYPE,
      timestamp: new Date().toISOString(),
    });

    return { jobId };
  }

  async crawlTikiBooks(jobId: string): Promise<void> {
    try {
      await this.jobService.startJob(jobId);

      let totalProducts = 0;
      let newProducts = 0;
      let updatedProducts = 0;
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

            const { newCount, updatedCount, errorCount } =
              await this.saveProductOverview(batch, jobId);

            newProducts += newCount;
            updatedProducts += updatedCount;
            errors += errorCount;
            totalProducts += batch.length;

            // Update job progress
            await this.jobService.updateJobProgress(
              jobId,
              totalProducts,
              this.MAX_PAGES * this.BOOKS_PER_PAGE,
              newProducts,
              updatedProducts,
              errors,
            );

            this.logger.debug(
              `[${jobId}] Batch processed: New=${newCount}, Updated=${updatedCount}, Errors=${errorCount}`,
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

      await this.jobService.completeJob(
        jobId,
        newProducts,
        updatedProducts,
        errors,
      );
      this.logger.log(
        `[${jobId}] List crawling completed: Total=${totalProducts}, New=${newProducts}, Updated=${updatedProducts}, Errors=${errors}`,
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

  // Save basic product WITHOUT authors (API list)
  private async saveProductOverview(
    products: TikiProductListItem[],
    jobId: string,
  ): Promise<{
    newCount: number;
    updatedCount: number;
    errorCount: number;
  }> {
    try {
      const bulkOps = products
        .map((product) => {
          try {
            // Only save basic overview data - NO authors yet
            const bookData = {
              title: product.name,
              description: '', // Empty initially, filled in detail crawl
              externalId: product.id.toString(),
              source: this.SOURCE_NAME,
              originalPrice: product.original_price || product.list_price || 0,
              promotionalPrice: product.price || 0,
              quantitySold: product.quantity_sold?.value || 0,
              bookImage: product.thumbnail_url || null,
              isFromCrawler: true,
              isPremium: false,
              needsDetailCrawl: true, // Flag for detail crawling
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
                    detailCrawlAttempts: 0,
                    authors: [],
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
        .filter((op) => op !== null);

      if (bulkOps.length === 0) {
        return { newCount: 0, updatedCount: 0, errorCount: products.length };
      }

      const result = await this.bookModel.bulkWrite(bulkOps);

      const newCount = result.upsertedCount;
      const updatedCount = result.modifiedCount;
      const errorCount = products.length - bulkOps.length;

      // Emit detail crawl tasks for each product
      products.forEach((product) => {
        this.emitDetailCrawlTask(product.id, jobId);
      });

      this.logger.debug(
        `[${jobId}] Overview saved: ${bulkOps.length} products (New: ${newCount}, Updated: ${updatedCount}). Emitted ${products.length} detail crawl tasks.`,
      );

      return { newCount, updatedCount, errorCount };
    } catch (error) {
      this.logger.error(
        `[${jobId}] Batch processing failed: ${error.message}`,
        error.stack,
      );

      return { newCount: 0, updatedCount: 0, errorCount: products.length };
    }
  }

  // Emit detail crawl task
  private emitDetailCrawlTask(productId: number, jobId: string): void {
    this.kafkaClient.emit(CRAWL_PRODUCT_DETAIL, {
      productId,
      jobId,
      source: this.SOURCE_NAME,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
