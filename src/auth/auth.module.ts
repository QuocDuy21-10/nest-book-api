import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from 'src/users/users.module';
import { RolesModule } from 'src/roles/roles.module';
import { LocalStrategy } from './passport/local.strategy';
import { JwtStrategy } from './passport/jwt.strategy';
import { JwtRefreshStrategy } from './passport/jwt-refresh.strategy';
import { JwtRsaStrategy } from './passport/jwt-rsa.strategy';
import { MongooseModule } from '@nestjs/mongoose';
import { KeyToken, KeyTokenSchema } from './schemas/key-token.schema';
import { KeyTokenService } from './services/key-token.service';
import { SessionsModule } from 'src/sessions/sessions.module';

@Module({
  imports: [
    UsersModule,
    RolesModule,
    SessionsModule,
    PassportModule,
    MongooseModule.forFeature([
      { name: KeyToken.name, schema: KeyTokenSchema },
    ]),
    JwtModule.registerAsync({
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_TOKEN_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_ACCESS_EXPIRES_IN'),
        },
      }),
      inject: [ConfigService], // Inject ConfigService into the factory
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService, 
    KeyTokenService,
    LocalStrategy, 
    JwtStrategy, 
    JwtRefreshStrategy,
    JwtRsaStrategy,
  ],
  exports: [KeyTokenService], 
})
export class AuthModule {}
