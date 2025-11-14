import { Controller, Post, Body, Req, UseGuards, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public, ResponseMessage, User } from 'src/decorator/customize';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { LoginUserDto, RegisterUserDto } from 'src/users/dto/create-user.dto';
import { LocalAuthGuard } from './local-auth.guard';
import type { Response, Request } from 'express';
import type { IUser } from 'src/users/users.interface';

@ApiTags('Auth APIs')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}
  @Public()
  @UseGuards(LocalAuthGuard)
  @ApiBody({ type: LoginUserDto })
  @Post('/login')
  @ResponseMessage('Login')
  handleLogin(@Req() req) {
    return this.authService.login(req.user);
  }

  @Public()
  @Post('/register')
  @ResponseMessage('Register a new user')
  handleRegister(@Body() RegisterUserDto: RegisterUserDto) {
    return this.authService.register(RegisterUserDto);
  }

  @Public()
  @Post('/refresh-token')
  @ResponseMessage('Refresh access token')
  handleRefreshToken(@Req() request : Request, @Res({ passthrough: true }) response : Response, @User() user: IUser) {
    const refreshToken = request.cookies['refresh_token'];
    return this.authService.refreshAccessToken(refreshToken, response, user);
  }
}