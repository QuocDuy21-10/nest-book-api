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
  private readonly BATCH_SIZE = 100;
  private readonly DELAY_BETWEEN_BATCHES = 2000;

  constructor(
    @InjectModel(Book.name)
    private bookModel: SoftDeleteModel<BookDocument>,
    @Inject(KAFKA_SERVICE)
    private kafkaClient: ClientKafka,
    private jobService: JobsService,
  ) {}

  @Cron('0 0 7 * * *', {
    name: 'daily-price-update',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleDailyPriceUpdate() {
    this.logger.log('Starting scheduled daily price update at 7:00 AM');
    await this.triggerPriceUpdate();
  }

  async triggerPriceUpdate(): Promise<{
    jobId: mongoose.Types.ObjectId;
    totalBooks: number;
  }> {
    const jobId = await this.jobService.createJob(PRICE_UPDATE_JOB_TYPE);
    this.logger.log(`Price update job created: ${jobId}`);

    try {
      await this.jobService.startJob(jobId.toString());

      // Get total number of books
      const totalBooks = await this.bookModel.countDocuments({
        isFromCrawler: true,
        externalId: { $exists: true, $ne: null },
        source: { $exists: true, $ne: null },
        isDeleted: { $ne: true },
      });

      this.logger.log(`Found ${totalBooks} books to update prices`);

      if (totalBooks === 0) {
        await this.jobService.completeJob(jobId.toString(), 0, 0, 0);
        return { jobId, totalBooks: 0 };
      }

      this.processBooksPriceUpdate(jobId.toString(), totalBooks).catch(
        (error) => {
          this.logger.error(
            `Background price update failed for job ${jobId}: ${error.message}`,
            error.stack,
          );
        },
      );

      return { jobId, totalBooks };
    } catch (error) {
      this.logger.error(
        `Failed to trigger price update: ${error.message}`,
        error.stack,
      );
      await this.jobService.failJob(jobId.toString(), error.message);
      throw error;
    }
  }

  private async processBooksPriceUpdate(
    jobId: string,
    totalBooks: number,
  ): Promise<void> {
    try {
      let processedCount = 0;
      let batchBuffer: any[] = [];

      // Use cursor for memory-efficient streaming
      const cursor = this.bookModel
        .find({
          isFromCrawler: true,
          externalId: { $exists: true, $ne: null },
          source: { $exists: true, $ne: null },
          isDeleted: { $ne: true },
        })
        .select('_id externalId source')
        .lean()
        .cursor();

      for await (const book of cursor) {
        batchBuffer.push(book);

        // Process when batch is full
        if (batchBuffer.length >= this.BATCH_SIZE) {
          await this.processBatch(batchBuffer, jobId);
          processedCount += batchBuffer.length;

          // Update progress
          await this.jobService.updateJobProgress(
            jobId,
            processedCount,
            totalBooks,
            0,
            0,
            0,
          );

          this.logger.debug(
            `Processed batch: ${processedCount}/${totalBooks} books`,
          );

          batchBuffer = [];

          // Small delay to avoid overwhelming Kafka
          await this.delay(this.DELAY_BETWEEN_BATCHES);
        }
      }

      // Process remaining books in buffer
      if (batchBuffer.length > 0) {
        await this.processBatch(batchBuffer, jobId);
        processedCount += batchBuffer.length;

        await this.jobService.updateJobProgress(
          jobId,
          processedCount,
          totalBooks,
          0,
          0,
          0,
        );
      }

      this.logger.log(
        `Price update job ${jobId}: Completed emitting ${processedCount} tasks`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing price update job ${jobId}: ${error.message}`,
        error.stack,
      );
      await this.jobService.failJob(jobId, error.message);
      throw error;
    }
  }

  //  Process a batch of books emit to Kafka
  private async processBatch(books: any[], jobId: string): Promise<void> {
    const promises = books.map((book) =>
      this.emitPriceCrawlTask(
        book._id,
        book.externalId ?? '',
        book.source ?? '',
        jobId,
      ),
    );

    // Emit all messages in parallel
    await Promise.allSettled(promises);
  }

  private emitPriceCrawlTask(
    bookId: mongoose.Types.ObjectId,
    externalId: string,
    source: string,
    jobId: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.kafkaClient.emit(PRICE_UPDATE, {
          bookId: bookId.toString(),
          externalId,
          source,
          jobId,
          timestamp: new Date().toISOString(),
          retryCount: 0,
        });
        resolve();
      } catch (error) {
        this.logger.error(
          `Failed to emit price crawl task for book ${bookId}: ${error.message}`,
        );
        reject(error);
      }
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Manual update for specific books
  async updatePricesForBooks(bookIds: string[]): Promise<void> {
    if (!bookIds || bookIds.length === 0) {
      throw new Error('Book IDs array cannot be empty');
    }

    const books = await this.bookModel
      .find({
        _id: { $in: bookIds.map((id) => new mongoose.Types.ObjectId(id)) },
        isFromCrawler: true,
        externalId: { $exists: true },
      })
      .select('_id externalId source')
      .lean();

    if (books.length === 0) {
      this.logger.warn('No valid books found for manual price update');
      return;
    }

    const jobId = `manual-${Date.now()}`;

    // Process in parallel for manual updates (small batch)
    await this.processBatch(books, jobId);

    this.logger.log(`Emitted price update tasks for ${books.length} books`);
  }
}
