import {
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Param,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { Public, ResponseMessage } from 'src/decorator/customize';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Job APIs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobService: JobsService) {}

  @Get(':id')
  @Public()
  @ApiOperation({
    summary: 'Get crawl job status',
    description: 'Get the progress and status of a crawl job',
  })
  @ResponseMessage('Job status retrieved')
  async getJobStatus(@Param('id') jobId: string) {
    const job = await this.jobService.getJob(jobId);
    if (!job) {
      throw new InternalServerErrorException('Job not found');
    }
    return job;
  }

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Get all crawl jobs',
    description: 'Get list of recent crawl jobs',
  })
  @ResponseMessage('Jobs retrieved')
  async getAllJobs() {
    return this.jobService.getAllJobs();
  }

  @Delete(':id/cancel')
  @Public()
  @ApiOperation({
    summary: 'Cancel a job',
    description: 'Cancel a pending or processing job',
  })
  @ApiParam({
    name: 'id',
    description: 'Job ID to cancel',
    example: '67890abcdef1234567890123',
  })
  @ApiOkResponse({
    description: 'Job cancelled successfully',
  })
  @ApiNotFoundResponse({ description: 'Job not found or cannot be cancelled' })
  @ResponseMessage('Job cancelled')
  async cancelJob(@Param('id') jobId: string) {
    await this.jobService.cancelJob(jobId);
    return { cancelled: true };
  }
}
