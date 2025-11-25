import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
export class CreateJobDto {
  @ApiProperty({
    description: 'Type of the job to create',
    example: 'CRAWL_TIKI_BOOKS',
    enum: ['CRAWL_TIKI_BOOKS', 'MANUAL_JOB', 'SCHEDULED_JOB'],
  })
  @IsNotEmpty({ message: 'Job type is required' })
  @IsString()
  type: string;

  @ApiProperty({
    description: 'Optional description for the job',
    example: 'Crawl books from Tiki marketplace',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}
