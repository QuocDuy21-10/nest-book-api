import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../../decorator/customize';
import { Permission } from '../../roles/enums/permission.enum';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    this.logger.debug(`Checking permissions for user: ${user?.email}`);
    this.logger.debug(
      `Required permissions: ${requiredPermissions.join(', ')}`,
    );

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    const userPermissions: Permission[] = user.permissions || [];

    this.logger.debug(`User permissions: ${userPermissions.join(', ')}`);

    const hasAllPermissions = requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );

    if (!hasAllPermissions) {
      const missingPermissions = requiredPermissions.filter(
        (permission) => !userPermissions.includes(permission),
      );

      this.logger.warn(
        `User: ${user.email} missing permissions: ${missingPermissions.join(', ')}`,
      );

      throw new ForbiddenException(
        `Missing required permissions: ${missingPermissions.join(', ')}`,
      );
    }

    this.logger.debug(`User ${user.email} has all required permissions`);
    return true;
  }
}

