import {
  Controller,
  Get,
  InternalServerErrorException,
  Param,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { Public, ResponseMessage } from 'src/decorator/customize';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

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
}
