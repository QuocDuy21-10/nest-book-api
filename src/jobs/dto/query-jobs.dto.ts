import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { JobStatus } from '../enum/job-status.enum';
export class QueryJobsDto {
  @ApiPropertyOptional({
    description: 'Filter by job status',
    enum: JobStatus,
    example: JobStatus.COMPLETED,
  })
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @ApiPropertyOptional({
    description: 'Filter by job type',
    example: 'CRAWL_TIKI_BOOKS',
  })
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({
    description: 'Number of jobs to return',
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
