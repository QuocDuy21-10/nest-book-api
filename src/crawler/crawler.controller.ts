import { Controller, Post } from '@nestjs/common';
import { CrawlerService } from './crawler.service';
import { Public, ResponseMessage } from 'src/decorator/customize';
import {
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

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
  @ApiInternalServerErrorResponse({ description: 'Crawling failed' })
  @ResponseMessage('Crawling Tiki books')
  async crawlTikiBooks() {
    return this.crawlerService.crawlTikiBooks();
  }
}
