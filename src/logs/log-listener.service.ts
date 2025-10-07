import { Controller, Logger } from '@nestjs/common';
import { LogsService } from './logs.service';
import { EventPattern, Payload } from '@nestjs/microservices';

@Controller()
export class LogListenerService {
  private readonly logger = new Logger(LogListenerService.name);

  constructor(private readonly logService: LogsService) {
    this.logger.log('LogListenerService initialized');
  }

  @EventPattern('book-log-events')
  async handleBookLog(@Payload() message: any) {
    try {
      this.logger.log(`Received Kafka message: ${JSON.stringify(message)}`);
      await this.logService.create(message);
      this.logger.log(`Log successfully saved to database`);
    } catch (error) {
      this.logger.error(`Error saving log: ${error.message}`, error.stack);
    }
  }
}
