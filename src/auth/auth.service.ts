import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { RegisterUserDto } from 'src/users/dto/create-user.dto';
import { ConfigService } from '@nestjs/config';
import { IUser } from 'src/users/users.interface';
import { response, Response } from 'express';
import ms from 'ms';
import { KeyTokenService } from './services/key-token.service';
import { randomUUID } from 'crypto';
import { SessionsService } from 'src/sessions/sessions.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private keyTokenService: KeyTokenService,
    private sessionsService: SessionsService,
  ) {}
  hashPassword(password: string) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    return hash;
  }
  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.usersService.findOneByUsername(username);
    if (user) {
      const isValid = await this.usersService.isValidPassword(
        pass,
        user.password,
      );
      if (isValid) {
        return user;
      }
    }
    return null;
  }

  async register(user: RegisterUserDto) {
    let newUser = await this.usersService.register(user);
    return {
      _id: newUser?._id,
      createAt: newUser?.createdAt,
    };
  }

async login( user: IUser, response: Response, ip?: string, device?: string) {
    const { _id, name, email, refreshTokenVersion } = user;
    const payload = { sub: 'token login', iss: 'from server', _id, name, email, refreshTokenVersion };
    
    const refresh_token = this.createRefreshToken(payload);

    await this.sessionsService.createSession(_id.toString(), refresh_token, device, ip);

    // Set cookie
    response.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      maxAge: ms(this.configService.get<string>('JWT_REFRESH_EXPIRES_IN')),
    });

    return {
      access_token: this.jwtService.sign(payload),
      user: { _id, name, email },
    };
  }
  
  async logout(refreshToken: string, response: Response) {
      await this.sessionsService.deleteSession(refreshToken);
      response.clearCookie('refresh_token');
      return 'Logout success';
  }
  
  async logoutAll(userId: string,currentRefreshToken: string, device: string, ip: string, response: Response) {
    await this.sessionsService.deleteUserSessionsExcept(userId, currentRefreshToken);
    await this.usersService.incRefreshTokenVersion(userId);
    await this.sessionsService.deleteSession(currentRefreshToken);
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const { _id, name, email, refreshTokenVersion } = user as any;

    const payload = { sub: 'token refresh', iss: 'from server', _id, name, email, refreshTokenVersion };
    
    const newRefreshToken = this.createRefreshToken(payload);

    await this.sessionsService.createSession(_id.toString(), newRefreshToken, device, ip);
     response.clearCookie('refresh_token');
    response.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      maxAge: ms(this.configService.get<string>('JWT_REFRESH_EXPIRES_IN')),
    });

    // 5. Trả về Access Token mới
    return {
      access_token: this.jwtService.sign(payload),
      message: 'Logged out from other devices. Your session is updated.',
    };
  }

async refreshAccessToken(user: any, oldRefreshToken: string, device: string, ip: string, response: Response) {
    
    await this.sessionsService.deleteSession(oldRefreshToken);

    const { _id, name, email, refreshTokenVersion } = user;
    const payload = { sub: 'token refresh', iss: 'from server', _id, name, email, refreshTokenVersion };
    
    const newRefreshToken = this.createRefreshToken(payload);

    await this.sessionsService.createSession(_id.toString(), newRefreshToken, device, ip);

    response.clearCookie('refresh_token');
    response.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      maxAge: ms(this.configService.get<string>('JWT_REFRESH_EXPIRES_IN')),
    });

    return {
      access_token: this.jwtService.sign(payload),
    };
  }

    createRefreshToken(payload: any) {
    const refresh_token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET'),
      expiresIn: ms(this.configService.get<string>('JWT_REFRESH_EXPIRES_IN')) / 1000,
    });
    return refresh_token;
  }

  async loginRSA(user: IUser): Promise<{ access_token: string; user: any; keyId: string }> {
    const { _id, name, email, refreshTokenVersion } = user;

    const keyId = randomUUID();

    // Generate RSA Key Pair 
    const { privateKey, publicKey } = this.keyTokenService.generateKeyPair();

    await this.keyTokenService.savePublicKey(_id.toString(), publicKey, keyId);

    const payload = {
      sub: 'token login rsa',
      iss: 'from server',
      jti: keyId, 
      _id,
      name,
      email,
      refreshTokenVersion,
    };

    const access_token = this.jwtService.sign(payload, {
      secret: privateKey,
      algorithm: 'RS256',
      expiresIn: '1h', 
    });

    return {
      access_token,
      user: { _id, name, email },
      keyId, 
    };
  }

  async verifyRSAToken(token: string): Promise<any> {
    try {
      // Decode JWT header to get jti (without verifying)
      const decoded = this.jwtService.decode(token, { complete: true }) as any;
      
      if (!decoded || !decoded.payload.jti) {
        throw new BadRequestException('Invalid token format');
      }

      const { jti, _id } = decoded.payload;

      const publicKey = await this.keyTokenService.getPublicKey(_id, jti);

      if (!publicKey) {
        throw new BadRequestException('Public key not found or revoked');
      }

      const payload = this.jwtService.verify(token, {
        secret: publicKey,
        algorithms: ['RS256'],
      });

      // Check refreshTokenVersion (log out all)
      const user = await this.usersService.findOne(_id);
      if (!user) {
        throw new BadRequestException('User not found');
      }

      if (user.refreshTokenVersion > payload.refreshTokenVersion) {
        throw new BadRequestException('Token revoked (Logout All executed)');
      }

      return payload;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new BadRequestException('Token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new BadRequestException('Invalid token');
      }
      throw error;
    }
  }

  //  Revoke all keys of a user
  async revokeAllRSAKeys(userId: string): Promise<number> {
    return this.keyTokenService.revokeAllUserKeys(userId);
  }
}
