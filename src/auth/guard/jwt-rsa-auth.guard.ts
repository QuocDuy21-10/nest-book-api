import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtRsaAuthGuard extends AuthGuard('jwt-rsa') {}
