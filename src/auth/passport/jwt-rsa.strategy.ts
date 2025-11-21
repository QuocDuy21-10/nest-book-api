import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { KeyTokenService } from '../services/key-token.service';
import { UsersService } from 'src/users/users.service';
import { IUser } from 'src/users/users.interface';

@Injectable()
export class JwtRsaStrategy extends PassportStrategy(Strategy, 'jwt-rsa') {
  private readonly logger = new Logger(JwtRsaStrategy.name);

  constructor(
    private readonly keyTokenService: KeyTokenService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: async (request, rawJwtToken, done) => {
        try {
          const [, payloadBase64] = rawJwtToken.split('.');
          const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());

          if (!payload.jti || !payload._id) {
            return done(new UnauthorizedException('Invalid token payload'), undefined);
          }

          const publicKey = await this.keyTokenService.getPublicKey(
            payload._id,
            payload.jti,
          );

          if (!publicKey) {
            return done(new UnauthorizedException('Public key not found or revoked'), undefined);
          }

          // Return Public Key to verify passport
          done(null, publicKey);
        } catch (error) {
          this.logger.error('Failed to retrieve public key', error.stack);
          done(new UnauthorizedException('Token verification failed'), undefined);
        }
      },
      algorithms: ['RS256'],
    });
  }


  async validate(payload: IUser & { jti: string }): Promise<any> {
    try {
      const user = await this.usersService.findOne(payload._id);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (user.refreshTokenVersion > payload.refreshTokenVersion) {
        // User has logged out all devices
        await this.keyTokenService.revokeKey(payload._id, payload.jti);
        throw new UnauthorizedException('Token revoked (Logout All executed)');
      }

      const { _id, name, email } = payload;
      return {
        _id,
        name,
        email,
        refreshTokenVersion: user.refreshTokenVersion,
        jti: payload.jti, // Keep keyId for possible revocation later
      };
    } catch (error) {
      this.logger.error('JWT validation failed', error.stack);
      throw error;
    }
  }
}
