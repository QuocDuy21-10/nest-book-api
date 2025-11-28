import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { Author } from 'src/authors/schemas/author.schema';

export type BookDocument = HydratedDocument<Book>;
@Schema({ timestamps: true })
export class Book {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop()
  publishedAt: string;

  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: Author.name }],
    required: true,
  })
  authors: mongoose.Schema.Types.ObjectId[];

  @Prop({ default: false })
  isPremium: boolean;

  @Prop({ default: true })
  isAvailable: boolean;

  @Prop()
  externalId?: string;

  @Prop({ type: Number, default: 0 })
  originalPrice?: number;

  @Prop({ type: Number, default: 0 })
  promotionalPrice?: number;

  @Prop({ type: Number, default: 0 })
  quantitySold?: number;

  @Prop()
  bookImage?: string;

  @Prop()
  source?: string;

  @Prop({ default: false })
  isFromCrawler?: boolean;

  @Prop({ default: true })
  needsDetailCrawl: boolean;

  @Prop({ type: Number, default: 0 })
  detailCrawlAttempts: number;

  @Prop({ type: Date })
  lastDetailCrawlAt: Date;

  @Prop()
  lastDetailCrawlError?: string;

  @Prop({ default: false })
  detailCrawlSuccess: boolean;

  @Prop({ default: false })
  detailCrawlPermanentlyFailed: boolean;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;

  @Prop()
  isDeleted?: boolean;

  @Prop()
  deletedAt?: Date;
}

export const BookSchema = SchemaFactory.createForClass(Book);

// Create index on externalId and source to check for duplicates
BookSchema.index({ externalId: 1, source: 1 }, { unique: true, sparse: true });

BookSchema.index({ needsDetailCrawl: 1, detailCrawlPermanentlyFailed: 1 });
BookSchema.index({ lastDetailCrawlAt: 1 });
BookSchema.index({ isFromCrawler: 1 });
