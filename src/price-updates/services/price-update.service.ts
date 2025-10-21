import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import type { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { Book, BookDocument } from 'src/books/schemas/book.schema';
import {
  PriceHistory,
  PriceHistoryDocument,
} from '../schemas/price-history.schema';
import { PriceUpdateMessage } from '../interfaces/price-update.interface';

@Injectable()
export class PriceUpdateConsumerService {
  private readonly logger = new Logger(PriceUpdateConsumerService.name);

  constructor(
    @InjectModel(Book.name)
    private bookModel: SoftDeleteModel<BookDocument>,
    @InjectModel(PriceHistory.name)
    private priceHistoryModel: SoftDeleteModel<PriceHistoryDocument>,
    @InjectConnection()
    private readonly connection: mongoose.Connection,
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
    // Start transaction
    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        const bookObjectId = new mongoose.Types.ObjectId(bookId);

        const currentBook = await this.bookModel
          .findById(bookObjectId)
          .select('promotionalPrice originalPrice')
          .session(session)
          .lean();

        if (!currentBook) {
          this.logger.warn(`[${jobId}] Book ${bookId} not found`);
          throw new Error(`Book ${bookId} not found`);
        }

        const oldPrice = currentBook.promotionalPrice || 0;
        const priceChanged = oldPrice !== newPrice;

        // Get last price to calculate priceChange (in transaction)
        const lastPrice = await this.priceHistoryModel
          .findOne({ bookId: bookObjectId, status: 'SUCCESS' })
          .sort({ recordedAt: -1 })
          .select('promotionalPrice')
          .session(session)
          .lean();

        let priceChange: number | undefined;
        let priceChangePercentage: number | undefined;

        if (lastPrice) {
          priceChange = newPrice - lastPrice.promotionalPrice;
          if (lastPrice.promotionalPrice > 0) {
            priceChangePercentage =
              (priceChange / lastPrice.promotionalPrice) * 100;
          }
        }

        // TRANSACTION STEP 1: Update Book price
        const updateResult = await this.bookModel.updateOne(
          { _id: bookObjectId },
          {
            $set: {
              promotionalPrice: newPrice,
              originalPrice: originalPrice,
              updatedAt: new Date(),
            },
          },
          { session },
        );

        if (updateResult.matchedCount === 0) {
          throw new Error(`Book ${bookId} not found during update`);
        }

        // TRANSACTION STEP 2: Create price history record
        await this.priceHistoryModel.create(
          [
            {
              bookId: bookObjectId,
              externalId,
              source,
              originalPrice,
              promotionalPrice: newPrice,
              priceChange,
              priceChangePercentage,
              recordedAt: new Date(),
              crawlJobId: jobId,
              status: 'SUCCESS',
            },
          ],
          { session }, // create() with array needs session as second parameter
        );

        if (priceChanged) {
          const change = newPrice - oldPrice;
          const changePercent =
            oldPrice > 0 ? ((change / oldPrice) * 100).toFixed(2) : '0';

          this.logger.log(
            `[${jobId}] Price updated for book ${bookId}: ${oldPrice} → ${newPrice} (${change > 0 ? '+' : ''}${change}, ${changePercent}%)`,
          );
        } else {
          this.logger.debug(
            `[${jobId}] Price unchanged for book ${bookId}: ${newPrice}`,
          );
        }
      });
    } catch (error) {
      this.logger.error(
        `[${jobId}] Transaction failed for book ${bookId}: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      // Always end session
      await session.endSession();
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

      // Save failed record (no transaction needed because only insert 1 record)
      await this.priceHistoryModel.create({
        bookId: bookObjectId,
        externalId,
        source,
        originalPrice: currentBook.originalPrice || 0,
        promotionalPrice: currentBook.promotionalPrice || 0,
        recordedAt: new Date(),
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
