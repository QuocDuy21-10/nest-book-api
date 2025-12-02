import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../decorator/customize';
import { SystemRole, ROLE_SUCCESS_MESSAGES } from './constants/role.constants';

@ApiTags('Role')
@Controller('roles')
@UseGuards(RolesGuard)
@Roles(SystemRole.ADMIN)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Tạo role mới',
    description:
      'Admin tạo role mới với danh sách permissions. Role name phải unique và viết hoa.',
  })
  async create(@Body() createRoleDto: CreateRoleDto) {
    const role = await this.rolesService.create(createRoleDto);
    return {
      message: ROLE_SUCCESS_MESSAGES.ROLE_CREATED,
      data: role,
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lấy danh sách tất cả roles',
    description: 'Admin xem danh sách tất cả roles trong hệ thống',
  })
  @ApiQuery({
    name: 'includeDeleted',
    required: false,
    type: Boolean,
    description: 'Có bao gồm các role đã xóa hay không',
  })
  async findAll(@Query('includeDeleted') includeDeleted?: string) {
    const roles = await this.rolesService.findAll(
      includeDeleted === 'true',
    );
    return {
      message: ROLE_SUCCESS_MESSAGES.ROLES_FETCHED,
      data: roles,
      total: roles.length,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lấy thông tin chi tiết role theo ID',
    description: 'Admin xem chi tiết một role cụ thể',
  })
  @ApiParam({
    name: 'id',
    description: 'MongoDB ObjectId của role',
    example: '507f1f77bcf86cd799439011',
  })
  async findOne(@Param('id') id: string) {
    const role = await this.rolesService.findOne(id);
    return {
      message: ROLE_SUCCESS_MESSAGES.ROLE_FETCHED,
      data: role,
    };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cập nhật role',
    description:
      'Admin cập nhật thông tin role. Không thể cập nhật role hệ thống (ADMIN, USER)',
  })
  @ApiParam({
    name: 'id',
    description: 'MongoDB ObjectId của role',
    example: '507f1f77bcf86cd799439011',
  })
  async update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    const role = await this.rolesService.update(id, updateRoleDto);
    return {
      message: ROLE_SUCCESS_MESSAGES.ROLE_UPDATED,
      data: role,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Xóa role',
    description:
      'Admin xóa role (soft delete). Không thể xóa role hệ thống (ADMIN, USER) hoặc role đang được sử dụng',
  })
  @ApiParam({
    name: 'id',
    description: 'MongoDB ObjectId của role',
    example: '507f1f77bcf86cd799439011',
  })
  async remove(@Param('id') id: string) {
    const result = await this.rolesService.remove(id);
    return {
      message: ROLE_SUCCESS_MESSAGES.ROLE_DELETED,
      data: result,
    };
  }
}

