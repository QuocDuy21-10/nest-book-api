import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import type { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { Book, BookDocument } from 'src/books/schemas/book.schema';
import { PriceHistoryService } from './price-history.service';
import { PriceUpdateMessage } from '../interfaces/price-update.interface';

@Injectable()
export class PriceUpdateConsumerService {
  private readonly logger = new Logger(PriceUpdateConsumerService.name);

  constructor(
    @InjectModel(Book.name)
    private bookModel: SoftDeleteModel<BookDocument>,
    private priceHistoryService: PriceHistoryService,
  ) {}

  async processPriceUpdate(message: PriceUpdateMessage): Promise<void> {
    const {
      bookId,
      externalId,
      source,
      jobId,
      newPrice,
      originalPrice,
      status,
      errorMessage,
    } = message;

    try {
      if (status === 'SUCCESS') {
        await this.updateBookPrice(
          bookId,
          externalId,
          source,
          newPrice,
          originalPrice,
          jobId,
        );
      } else {
        await this.recordFailedPriceUpdate(
          bookId,
          externalId,
          source,
          jobId,
          errorMessage || 'Unknown error',
        );
      }
    } catch (error) {
      this.logger.error(
        `[${jobId}] Failed to process price update for book ${bookId}: ${error.message}`,
        error.stack,
      );
    }
  }

  private async updateBookPrice(
    bookId: string,
    externalId: string,
    source: string,
    newPrice: number,
    originalPrice: number,
    jobId: string,
  ): Promise<void> {
    try {
      const bookObjectId = new mongoose.Types.ObjectId(bookId);

      // Get current price from DB
      const currentBook = await this.bookModel
        .findById(bookObjectId)
        .select('promotionalPrice originalPrice')
        .lean();

      if (!currentBook) {
        this.logger.warn(`[${jobId}] Book ${bookId} not found`);
        return;
      }

      const oldPrice = currentBook.promotionalPrice || 0;
      const priceChanged = oldPrice !== newPrice;

      // Update price in Book table
      await this.bookModel.updateOne(
        { _id: bookObjectId },
        {
          $set: {
            promotionalPrice: newPrice,
            originalPrice: originalPrice,
            updatedAt: new Date(),
          },
        },
      );

      // Save price history
      await this.priceHistoryService.createPriceRecord({
        bookId: bookObjectId,
        externalId,
        source,
        originalPrice,
        promotionalPrice: newPrice,
        crawlJobId: jobId,
        status: 'SUCCESS',
      });

      if (priceChanged) {
        const change = newPrice - oldPrice;
        const changePercent =
          oldPrice > 0 ? ((change / oldPrice) * 100).toFixed(2) : 0;

        this.logger.log(
          `[${jobId}] Price updated for book ${bookId}: ${oldPrice} → ${newPrice} (${change > 0 ? '+' : ''}${change}, ${changePercent}%)`,
        );
      } else {
        this.logger.debug(
          `[${jobId}] Price unchanged for book ${bookId}: ${newPrice}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[${jobId}] Error updating price for book ${bookId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async recordFailedPriceUpdate(
    bookId: string,
    externalId: string,
    source: string,
    jobId: string,
    errorMessage: string,
  ): Promise<void> {
    try {
      const bookObjectId = new mongoose.Types.ObjectId(bookId);

      // Lấy giá hiện tại để lưu vào history
      const currentBook = await this.bookModel
        .findById(bookObjectId)
        .select('promotionalPrice originalPrice')
        .lean();

      if (!currentBook) {
        this.logger.warn(
          `[${jobId}] Book ${bookId} not found for failed record`,
        );
        return;
      }

      // Lưu failed record vào price history
      await this.priceHistoryService.createPriceRecord({
        bookId: bookObjectId,
        externalId,
        source,
        originalPrice: currentBook.originalPrice || 0,
        promotionalPrice: currentBook.promotionalPrice || 0,
        crawlJobId: jobId,
        status: 'FAILED',
        errorMessage,
      });

      this.logger.warn(
        `[${jobId}] Failed price update recorded for book ${bookId}: ${errorMessage}`,
      );
    } catch (error) {
      this.logger.error(
        `[${jobId}] Error recording failed price update for book ${bookId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
