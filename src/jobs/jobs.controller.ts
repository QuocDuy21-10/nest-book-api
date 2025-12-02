import {
  Controller,
  Delete,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  InternalServerErrorException,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { Public, ResponseMessage, Roles } from 'src/decorator/customize';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtRsaAuthGuard } from 'src/auth/guard/jwt-rsa-auth.guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { SystemRole } from 'src/roles/constants/role.constants';
import { CreateJobDto } from './dto/create-job.dto';
import { TriggerJobDto } from './dto/trigger-job.dto';
import { QueryJobsDto } from './dto/query-jobs.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';

@ApiTags('Job APIs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobService: JobsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN)
  @ApiOperation({
    summary: 'Create a new job',
    description: 'Create a new job with the specified type. ADMIN only.',
  })
  @ApiCreatedResponse({
    description: 'Job created successfully',
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Not authorized - ADMIN role required' })
  @ResponseMessage('Job created successfully')
  async createJob(@Body() createJobDto: CreateJobDto) {
    return await this.jobService.createJob(createJobDto);
  }

  @Post('trigger')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN)
  @ApiOperation({
    summary: 'Trigger/start a job',
    description:
      'Trigger a pending job to start execution. ADMIN only. Job must be in PENDING status.',
  })
  @ApiOkResponse({
    description: 'Job triggered successfully',
  })
  @ApiBadRequestResponse({
    description: 'Job cannot be triggered (invalid status)',
  })
  @ApiNotFoundResponse({ description: 'Job not found' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Not authorized - ADMIN role required' })
  @ResponseMessage('Job triggered successfully')
  async triggerJob(@Body() triggerJobDto: TriggerJobDto) {
    return await this.jobService.triggerJob(triggerJobDto.jobId);
  }

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Get all jobs with filtering',
    description:
      'Get list of jobs with optional filtering by status and type. Public endpoint.',
  })
  @ApiOkResponse({
    description: 'Jobs retrieved successfully',
  })
  @ResponseMessage('Jobs retrieved')
  async getJobs(@Query() queryDto: QueryJobsDto) {
    return await this.jobService.getJobs(queryDto);
  }

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

  @Delete(':id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN)
  @ApiOperation({
    summary: 'Cancel a job',
    description: 'Cancel a pending or processing job. ADMIN only.',
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
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Not authorized - ADMIN role required' })
  @ResponseMessage('Job cancelled')
  async cancelJob(@Param('id') jobId: string) {
    await this.jobService.cancelJob(jobId);
    return { cancelled: true };
  }
}
