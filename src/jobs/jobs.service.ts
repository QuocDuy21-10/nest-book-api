import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job, JobDocument } from './schemas/job.schema';
import mongoose, { Model } from 'mongoose';
import { JobStatus } from './enum/job-status.enum';
import { CreateJobDto } from './dto/create-job.dto';
import { QueryJobsDto } from './dto/query-jobs.dto';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(@InjectModel(Job.name) private jobModel: Model<JobDocument>) {}

  /**
   * Create a new job with the specified type
   * @param createJobDto - Job creation data
   * @returns Created job ID
   */
  async createJob(createJobDto: CreateJobDto): Promise<mongoose.Types.ObjectId> {
    const newJob = await this.jobModel.create({
      type: createJobDto.type,
      status: JobStatus.PENDING,
      crawled: 0,
      total: 0,
      newBooks: 0,
      duplicates: 0,
      errors: 0,
      percent: 0,
    });

    this.logger.log(
      `Created job: ${newJob._id} (type: ${createJobDto.type})`,
    );
    return newJob._id;
  }

  /**
   * Create a job by type only (legacy support)
   * @param type - Job type
   * @returns Created job ID
   */
  async createJobByType(type: string): Promise<mongoose.Types.ObjectId> {
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

  /**
   * Trigger/start a job execution
   * @param jobId - Job ID to trigger
   * @returns Updated job
   */
  async triggerJob(jobId: string): Promise<Job> {
    this.validateObjectId(jobId);

    const job = await this.jobModel.findById(jobId).exec();

    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    if (job.status !== JobStatus.PENDING) {
      throw new BadRequestException(
        `Job cannot be triggered. Current status: ${job.status}`,
      );
    }

    await this.startJob(jobId);

    const updatedJob = await this.jobModel.findById(jobId).exec();
    this.logger.log(`Job triggered: ${jobId}`);

    return updatedJob!;
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

  /**
   * Get jobs with filtering and pagination
   * @param queryDto - Query parameters
   * @returns Filtered jobs
   */
  async getJobs(queryDto: QueryJobsDto): Promise<Job[]> {
    const filter: any = {};

    if (queryDto.status) {
      filter.status = queryDto.status;
    }

    if (queryDto.type) {
      filter.type = queryDto.type;
    }

    const limit = queryDto.limit || 10;

    return await this.jobModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
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
