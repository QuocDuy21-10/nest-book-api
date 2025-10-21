import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import type { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import {
  PriceHistory,
  PriceHistoryDocument,
} from '../schemas/price-history.schema';

@Injectable()
export class PriceHistoryService {
  private readonly logger = new Logger(PriceHistoryService.name);

  constructor(
    @InjectModel(PriceHistory.name)
    private priceHistoryModel: SoftDeleteModel<PriceHistoryDocument>,
  ) {}

  // async createPriceRecord(data: {
  //   bookId: mongoose.Types.ObjectId;
  //   externalId: string;
  //   source: string;
  //   originalPrice: number;
  //   promotionalPrice: number;
  //   priceChange?: number;
  //   priceChangePercentage?: number;
  //   crawlJobId?: string;
  //   status?: string;
  //   errorMessage?: string;
  // }): Promise<PriceHistory> {
  //   try {
  //     const priceRecord = await this.priceHistoryModel.create({
  //       ...data,
  //       recordedAt: new Date(),
  //       status: data.status || 'SUCCESS',
  //     });

  //     this.logger.debug(
  //       `Price record created for book ${data.bookId}: ${data.promotionalPrice}`,
  //     );

  //     return priceRecord;
  //   } catch (error) {
  //     this.logger.error(
  //       `Failed to create price record for book ${data.bookId}: ${error.message}`,
  //       error.stack,
  //     );
  //     throw error;
  //   }
  // }

  async getLatestPrice(
    bookId: mongoose.Types.ObjectId,
  ): Promise<PriceHistory | null> {
    return this.priceHistoryModel
      .findOne({ bookId, status: 'SUCCESS' })
      .sort({ recordedAt: -1 })
      .select(
        'promotionalPrice originalPrice priceChange priceChangePercentage',
      )
      .lean();
  }

  async getPriceHistory(
    bookId: mongoose.Types.ObjectId,
    limit: number = 30,
  ): Promise<PriceHistory[]> {
    return this.priceHistoryModel
      .find({ bookId })
      .sort({ recordedAt: -1 })
      .limit(limit)
      .lean();
  }
}
