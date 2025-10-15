import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { TikiProductDetail } from '../interfaces/tiki-product.interface';

@Injectable()
export class ProductDetailService {
  private readonly logger = new Logger(ProductDetailService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly TIKI_DETAIL_API = 'https://tiki.vn/api/v2/products';
  private readonly REQUEST_TIMEOUT = 10000;
  private readonly MAX_RETRIES = 2;

  constructor() {
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
      maxRedirects: 0, // Prevent redirect errors
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
        await this.delay(2000 * (retryCount + 1)); // Exponential backoff
        return this.fetchBookDetail(productId, retryCount + 1);
      }
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

      // this.logger.error(
      //   `Failed to fetch detail for product ${productId}: ${error.message}`,
      // );
      return null;
    }
  }

  // Parse book details
  private parseBookDetail(data: any): TikiProductDetail {
    const authors = this.extractAuthors(data);

    return {
      id: data?.id,
      name: data?.name || '',
      description: data?.description || data?.short_description || '',
      original_price: data?.originalPrice,
      promotional_price: data?.price,
      quantity_sold:
        data?.quantity_sold?.value || data?.all_time_quantity_sold || 0,
      thumbnail_url: data.thumbnail_url || '',
      authors,
    };
  }
  private extractAuthors(data: any): string[] {
    const authors: any = [];
    if (Array.isArray(data.authors)) {
      authors.push(
        ...data.authors.map((author: any) => author?.name || author),
      );
    }
    return authors;
  }

  async fetchBookDetails(
    products: Array<{ id: number }>,
    batchSize: number = 10,
    delayMs: number = 500,
  ): Promise<Map<number, TikiProductDetail>> {
    const details = new Map<number, TikiProductDetail>();
    const totalProducts = products.length;

    this.logger.log(
      `Starting to fetch details for ${totalProducts} products in batches of ${batchSize}`,
    );

    // Process in batches to avoid overwhelming the server
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(products.length / batchSize);

      this.logger.debug(
        `Processing batch ${batchNumber}/${totalBatches} (${batch.length} products)`,
      );

      // Fetch batch concurrently
      const batchPromises = batch.map(async (product) => {
        const detail = await this.fetchBookDetail(product.id);
        return { id: product.id, detail };
      });

      try {
        const results = await Promise.all(batchPromises);

        results.forEach(({ id, detail }) => {
          if (detail) {
            details.set(id, detail);
          }
        });

        this.logger.debug(
          `Batch ${batchNumber} completed: ${results.filter((r) => r.detail).length}/${batch.length} successful`,
        );
      } catch (error) {
        this.logger.error(`Batch ${batchNumber} failed: ${error.message}`);
      }

      // Delay between batches to be respectful to the API
      if (i + batchSize < products.length) {
        await this.delay(delayMs);
      }
    }

    //
    const successRate = ((details.size / totalProducts) * 100).toFixed(2);
    this.logger.log(
      `Completed fetching details: ${details.size}/${totalProducts} products successful (${successRate}%)`,
    );

    // this.logger.log(
    //   `Completed fetching details: ${details.size}/${totalProducts} products successful`,
    // );

    return details;
  }

  // Error handling
  private isRetryableError(error: any): boolean {
    // Network errors that are worth retrying
    const retryableCodes = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
    ];

    if (retryableCodes.includes(error.code)) {
      return true;
    }

    // HTTP errors that are worth retrying
    if (error.response) {
      const retryableStatuses = [408, 429, 500, 502, 503, 504];
      return retryableStatuses.includes(error.response.status);
    }

    return false;
    // return (
    //   error.code === 'ECONNRESET' ||
    //   error.code === 'ETIMEDOUT' ||
    //   error.code === 'ENOTFOUND' ||
    //   (error.response && [429, 502, 503, 504].includes(error.response.status))
    // );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
