import { Module } from '@nestjs/common';
import { LogsService } from './logs.service';
import { LogsController } from './logs.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Log, LogSchema } from './schemas/log.schema';
import { KafkaModule } from 'src/kafka/kafka.module';
import { LogListenerService } from './log-listener.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Log.name, schema: LogSchema }]),
    KafkaModule,
  ],
  controllers: [LogsController, LogListenerService],
  providers: [LogsService],
})
export class LogsModule {}
