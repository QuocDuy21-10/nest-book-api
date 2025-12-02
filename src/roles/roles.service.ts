import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Role, RoleDocument } from './schemas/role.schemas';
import {
  ROLE_ERROR_MESSAGES,
} from './constants/role.constants';
import { isValidPermission } from './enums/permission.enum';
import type { SoftDeleteModel } from 'soft-delete-plugin-mongoose';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    @InjectModel(Role.name)
    private readonly roleModel: SoftDeleteModel<RoleDocument>,
  ) {}

  async create(createRoleDto: CreateRoleDto): Promise<Role> {
    await this.validateUniqueRoleName(createRoleDto.name);

    if (createRoleDto.permissions && createRoleDto.permissions.length > 0) {
      this.validatePermissions(createRoleDto.permissions);
    }

    const newRole = await this.roleModel.create({
      ...createRoleDto,
      name: createRoleDto.name.toUpperCase(),
      permissions: createRoleDto.permissions || [],
      isActive: createRoleDto.isActive ?? true,
      isSystemRole: false,
    });

    return newRole;
  }

  async findAll(includeDeleted: boolean = false): Promise<Role[]> {
    const filter = includeDeleted ? {} : { isDeleted: false };

    const roles = await this.roleModel
      .find(filter)
      .sort({ createdAt: -1 })
      .exec();

    return roles;
  }

  async findOne(id: string): Promise<Role> {
    this.validateObjectId(id);

    const role = await this.roleModel
      .findOne({ _id: id, isDeleted: false })
      .exec();

    if (!role) {
      this.logger.warn(`Role not found with id: ${id}`);
      throw new NotFoundException(ROLE_ERROR_MESSAGES.ROLE_NOT_FOUND);
    }

    return role;
  }

  async findByName(name: string): Promise<Role> {
    const role = await this.roleModel
      .findOne({ name: name.toUpperCase(), isDeleted: false })
      .exec();

    if (!role) {
      this.logger.warn(`Role not found with name: ${name}`);
      throw new NotFoundException(ROLE_ERROR_MESSAGES.ROLE_NOT_FOUND);
    }

    return role;
  }

  async update(id: string, updateRoleDto: UpdateRoleDto): Promise<Role> {
    this.validateObjectId(id);
    const existingRole = await this.findOne(id);

    if (existingRole.isSystemRole) {
      this.logger.warn(
        `Attempt to update protected role: ${existingRole.name}`,
      );
      throw new BadRequestException(
        ROLE_ERROR_MESSAGES.CANNOT_UPDATE_PROTECTED_ROLE,
      );
    }
    if (updateRoleDto.name && updateRoleDto.name !== existingRole.name) {
      await this.validateUniqueRoleName(updateRoleDto.name);
    }

    if (updateRoleDto.permissions && updateRoleDto.permissions.length > 0) {
      this.validatePermissions(updateRoleDto.permissions);
    }

    if (updateRoleDto.name) {
      updateRoleDto.name = updateRoleDto.name.toUpperCase();
    }

    const updatedRole = await this.roleModel
      .findByIdAndUpdate(
        id,
        { $set: updateRoleDto },
        { new: true, runValidators: true },
      )
      .exec();

    if (!updatedRole) {
      throw new NotFoundException(ROLE_ERROR_MESSAGES.ROLE_NOT_FOUND);
    }

    this.logger.log(`Role updated successfully: ${updatedRole.name}`);
    return updatedRole;
  }

  async remove(id: string): Promise<{ message: string }> {
    this.validateObjectId(id);
    const role = await this.findOne(id);

    if (role.isSystemRole) {
      this.logger.warn(`Attempt to delete protected role: ${role.name}`);
      throw new BadRequestException(
        ROLE_ERROR_MESSAGES.CANNOT_DELETE_PROTECTED_ROLE,
      );
    }
    const roleDeleted = await this.roleModel.softDelete({ _id: id });
    return { message: 'Role deleted successfully' };
  }
  private validateObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid role ID format');
    }
  }

  private async validateUniqueRoleName(name: string): Promise<void> {
    const existingRole = await this.roleModel
      .findOne({ name: name.toUpperCase(), isDeleted: false })
      .exec();

    if (existingRole) {
      this.logger.warn(`Role name already exists: ${name}`);
      throw new ConflictException(ROLE_ERROR_MESSAGES.ROLE_ALREADY_EXISTS);
    }
  }

  private validatePermissions(permissions: string[]): void {
    const invalidPermissions = permissions.filter(
      (permission) => !isValidPermission(permission),
    );

    if (invalidPermissions.length > 0) {
      this.logger.warn(
        `Invalid permissions detected: ${invalidPermissions.join(', ')}`,
      );
      throw new BadRequestException(
        `${ROLE_ERROR_MESSAGES.INVALID_PERMISSIONS}: ${invalidPermissions.join(', ')}`,
      );
    }
  }
  async exists(id: string): Promise<boolean> {
    this.validateObjectId(id);
    const count = await this.roleModel
      .countDocuments({ _id: id, isDeleted: false })
      .exec();
    return count > 0;
  }
}

