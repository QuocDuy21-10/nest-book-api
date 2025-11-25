import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class TriggerJobDto {
  @ApiProperty({
    description: 'Job ID to trigger',
    example: '67890abcdef1234567890123',
  })
  @IsNotEmpty({ message: 'Job ID is required' })
  @IsMongoId({ message: 'Invalid job ID format' })
  jobId: string;

  @ApiProperty({
    description: 'Optional parameters for job execution',
    required: false,
    example: { limit: 100, category: 'books' },
  })
  @IsOptional()
  @IsObject()
  params?: Record<string, any>;
}
