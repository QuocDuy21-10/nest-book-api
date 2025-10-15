import { Module } from '@nestjs/common';
import { CrawlerService } from './services/crawler.service';
import { CrawlerController } from './crawler.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Book, BookSchema } from 'src/books/schemas/book.schema';
import { Job, JobSchema } from 'src/jobs/schemas/job.schema';
import { KafkaModule } from 'src/kafka/kafka.module';
import { JobsModule } from 'src/jobs/jobs.module';
import { CrawlListenerService } from './crawl-listener.service';
import { BookDetailService } from './services/product-detail.service';

@Module({
  imports: [
    KafkaModule,
    JobsModule,
    MongooseModule.forFeature([{ name: Job.name, schema: JobSchema }]),
    MongooseModule.forFeature([{ name: Book.name, schema: BookSchema }]),
  ],
  controllers: [CrawlerController, CrawlListenerService],
  providers: [CrawlerService, BookDetailService],
  exports: [CrawlerService, BookDetailService],
})
export class CrawlerModule {}
