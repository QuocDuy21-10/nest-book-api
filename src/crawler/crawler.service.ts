import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import axios, { AxiosInstance } from 'axios';
import type { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { Book, BookDocument } from 'src/books/schemas/book.schema';
import { TikiProduct } from './interfaces/tiki-product.interface';
import { CrawlResponse } from './interfaces/crawl-response.interface';

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly TIKI_API_BASE =
    'https://tiki.vn/api/personalish/v1/blocks/listings';
  private readonly TIKI_CATEGORY = '839'; // Literature category
  private readonly BOOKS_PER_PAGE = 40;
  private readonly MAX_PAGES = 25;

  constructor(
    @InjectModel(Book.name) private bookModel: SoftDeleteModel<BookDocument>,
  ) {
    this.axiosInstance = axios.create({
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });
  }

  async crawlTikiBooks(): Promise<CrawlResponse> {
    this.logger.log('Starting Tiki books crawl...');
    let totalBooks = 0;
    let newBooks = 0;
    let duplicates = 0;

    try {
      for (let page = 1; page <= this.MAX_PAGES; page++) {
        this.logger.log(`Crawling page ${page}/${this.MAX_PAGES}`);

        try {
          const products = await this.fetchTikiPage(page);

          if (!products || products.length === 0) {
            this.logger.log(`No more products found at page ${page}`);
            break;
          }

          for (const product of products) {
            const result = await this.processProduct(product);
            if (result.isNew) {
              newBooks++;
            } else if (result.isDuplicate) {
              duplicates++;
            }
            totalBooks++;
          }

          // Small delay between requests to be respectful to server
          await this.delay(500);
        } catch (error) {
          this.logger.error(
            `Error crawling page ${page}: ${error.message}`,
            error.stack,
          );
          // Continue to next page on error
          continue;
        }
      }

      this.logger.log(
        `Crawling completed: Total=${totalBooks}, New=${newBooks}, Duplicates=${duplicates}`,
      );

      return {
        success: true,
        totalBooks,
        newBooks,
        duplicates,
      };
    } catch (error) {
      this.logger.error(`Crawling failed: ${error.message}`, error.stack);
      throw new BadRequestException(`Crawling failed: ${error.message}`);
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

  private async processProduct(
    product: TikiProduct,
  ): Promise<{ isNew: boolean; isDuplicate: boolean }> {
    try {
      // Check if product already exists
      const existingBook = await this.bookModel.findOne({
        externalId: product.id.toString(),
        source: 'Tiki',
      });

      if (existingBook) {
        this.logger.debug(`Product ${product.id} already exists in database`);
        return { isNew: false, isDuplicate: true };
      }

      // Create new book entry
      await this.bookModel.create({
        title: product.name,
        description: product.name,
        externalId: product.id.toString(),
        source: 'Tiki',
        originalPrice: product.original_price || product.list_price || 0,
        promotionalPrice: product.price || 0,
        quantitySold: product.quantity_sold?.value || 0,
        bookImage: product.thumbnail_url || null,
        isFromCrawler: true,
        authors: [],
        isPremium: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      this.logger.debug(
        `Successfully created book: ${product.id} - ${product.name}`,
      );
      return { isNew: true, isDuplicate: false };
    } catch (error) {
      this.logger.error(
        `Failed to process product ${product.id}: ${error.message}`,
        error.stack,
      );
      // Continue processing other products
      return { isNew: false, isDuplicate: false };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
