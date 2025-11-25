import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { User, UserDocument } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class DatabasesService implements OnModuleInit {
  private readonly logger = new Logger(DatabasesService.name);
  constructor(
    @InjectModel(User.name) private userModel: SoftDeleteModel<UserDocument>,
    private configService: ConfigService,
    private userService: UsersService,
  ) {}
  async onModuleInit() {
    const isInit = this.configService.get<string>('NODE_ENV') === 'development';
    if (isInit) {
      const countUser = await this.userModel.countDocuments({});
      if (countUser === 0) {
        await this.userModel.insertMany([
          {
            _id: '647b5108a8a243e8191855b5',
            name: 'Admin',
            email: 'admin@gmail.com',
            password: this.userService.hashPassword(
              this.configService.get<string>('INIT_PASSWORD') || '123456',
            ),
            role: 'ADMIN',
          },
          {
            name: 'User',
            email: 'user@gmail.com',
            password: this.userService.hashPassword(
              this.configService.get<string>('INIT_PASSWORD') || '123456',
            ),
            role: 'USER',
          },
        ]);
        this.logger.log('>>> INIT SAMPLE USERS: ADMIN & USER');
      } else {
        this.logger.log('>>> ALREADY INIT SAMPLE DATA...');
      }
    }
  }
}
