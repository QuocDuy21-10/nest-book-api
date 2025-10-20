import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import type { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { Book, BookDocument } from 'src/books/schemas/book.schema';
import { ClientKafka } from '@nestjs/microservices';
import {
  KAFKA_SERVICE,
  PRICE_UPDATE,
  PRICE_UPDATE_JOB_TYPE,
} from 'src/common/constants';
import { JobsService } from 'src/jobs/jobs.service';

@Injectable()
export class PriceUpdateSchedulerService {
  private readonly logger = new Logger(PriceUpdateSchedulerService.name);
  private readonly BATCH_SIZE = 50;
  private readonly DELAY_BETWEEN_BATCHES = 2000;

  constructor(
    @InjectModel(Book.name)
    private bookModel: SoftDeleteModel<BookDocument>,
    @Inject(KAFKA_SERVICE)
    private kafkaClient: ClientKafka,
    private jobService: JobsService,
  ) {}

  // Runs at 7am every day
  @Cron('50 * * * * *', {
    name: 'daily-price-update',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleDailyPriceUpdate() {
    this.logger.log('Starting scheduled daily price update at 7:00 AM');
    await this.triggerPriceUpdate();
  }

  // Có thể gọi manual qua API
  async triggerPriceUpdate(): Promise<{ jobId: mongoose.Types.ObjectId }> {
    const jobId = await this.jobService.createJob(PRICE_UPDATE_JOB_TYPE);
    this.logger.log(`Price update job created: ${jobId}`);

    try {
      await this.jobService.startJob(jobId.toString());

      // Lấy tất cả sách từ crawler (có externalId và source)
      const books = await this.bookModel
        .find({
          isFromCrawler: true,
          externalId: { $exists: true, $ne: null },
          source: { $exists: true, $ne: null },
          isDeleted: { $ne: true },
        })
        .select('_id externalId source title')
        .lean();

      this.logger.log(`Found ${books.length} books to update prices`);

      if (books.length === 0) {
        await this.jobService.completeJob(jobId.toString(), 0, 0, 0);
        return { jobId };
      }

      // Process books in batches to avoid overload
      let processedCount = 0;
      for (let i = 0; i < books.length; i += this.BATCH_SIZE) {
        const batch = books.slice(i, i + this.BATCH_SIZE);

        // Emit price crawl tasks for each book in the batch
        batch.forEach((book) => {
          this.emitPriceCrawlTask(
            book._id,
            book.externalId ?? '',
            book.source ?? '',
            jobId.toString(),
          );
        });

        processedCount += batch.length;

        // Update job progress
        await this.jobService.updateJobProgress(
          jobId.toString(),
          processedCount,
          books.length,
          0,
          0,
          0,
        );

        this.logger.debug(
          `Emitted price update tasks for batch ${Math.ceil((i + 1) / this.BATCH_SIZE)} (${processedCount}/${books.length})`,
        );

        // Delay between batches
        if (i + this.BATCH_SIZE < books.length) {
          await this.delay(this.DELAY_BETWEEN_BATCHES);
        }
      }

      this.logger.log(
        `Price update job ${jobId}: Emitted ${processedCount} tasks`,
      );

      // Job will be completed by consumer after processing
      return { jobId };
    } catch (error) {
      this.logger.error(
        `Failed to trigger price update: ${error.message}`,
        error.stack,
      );
      await this.jobService.failJob(jobId.toString(), error.message);
      throw error;
    }
  }

  private emitPriceCrawlTask(
    bookId: mongoose.Types.ObjectId,
    externalId: string,
    source: string,
    jobId: string,
  ): void {
    try {
      this.kafkaClient.emit(PRICE_UPDATE, {
        bookId: bookId.toString(),
        externalId,
        source,
        jobId,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });
    } catch (error) {
      this.logger.error(
        `Failed to emit price crawl task for book ${bookId}: ${error.message}`,
      );
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Method để test hoặc chạy lại cho một batch nhỏ
  async updatePricesForBooks(bookIds: string[]): Promise<void> {
    const books = await this.bookModel
      .find({
        _id: { $in: bookIds.map((id) => new mongoose.Types.ObjectId(id)) },
        isFromCrawler: true,
        externalId: { $exists: true },
      })
      .select('_id externalId source')
      .lean();

    const jobId = 'manual-price-update';

    books.forEach((book) => {
      this.emitPriceCrawlTask(
        book._id,
        book.externalId ?? '',
        book.source ?? '',
        jobId,
      );
    });

    this.logger.log(`Emitted price update tasks for ${books.length} books`);
  }
}
