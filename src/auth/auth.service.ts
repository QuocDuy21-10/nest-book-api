import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { RegisterUserDto } from 'src/users/dto/create-user.dto';
import { ConfigService } from '@nestjs/config';
import { IUser } from 'src/users/users.interface';
import { response, Response } from 'express';
import ms from 'ms';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
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

    await this.usersService.createSession(_id.toString(), refresh_token, device, ip);

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
      await this.usersService.deleteSession(refreshToken);
      response.clearCookie('refresh_token');
      return 'Logout success';
  }
  
  async logoutAll(userId: string, response: Response) {
      await this.usersService.logoutAll(userId);
      response.clearCookie('refresh_token');
      return 'Logout from all devices success';
  }

async refreshAccessToken(user: any, oldRefreshToken: string, response: Response) {
    
    await this.usersService.deleteSession(oldRefreshToken);

    const { _id, name, email, refreshTokenVersion } = user;
    const payload = { sub: 'token refresh', iss: 'from server', _id, name, email, refreshTokenVersion };
    
    const newRefreshToken = this.createRefreshToken(payload);

    await this.usersService.createSession(_id.toString(), newRefreshToken);

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
}
