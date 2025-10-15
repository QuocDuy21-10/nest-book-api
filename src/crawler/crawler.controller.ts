import { Controller, Post } from '@nestjs/common';
import { CrawlerService } from './services/crawler.service';
import { Public, ResponseMessage } from 'src/decorator/customize';
import {
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JobsService } from 'src/jobs/jobs.service';

@ApiTags('Crawler API')
@Controller('crawler')
export class CrawlerController {
  constructor(private readonly crawlerService: CrawlerService) {}

  @Post('tiki/books')
  @Public()
  @ApiOperation({
    summary: 'Crawl Tiki books',
    description: 'Trigger crawler to fetch books from Tiki literature category',
  })
  @ApiOkResponse({
    description: 'Crawl job created successfully',
    schema: {
      example: {
        jobId: '550e8400-e29b-41d4-a716-446655440000',
      },
    },
  })
  @ApiInternalServerErrorResponse({ description: 'Crawling failed' })
  @ResponseMessage('Crawling Tiki books')
  async triggerCrawl() {
    return this.crawlerService.triggerCrawl();
  }
}
