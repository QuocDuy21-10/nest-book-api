import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ProductDetailCrawlerService } from '../services/product-detail.service';

@Controller()
export class ProductDetailListener {
  private readonly logger = new Logger(ProductDetailListener.name);

  constructor(
    private readonly detailCrawlerService: ProductDetailCrawlerService,
  ) {
    this.logger.log('ProductDetailListener initialized');
  }
  @EventPattern('crawl-product-detail')
  async handleDetailCrawl(@Payload() message: any) {
    const { productId, jobId, source, retryCount = 0 } = message;

    try {
      this.logger.debug(
        `Received detail crawl task for product ${productId} (jobId: ${jobId}, retry: ${retryCount})`,
      );

      await this.detailCrawlerService.crawlProductDetail(
        productId,
        jobId,
        source,
        retryCount,
      );

      this.logger.debug(`Detail crawl completed for product ${productId}`);
    } catch (error) {
      this.logger.error(
        `Error processing detail crawl for product ${productId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
