import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private usersService: UsersService,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('JWT_REFRESH_TOKEN_SECRET'),
      passReqToCallback: false,
    });
  }

  async validate(payload: any) {
    const user = await this.usersService.findOneByUsername(payload.email);
    if (!user) throw new UnauthorizedException();
    if (payload.version !== user.refreshTokenVersion) {
      throw new UnauthorizedException('Token version mismatch');
    }
    return user;
  }
}
