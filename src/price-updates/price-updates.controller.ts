import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpStatus,
} from '@nestjs/common';
import mongoose from 'mongoose';
import { PriceUpdateSchedulerService } from './services/price-update-scheduler.service';
import { PriceHistoryService } from './services/price-history.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { Public } from 'src/decorator/customize';

@ApiTags('Price Updates APIs')
@Public()
@Controller('price-updates')
export class PriceUpdateController {
  constructor(
    private readonly priceUpdateScheduler: PriceUpdateSchedulerService,
    private readonly priceHistoryService: PriceHistoryService,
  ) {}

  @Post('trigger')
  @ApiOperation({
    summary: 'Trigger manual price update for all books',
    description:
      'Manually trigger a price update job that will crawl and update prices for all books in the database. This job runs automatically at 7:00 AM daily.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Price update job triggered successfully',
    schema: {
      example: {
        message: 'Price update job triggered successfully',
        jobId: '67123abc456def789012345',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Failed to trigger price update',
  })
  async triggerPriceUpdate() {
    const result = await this.priceUpdateScheduler.triggerPriceUpdate();
    return {
      message: 'Price update job triggered successfully',
      jobId: result.jobId,
    };
  }

  @Post('trigger/books')
  @ApiOperation({
    summary: 'Update prices for specific books',
    description:
      'Trigger price update for a list of specific books by their IDs. Useful for updating individual books without running a full update.',
  })
  @ApiBody({
    description: 'List of book IDs to update',
    schema: {
      type: 'object',
      properties: {
        bookIds: {
          type: 'array',
          items: { type: 'string' },
          example: ['68f5c5308fa359cf499ca8cc', '68f5c5308fa359cf499ca8cd'],
          description: 'Array of MongoDB ObjectId strings',
        },
      },
      required: ['bookIds'],
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Price update triggered for specific books',
    schema: {
      example: {
        message: 'Price update triggered for 3 books',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid book IDs provided',
  })
  async updateSpecificBooks(@Body() body: { bookIds: string[] }) {
    await this.priceUpdateScheduler.updatePricesForBooks(body.bookIds);
    return {
      message: `Price update triggered for ${body.bookIds.length} books`,
    };
  }

  @Get('history/:bookId')
  @ApiOperation({
    summary: 'Get price history for a book',
    description:
      'Retrieve the complete price change history for a specific book, ordered by most recent first.',
  })
  @ApiParam({
    name: 'bookId',
    type: 'string',
    description: 'MongoDB ObjectId of the book',
    example: '67123abc456def789012345',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: 'number',
    description: 'Maximum number of history records to return',
    example: 30,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Price history retrieved successfully',
    schema: {
      example: {
        bookId: '67123abc456def789012345',
        totalRecords: 15,
        history: [
          {
            _id: '67123abc456def789012999',
            bookId: '67123abc456def789012345',
            externalId: '12345',
            source: 'Tiki',
            originalPrice: 300000,
            promotionalPrice: 250000,
            priceChange: -20000,
            priceChangePercentage: -7.41,
            recordedAt: '2025-10-20T07:00:00.000Z',
            crawlJobId: 'job_20251020',
            status: 'SUCCESS',
            createdAt: '2025-10-20T07:00:15.000Z',
            updatedAt: '2025-10-20T07:00:15.000Z',
          },
          {
            _id: '67123abc456def789012998',
            bookId: '67123abc456def789012345',
            externalId: '12345',
            source: 'Tiki',
            originalPrice: 300000,
            promotionalPrice: 270000,
            priceChange: 0,
            priceChangePercentage: 0,
            recordedAt: '2025-10-19T07:00:00.000Z',
            crawlJobId: 'job_20251019',
            status: 'SUCCESS',
            createdAt: '2025-10-19T07:00:15.000Z',
            updatedAt: '2025-10-19T07:00:15.000Z',
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid book ID format',
  })
  async getPriceHistory(
    @Param('bookId') bookId: string,
    @Query('limit') limit?: number,
  ) {
    const history = await this.priceHistoryService.getPriceHistory(
      new mongoose.Types.ObjectId(bookId),
      limit || 30,
    );

    return {
      bookId,
      totalRecords: history.length,
      history,
    };
  }
}
