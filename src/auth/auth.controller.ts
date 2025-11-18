
import { Controller, Post, Body, Req, UseGuards, Res, Ip } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public, ResponseMessage, User } from 'src/decorator/customize';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { LoginUserDto, RegisterUserDto } from 'src/users/dto/create-user.dto';
import { LocalAuthGuard } from './local-auth.guard';
import type { Response, Request } from 'express';
import type { IUser } from 'src/users/users.interface';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Auth APIs')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }
  @Public()
  @UseGuards(LocalAuthGuard)
  @ApiBody({ type: LoginUserDto })
  @Post('/login')
  @ResponseMessage('Login')
  handleLogin(@Req() req, @Res({ passthrough: true }) response: Response, @Ip() ip: string ) {
    const device = req.headers['user-agent'] || 'Unknown Device';
    return this.authService.login(req.user, response, ip, device );
  }

  @Public()
  @Post('/register')
  @ResponseMessage('Register a new user')
  handleRegister(@Body() RegisterUserDto: RegisterUserDto) {
    return this.authService.register(RegisterUserDto);
  }

  @Public()
  @UseGuards(AuthGuard('jwt-refresh')) 
  @Post('/refresh-token')
  @ResponseMessage('Refresh access token')
  handleRefreshToken(@Req() request: Request, @User() user, @Res({ passthrough: true }) response: Response) {
    const refreshToken = request.cookies['refresh_token'];
    return this.authService.refreshAccessToken(user, refreshToken, response);
  }

  @Post('/logout')
  @ResponseMessage('Logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
      const refreshToken = request.cookies['refresh_token'];
      return this.authService.logout(refreshToken, response);
  }

  @Post('/logout-all')
  @ResponseMessage('Logout from all devices')
  async logoutAll(@User() user: IUser, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.logoutAll(user._id, response);
    return result;
  }
}