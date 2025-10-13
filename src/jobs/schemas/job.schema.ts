import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { JobStatus } from '../enum/job-status.enum';

export type JobDocument = HydratedDocument<Job>;

@Schema({ timestamps: true })
export class Job {
  @Prop({ required: true, enum: JobStatus, default: JobStatus.PENDING })
  status: JobStatus;

  @Prop({ required: true })
  type: string;

  @Prop({ default: 0 })
  crawled: number; // Number of books crawled so far

  @Prop({ default: 0 })
  total: number;

  @Prop({ default: 0 })
  newBooks: number;

  @Prop({ default: 0 })
  duplicates: number;

  @Prop({ default: 0 })
  errors: number;

  @Prop()
  errorMessage?: string;

  @Prop()
  startedAt?: Date;

  @Prop()
  completedAt?: Date;
  @Prop({ default: 0 })
  percent: number;
  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const JobSchema = SchemaFactory.createForClass(Job);

// Index for faster job lookups
JobSchema.index({ jobId: 1 });
JobSchema.index({ status: 1 });
JobSchema.index({ createdAt: -1 });
