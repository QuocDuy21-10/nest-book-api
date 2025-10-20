import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ScheduleModule } from '@nestjs/schedule';
import { Book, BookSchema } from 'src/books/schemas/book.schema';
import {
  PriceHistory,
  PriceHistorySchema,
} from './schemas/price-history.schema';
import { PriceHistoryService } from './services/price-history.service';
import { PriceUpdateSchedulerService } from './services/price-update-scheduler.service';
import { PriceCrawlerService } from './services/price-crawler.service';
import { PriceUpdateConsumerService } from './services/price-update.service';
import { PriceUpdateListener } from './listeners/price-update.listener';
import { JobsModule } from 'src/jobs/jobs.module';
import {
  KAFKA_SERVICE,
  PRICE_UPDATE_CONSUMER_GROUP,
  PRICE_UPDATE_SERVICE,
} from 'src/common/constants';
import { PriceUpdateController } from './price-updates.controller';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Book.name, schema: BookSchema },
      { name: PriceHistory.name, schema: PriceHistorySchema },
    ]),
    ClientsModule.registerAsync([
      {
        name: KAFKA_SERVICE,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: PRICE_UPDATE_SERVICE,
              brokers: [
                configService.get<string>('KAFKA_BROKER') || 'localhost:9092',
              ],
            },
            consumer: {
              groupId: PRICE_UPDATE_CONSUMER_GROUP,
              allowAutoTopicCreation: true,
            },
            producer: {
              allowAutoTopicCreation: true,
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
    ScheduleModule.forRoot(),
    JobsModule,
  ],
  controllers: [PriceUpdateController, PriceUpdateListener],
  providers: [
    PriceHistoryService,
    PriceUpdateSchedulerService,
    PriceCrawlerService,
    PriceUpdateConsumerService,
  ],
  exports: [PriceHistoryService, PriceUpdateSchedulerService],
})
export class PriceUpdateModule {}
