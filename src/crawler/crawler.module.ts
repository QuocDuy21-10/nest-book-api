import { Module } from '@nestjs/common';
import { CrawlerService } from './services/crawler.service';
import { CrawlerController } from './crawler.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Book, BookSchema } from 'src/books/schemas/book.schema';
import { Job, JobSchema } from 'src/jobs/schemas/job.schema';
import { KafkaModule } from 'src/kafka/kafka.module';
import { JobsModule } from 'src/jobs/jobs.module';
import { CrawlListenerService } from './listener/list-crawl-listener.service';
import { ProductDetailCrawlerService } from './services/product-detail.service';
import { AuthorsModule } from 'src/authors/authors.module';
import { ProductDetailListener } from './listener/detail-crawler-listener.service';
import { BooksModule } from 'src/books/books.module';

@Module({
  imports: [
    KafkaModule,
    JobsModule,
    AuthorsModule,
    MongooseModule.forFeature([{ name: Job.name, schema: JobSchema }]),
    MongooseModule.forFeature([{ name: Book.name, schema: BookSchema }]),
  ],
  controllers: [CrawlerController, CrawlListenerService, ProductDetailListener],
  providers: [CrawlerService, ProductDetailCrawlerService],
  exports: [CrawlerService, ProductDetailCrawlerService],
})
export class CrawlerModule {}
