import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LogDocument = HydratedDocument<Log>;
@Schema({ timestamps: true })
export class Log {
  @Prop({ required: true })
  eventType: string;

  @Prop({ required: true })
  timestamp: string;

  @Prop()
  bookId?: string;

  @Prop()
  ipAddress?: string;

  @Prop()
  userId?: string;
}

export const LogSchema = SchemaFactory.createForClass(Log);
