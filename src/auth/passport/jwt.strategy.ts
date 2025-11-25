import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IUser } from 'src/users/users.interface';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
private readonly usersService: UsersService, // Inject Service
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_TOKEN_SECRET'),
    });
  }

  // decode payload
  async validate(payload: IUser) {
    const user = await this.usersService.findOne(payload._id);

    if (!user) {
        throw new UnauthorizedException('User not found');
    }

    if (user.refreshTokenVersion > payload.refreshTokenVersion) {
       throw new UnauthorizedException('Token revoked (Logout All executed)');
    }
    const { _id, name, email, role } = payload;
    //req.user
    return {
      _id,
      name,
      email,
      role,
      refreshTokenVersion: user.refreshTokenVersion
    };
  }
}
