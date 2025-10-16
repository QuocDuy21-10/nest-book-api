import { Inject, Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  TikiAuthorData,
  TikiProductDetail,
} from '../interfaces/tiki-product.interface';
import { InjectModel } from '@nestjs/mongoose';
import { Book, BookDocument } from 'src/books/schemas/book.schema';
import type { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { KAFKA_SERVICE } from 'src/common/constants';
import { ClientKafka } from '@nestjs/microservices';
import { AuthorsService } from 'src/authors/authors.service';
import mongoose from 'mongoose';

@Injectable()
export class ProductDetailCrawlerService {
  private readonly logger = new Logger(ProductDetailCrawlerService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly TIKI_DETAIL_API = 'https://tiki.vn/api/v2/products';
  private readonly REQUEST_TIMEOUT = 10000;
  private readonly MAX_RETRIES = 2;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY_MS = 5000;

  constructor(
    @InjectModel(Book.name) private bookModel: SoftDeleteModel<BookDocument>,
    @Inject(KAFKA_SERVICE) private kafkaClient: ClientKafka,
    private authorsService: AuthorsService,
  ) {
    this.axiosInstance = axios.create({
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
        Referer: 'https://tiki.vn/',
        Origin: 'https://tiki.vn',
      },
      timeout: this.REQUEST_TIMEOUT,
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
    });
  }

  async fetchBookDetail(
    productId: number,
    retryCount = 0,
  ): Promise<TikiProductDetail | null> {
    try {
      const params: any = {
        platform: 'web',
        version: '3',
      };

      const response = await this.axiosInstance.get(
        `${this.TIKI_DETAIL_API}/${productId}`,
        { params },
      );

      if (!response.data) {
        this.logger.warn(`No data received for product ${productId}`);
        return null;
      }

      return this.parseBookDetail(response.data);
    } catch (error) {
      if (retryCount < this.MAX_RETRIES && this.isRetryableError(error)) {
        this.logger.warn(
          `Retrying product ${productId} (attempt ${retryCount + 1}/${this.MAX_RETRIES})`,
        );
        await this.delay(2000 * (retryCount + 1));
        return this.fetchBookDetail(productId, retryCount + 1);
      }

      this.logFetchError(error, productId);
      return null;
    }
  }

  async crawlProductDetail(
    productId: number,
    jobId: string,
    source: string,
    retryCount: number = 0,
  ): Promise<void> {
    try {
      this.logger.debug(
        `[${jobId}] Starting detail crawl for product ${productId} (attempt ${retryCount + 1})`,
      );

      // Fetch detailed information
      const detail = await this.fetchBookDetail(productId);

      if (!detail) {
        await this.handleDetailCrawlFailure(
          productId,
          jobId,
          source,
          retryCount,
          'No detail data returned',
        );
        return;
      }

      let authorIds: mongoose.Types.ObjectId[] = [];
      if (
        detail.authors &&
        Array.isArray(detail.authors) &&
        detail.authors.length > 0
      ) {
        try {
          // Filter out invalid author data
          const validAuthors = detail.authors.filter(
            (author) => author && author.id && author.name,
          );

          console.log('validAuthors: ', validAuthors);

          if (validAuthors.length > 0) {
            // Find or create authors
            authorIds =
              await this.authorsService.findOrCreateBulkFromTiki(validAuthors);

            console.log('authorIds: ', authorIds);

            this.logger.debug(
              `[${jobId}] Processed ${authorIds.length} authors for product ${productId}`,
            );
          }
        } catch (error) {
          this.logger.error(
            `[${jobId}] Failed to process authors for product ${productId}: ${error.message}`,
          );
        }
      }

      // Update the book with detailed information
      await this.updateBookWithDetails(
        productId,
        source,
        detail,
        authorIds,
        jobId,
      );

      this.logger.debug(
        `[${jobId}] Successfully crawled detail for product ${productId}`,
      );
    } catch (error) {
      this.logger.error(
        `[${jobId}] Error crawling detail for product ${productId}: ${error.message}`,
        error.stack,
      );

      await this.handleDetailCrawlFailure(
        productId,
        jobId,
        source,
        retryCount,
        error.message,
      );
    }
  }

  // Update the book with detailed information
  private async updateBookWithDetails(
    productId: number,
    source: string,
    detail: TikiProductDetail,
    authorIds: mongoose.Types.ObjectId[],
    jobId: string,
  ): Promise<void> {
    try {
      const updateData: any = {
        description: detail.description || '',
        originalPrice: detail.original_price,
        promotionalPrice: detail.promotional_price,
        quantitySold: detail.quantity_sold || 0,
        bookImage: detail.thumbnail_url || null,
        needsDetailCrawl: false,
        lastDetailCrawlAt: new Date(),
        detailCrawlSuccess: true,
      };

      // Only update authors if we have valid ObjectIds
      if (authorIds && authorIds.length > 0) {
        updateData.authors = authorIds;
      }

      const result = await this.bookModel.updateOne(
        {
          externalId: productId.toString(),
          source: source,
        },
        {
          $set: updateData,
          $inc: { detailCrawlAttempts: 1 },
        },
      );

      if (result.matchedCount === 0) {
        this.logger.warn(
          `[${jobId}] Book not found for detail update: ${productId}`,
        );
      } else {
        this.logger.debug(
          `[${jobId}] Updated book ${productId} with ${authorIds.length} author references`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[${jobId}] Failed to update book ${productId} with details: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async handleDetailCrawlFailure(
    productId: number,
    jobId: string,
    source: string,
    retryCount: number,
    errorMessage: string,
  ): Promise<void> {
    const nextRetryCount = retryCount + 1;

    await this.bookModel.updateOne(
      {
        externalId: productId.toString(),
        source: source,
      },
      {
        $set: {
          lastDetailCrawlAt: new Date(),
          lastDetailCrawlError: errorMessage,
          detailCrawlSuccess: false,
        },
        $inc: { detailCrawlAttempts: 1 },
      },
    );

    if (nextRetryCount < this.MAX_RETRY_ATTEMPTS) {
      this.logger.warn(
        `[${jobId}] Detail crawl failed for product ${productId}. Scheduling retry ${nextRetryCount}/${this.MAX_RETRY_ATTEMPTS}`,
      );

      setTimeout(() => {
        this.emitDetailCrawlRetry(productId, jobId, source, nextRetryCount);
      }, this.RETRY_DELAY_MS * nextRetryCount);
    } else {
      this.logger.error(
        `[${jobId}] Detail crawl permanently failed for product ${productId} after ${this.MAX_RETRY_ATTEMPTS} attempts`,
      );

      await this.bookModel.updateOne(
        {
          externalId: productId.toString(),
          source: source,
        },
        {
          $set: {
            needsDetailCrawl: false,
            detailCrawlPermanentlyFailed: true,
          },
        },
      );
    }
  }

  private emitDetailCrawlRetry(
    productId: number,
    jobId: string,
    source: string,
    retryCount: number,
  ): void {
    try {
      this.kafkaClient.emit('crawl-product-detail', {
        productId,
        jobId,
        source,
        timestamp: new Date().toISOString(),
        retryCount,
      });

      this.logger.debug(
        `[${jobId}] Emitted retry for product ${productId} (attempt ${retryCount + 1})`,
      );
    } catch (error) {
      this.logger.error(
        `[${jobId}] Failed to emit retry for product ${productId}: ${error.message}`,
      );
    }
  }

  async recrawlMissingDetails(limit: number = 100): Promise<number> {
    try {
      this.logger.log(`Starting batch re-crawl for up to ${limit} products`);

      const productsNeedingDetails = await this.bookModel
        .find({
          needsDetailCrawl: true,
          detailCrawlPermanentlyFailed: { $ne: true },
          $or: [
            { detailCrawlAttempts: { $lt: this.MAX_RETRY_ATTEMPTS } },
            { detailCrawlAttempts: { $exists: false } },
          ],
        })
        .limit(limit)
        .select('externalId source')
        .lean();

      this.logger.log(
        `Found ${productsNeedingDetails.length} products needing detail crawl`,
      );

      let emittedCount = 0;
      for (const product of productsNeedingDetails) {
        try {
          const externalId = product.externalId;
          if (!externalId) {
            this.logger.warn(
              `Skipping product with missing externalId: ${JSON.stringify(product)}`,
            );
            continue;
          }

          const productId = parseInt(externalId, 10);
          if (Number.isNaN(productId)) {
            this.logger.warn(
              `Skipping product with invalid externalId: ${externalId}`,
            );
            continue;
          }

          this.kafkaClient.emit('crawl-product-detail', {
            productId,
            jobId: 'batch-recrawl',
            source: product.source,
            timestamp: new Date().toISOString(),
            retryCount: 0,
          });
          emittedCount++;
        } catch (error) {
          this.logger.error(
            `Failed to emit detail crawl for ${product.externalId}: ${error.message}`,
          );
        }
      }

      this.logger.log(
        `Batch re-crawl completed: emitted ${emittedCount}/${productsNeedingDetails.length} tasks`,
      );

      return emittedCount;
    } catch (error) {
      this.logger.error(`Batch re-crawl failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  private parseBookDetail(data: any): TikiProductDetail {
    const authors = this.extractAuthors(data);

    return {
      id: data?.id,
      name: data?.name || '',
      description: data?.description || data?.short_description || '',
      original_price: data?.original_price,
      promotional_price: data?.price,
      quantity_sold:
        data?.quantity_sold?.value || data?.all_time_quantity_sold || 0,
      thumbnail_url: data?.thumbnail_url || '',
      authors,
    };
  }

  private extractAuthors(data: any): TikiAuthorData[] {
    const authors: TikiAuthorData[] = [];

    if (Array.isArray(data.authors)) {
      data.authors.forEach((author: any) => {
        // Validate author data
        if (author && author.id && author.name) {
          authors.push({
            id: author.id,
            name: author.name,
            slug: author.slug || '',
          });
        }
      });
    }

    return authors;
  }

  private logFetchError(error: any, productId: number): void {
    if (
      error.code === 'ERR_TOO_MANY_REDIRECTS' ||
      error.message?.includes('redirect')
    ) {
      this.logger.warn(
        `Product ${productId} has redirect issue (possibly blocked/unavailable)`,
      );
    } else if (error.response?.status === 404) {
      this.logger.warn(`Product ${productId} not found (404)`);
    } else if (error.response?.status === 403) {
      this.logger.warn(`Product ${productId} access forbidden (403)`);
    } else {
      this.logger.error(
        `Failed to fetch detail for product ${productId}: ${error.message}`,
      );
    }
  }

  private isRetryableError(error: any): boolean {
    const retryableCodes = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
    ];

    if (retryableCodes.includes(error.code)) {
      return true;
    }

    if (error.response) {
      const retryableStatuses = [408, 429, 500, 502, 503, 504];
      return retryableStatuses.includes(error.response.status);
    }

    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
