import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { Book } from 'src/books/schemas/book.schema';

export type AuthorDocument = HydratedDocument<Author>;
@Schema({ timestamps: true })
export class Author {
  @Prop({ required: true })
  name: string;

  @Prop()
  bio?: string;

  @Prop()
  birthDate: string;

  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book' }] })
  books?: mongoose.Schema.Types.ObjectId[];

  @Prop({ unique: true, sparse: true })
  externalId: string;

  @Prop()
  slug?: string;

  @Prop()
  source?: string;

  @Prop({ default: false })
  isFromCrawler: boolean;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;

  @Prop()
  isDeleted?: boolean;

  @Prop()
  deletedAt?: Date;
}

export const AuthorSchema = SchemaFactory.createForClass(Author);

AuthorSchema.index(
  { externalId: 1, source: 1 },
  { unique: true, sparse: true },
);
AuthorSchema.index({ name: 1 });
AuthorSchema.index({ isFromCrawler: 1 });
