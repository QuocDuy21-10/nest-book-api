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

  @Prop()
  externalId?: string;

  @Prop()
  originalPrice?: number;

  @Prop()
  promotionalPrice?: number;

  @Prop()
  quantitySold?: number;

  @Prop()
  bookImage?: string;

  @Prop()
  source?: string;

  @Prop({ default: false })
  isFromCrawler?: boolean;

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
