import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_OPTIONAL_AUTH, IS_PUBLIC_KEY } from 'src/decorator/customize';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const isOptionalAuth = this.reflector.getAllAndOverride<boolean>(
      IS_OPTIONAL_AUTH,
      [context.getHandler(), context.getClass()],
    );

    // If route is marked as OptionalAuth, always allow through
    if (isOptionalAuth) {
      return super.canActivate(context) as Promise<boolean> | boolean;
    }
    return super.canActivate(context);
  }

  handleRequest(err, user: any, info: any, context: ExecutionContext) {
    const isOptionalAuth = this.reflector.getAllAndOverride<boolean>(
      IS_OPTIONAL_AUTH,
      [context.getHandler(), context.getClass()],
    );
    // If optional auth and no user, just return undefined (not an error)
    if (isOptionalAuth) {
      return user || undefined;
    }

    if (err || !user) {
      throw err || new UnauthorizedException('Token is invalid or expired');
    }
    return user;
  }
}
