import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { PriceCrawlerService } from '../services/price-crawler.service';
import { PriceUpdateConsumerService } from '../services/price-update.service';
import { PRICE_UPDATE } from 'src/common/constants';

@Controller()
export class PriceUpdateListener {
  private readonly logger = new Logger(PriceUpdateListener.name);

  constructor(
    private readonly priceCrawlerService: PriceCrawlerService,
    private readonly priceUpdateConsumer: PriceUpdateConsumerService,
  ) {
    this.logger.log('PriceUpdateListener initialized');
  }

  // Consumer 1: Crawl price from API
  @EventPattern(PRICE_UPDATE)
  async handlePriceCrawl(@Payload() message: any) {
    const { bookId, externalId, source, jobId, retryCount = 0 } = message;

    try {
      this.logger.debug(
        `Received price crawl task for book ${bookId} (externalId: ${externalId})`,
      );

      await this.priceCrawlerService.crawlPrice(
        bookId,
        externalId,
        source,
        jobId,
        retryCount,
      );
    } catch (error) {
      this.logger.error(
        `Error processing price crawl for book ${bookId}: ${error.message}`,
        error.stack,
      );
    }
  }

  // Consumer 2: Get results and update DB
  @EventPattern(`${PRICE_UPDATE}.result`)
  async handlePriceUpdateResult(@Payload() message: any) {
    try {
      this.logger.debug(
        `Received price update result for book ${message.bookId}: ${message.status}`,
      );

      await this.priceUpdateConsumer.processPriceUpdate(message);
    } catch (error) {
      this.logger.error(
        `Error processing price update result for book ${message.bookId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
