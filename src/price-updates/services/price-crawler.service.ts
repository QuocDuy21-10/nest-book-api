import { Inject, Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { InjectModel } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import type { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { Book, BookDocument } from 'src/books/schemas/book.schema';
import { ClientKafka } from '@nestjs/microservices';
import {
  ACCEPT,
  KAFKA_SERVICE,
  PRICE_UPDATE,
  TIKI_DETAIL_API,
  TIKI_ORIGIN_BASE,
  USER_AGENT,
} from 'src/common/constants';
import {
  PriceUpdateMessage,
  PriceUpdateStatus,
} from '../interfaces/price-update.interface';

@Injectable()
export class PriceCrawlerService {
  private readonly logger = new Logger(PriceCrawlerService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly REQUEST_TIMEOUT = 10000;
  private readonly MAX_RETRIES = 2;

  constructor(
    @InjectModel(Book.name)
    private bookModel: SoftDeleteModel<BookDocument>,
    @Inject(KAFKA_SERVICE)
    private kafkaClient: ClientKafka,
  ) {
    this.axiosInstance = axios.create({
      headers: {
        'User-Agent': USER_AGENT,
        Accept: ACCEPT,
        'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
        Referer: TIKI_ORIGIN_BASE,
        Origin: TIKI_ORIGIN_BASE,
      },
      timeout: this.REQUEST_TIMEOUT,
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
    });
  }

  async crawlPrice(
    bookId: string,
    externalId: string,
    source: string,
    jobId: string,
    retryCount: number = 0,
  ): Promise<void> {
    try {
      this.logger.debug(
        `[${jobId}] Crawling price for book ${bookId} (externalId: ${externalId})`,
      );

      // Fetch price từ Tiki API
      const priceData = await this.fetchPrice(externalId, retryCount);

      if (!priceData) {
        await this.emitPriceUpdateFailed(
          bookId,
          externalId,
          source,
          jobId,
          'Failed to fetch price data',
        );
        return;
      }

      // Emit success message với giá mới
      await this.emitPriceUpdateSuccess(
        bookId,
        externalId,
        source,
        jobId,
        priceData.promotionalPrice,
        priceData.originalPrice,
      );

      this.logger.debug(
        `[${jobId}] Successfully crawled price for book ${bookId}: ${priceData.promotionalPrice}`,
      );
    } catch (error) {
      this.logger.error(
        `[${jobId}] Error crawling price for book ${bookId}: ${error.message}`,
        error.stack,
      );

      await this.emitPriceUpdateFailed(
        bookId,
        externalId,
        source,
        jobId,
        error.message,
      );
    }
  }

  private async fetchPrice(
    externalId: string,
    retryCount: number = 0,
  ): Promise<{ promotionalPrice: number; originalPrice: number } | null> {
    try {
      const productId = parseInt(externalId, 10);

      if (isNaN(productId)) {
        throw new Error(`Invalid externalId: ${externalId}`);
      }

      const params: any = {
        platform: 'web',
        version: '3',
      };

      const response = await this.axiosInstance.get(
        `${TIKI_DETAIL_API}/${productId}`,
        { params },
      );

      if (!response.data) {
        this.logger.warn(`No data received for product ${productId}`);
        return null;
      }

      return {
        promotionalPrice: response.data.price || null,
        originalPrice:
          response.data.original_price || response.data.price || null,
      };

      // return {
      //   promotionalPrice: 100000,
      //   originalPrice: 200000,
      // };
    } catch (error) {
      if (retryCount < this.MAX_RETRIES && this.isRetryableError(error)) {
        this.logger.warn(
          `Retrying price fetch for ${externalId} (attempt ${retryCount + 1}/${this.MAX_RETRIES})`,
        );
        await this.delay(2000 * (retryCount + 1));
        return this.fetchPrice(externalId, retryCount + 1);
      }

      this.logger.error(
        `Failed to fetch price for ${externalId}: ${error.message}`,
      );
      return null;
    }
  }

  private async emitPriceUpdateSuccess(
    bookId: string,
    externalId: string,
    source: string,
    jobId: string,
    newPrice: number,
    originalPrice: number,
  ): Promise<void> {
    const message: PriceUpdateMessage = {
      bookId,
      externalId,
      source,
      jobId,
      newPrice,
      originalPrice,
      status: PriceUpdateStatus.SUCCESS,
      timestamp: new Date().toISOString(),
    };

    this.kafkaClient.emit(`${PRICE_UPDATE}.result`, message);
  }

  private async emitPriceUpdateFailed(
    bookId: string,
    externalId: string,
    source: string,
    jobId: string,
    errorMessage: string,
  ): Promise<void> {
    const message: PriceUpdateMessage = {
      bookId,
      externalId,
      source,
      jobId,
      newPrice: 0,
      originalPrice: 0,
      status: PriceUpdateStatus.FAILED,
      errorMessage,
      timestamp: new Date().toISOString(),
    };

    this.kafkaClient.emit(`${PRICE_UPDATE}.result`, message);
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
