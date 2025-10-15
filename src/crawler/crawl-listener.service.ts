import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { CrawlerService } from './services/crawler.service';
import { JOB_TYPE } from 'src/common/constants';

@Controller()
export class CrawlListenerService {
  private readonly logger = new Logger(CrawlListenerService.name);

  constructor(private readonly crawlerService: CrawlerService) {
    this.logger.log('CrawlListenerService initialized');
  }

  @EventPattern('crawl-tasks')
  async handleCrawlTask(@Payload() message: any) {
    const { jobId, type } = message;
    try {
      this.logger.log(`Received crawl task: ${jobId} (type: ${type})`);

      if (type === JOB_TYPE) {
        await this.crawlerService.crawlTikiBooks(jobId);
      }

      this.logger.log(`Crawl task completed: ${jobId}`);
    } catch (error) {
      this.logger.error(
        `Error processing crawl task ${jobId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
