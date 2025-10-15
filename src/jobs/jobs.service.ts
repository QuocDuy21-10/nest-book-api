import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job, JobDocument } from './schemas/job.schema';
import mongoose, { Model } from 'mongoose';
import { JobStatus } from './enum/job-status.enum';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  constructor(@InjectModel(Job.name) private jobModel: Model<JobDocument>) {}
  async createJob(type: string): Promise<mongoose.Types.ObjectId> {
    const newJob = await this.jobModel.create({
      type,
      status: JobStatus.PENDING,
      crawled: 0,
      total: 0,
      newBooks: 0,
      duplicates: 0,
      errors: 0,
      percent: 0,
    });
    this.logger.log(`Created job: ${newJob._id} (type: ${type})`);
    return newJob._id;
  }

  async getJob(id: string): Promise<Job | null> {
    this.validateObjectId(id);
    return await this.jobModel.findById(id).exec();
  }

  async startJob(id: string): Promise<void> {
    this.validateObjectId(id);
    await this.jobModel
      .updateOne(
        { _id: id },
        {
          status: JobStatus.PROCESSING,
          startedAt: new Date(),
        },
      )
      .exec();
    this.logger.log(`Job started: ${id}`);
  }

  async updateJobProgress(
    id: string,
    crawled: number,
    total: number,
    newBooks: number,
    duplicates: number,
    errors: number = 0,
  ): Promise<void> {
    this.validateObjectId(id);
    const percent = total > 0 ? Math.round((crawled / total) * 100) : 0;
    await this.jobModel
      .updateOne(
        { _id: id },
        { crawled, total, newBooks, duplicates, errors, percent },
      )
      .exec();
    this.logger.log(`Job updated: ${id}`);
  }

  async completeJob(
    id: string,
    newBooks: number,
    duplicates: number,
    errors: number = 0,
  ): Promise<void> {
    this.validateObjectId(id);
    await this.jobModel
      .updateOne(
        { _id: id },
        {
          status: JobStatus.COMPLETED,
          completedAt: new Date(),
          newBooks,
          duplicates,
          errors,
          percent: 100,
          crawled: newBooks + duplicates + errors,
          total: newBooks + duplicates + errors,
        },
      )
      .exec();
    this.logger.log(
      `Job completed: ${id} (New: ${newBooks}, Duplicates: ${duplicates}, Errors: ${errors})`,
    );
  }

  async failJob(id: string, errorMessage: string): Promise<void> {
    await this.jobModel
      .updateOne(
        { _id: id },
        {
          status: JobStatus.FAILED,
          completedAt: new Date(),
          errorMessage,
        },
      )
      .exec();
    this.logger.error(`Job failed: ${id} - ${errorMessage}`);
  }

  async getAllJobs() {
    return await this.jobModel.find().sort({ createdAt: -1 }).limit(10).exec();
  }

  async cancelJob(id: string): Promise<void> {
    this.validateObjectId(id);

    const result = await this.jobModel
      .updateOne(
        {
          _id: id,
          status: { $in: [JobStatus.PENDING, JobStatus.PROCESSING] },
        },
        {
          $set: {
            status: JobStatus.FAILED,
            completedAt: new Date(),
            errorMessage: 'Job cancelled by user',
            updatedAt: new Date(),
          },
        },
      )
      .exec();

    if (result.modifiedCount === 0) {
      throw new BadRequestException('Job cannot be cancelled (not running)');
    }

    this.logger.log(`Job cancelled: ${id}`);
  }

  private validateObjectId(id: string): void {
    if (!id?.trim() || !mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID format');
    }
  }
}
