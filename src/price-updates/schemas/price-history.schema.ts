import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { Book } from 'src/books/schemas/book.schema';

export type PriceHistoryDocument = HydratedDocument<PriceHistory>;

@Schema({ timestamps: true })
export class PriceHistory {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Book.name,
    required: true,
    index: true,
  })
  bookId: mongoose.Schema.Types.ObjectId;

  @Prop({ required: true })
  externalId: string;

  @Prop({ required: true })
  source: string;

  @Prop({ type: Number, required: true })
  originalPrice: number;

  @Prop({ type: Number, required: true })
  promotionalPrice: number;

  @Prop({ type: Number })
  priceChange?: number; // price change since last record

  @Prop({ type: Number })
  priceChangePercentage?: number;

  @Prop({ type: Date, required: true })
  recordedAt: Date;

  @Prop()
  crawlJobId?: string;

  @Prop({ default: 'SUCCESS' })
  status: string;

  @Prop()
  errorMessage?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const PriceHistorySchema = SchemaFactory.createForClass(PriceHistory);

PriceHistorySchema.index({ bookId: 1, recordedAt: -1 });
PriceHistorySchema.index({ externalId: 1, source: 1, recordedAt: -1 });
PriceHistorySchema.index({ recordedAt: -1 });
PriceHistorySchema.index({ status: 1, recordedAt: -1 });
