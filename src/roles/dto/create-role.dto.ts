import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsArray,
  IsEnum,
  IsOptional,
  IsBoolean,
  ArrayUnique,
  Matches,
} from 'class-validator';
import { Permission } from '../enums/permission.enum';
import { ROLE_VALIDATION } from '../constants/role.constants';

export class CreateRoleDto {
    @IsString()
  @ApiProperty({
    description: 'Tên role (viết hoa, không có khoảng trắng)',
    example: 'COLLABORATOR',
    minLength: ROLE_VALIDATION.NAME_MIN_LENGTH,
    maxLength: ROLE_VALIDATION.NAME_MAX_LENGTH,
  })
  @IsNotEmpty({ message: 'Role name is required' })
  @MinLength(ROLE_VALIDATION.NAME_MIN_LENGTH, {
    message: `Role name must be at least ${ROLE_VALIDATION.NAME_MIN_LENGTH} characters`,
  })
  @MaxLength(ROLE_VALIDATION.NAME_MAX_LENGTH, {
    message: `Role name must not exceed ${ROLE_VALIDATION.NAME_MAX_LENGTH} characters`,
  })
  @Matches(/^[A-Z_]+$/, {
    message: 'Role name must contain only uppercase letters and underscores',
  })
  name: string;

  @IsOptional()
  @ApiPropertyOptional({
    description: 'Mô tả chi tiết về role này',
    example: 'Role cho người cộng tác, có quyền chỉnh sửa và xóa sách',
    maxLength: ROLE_VALIDATION.DESCRIPTION_MAX_LENGTH,
  })
  @IsString()
  @MaxLength(ROLE_VALIDATION.DESCRIPTION_MAX_LENGTH, {
    message: `Description must not exceed ${ROLE_VALIDATION.DESCRIPTION_MAX_LENGTH} characters`,
  })
  description?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Danh sách các quyền được gán cho role',
    example: [Permission.BOOK_UPDATE, Permission.BOOK_DELETE],
    enum: Permission,
    isArray: true,
    required: false,
  })
  @IsArray()
  @IsEnum(Permission, {
    each: true,
    message: 'Each permission must be a valid Permission enum value',
  })
  @ArrayUnique({ message: 'Permissions must be unique' })
  permissions?: Permission[];

  @ApiPropertyOptional({
    description: 'Trạng thái hoạt động của role',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

