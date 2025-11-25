import { Module } from '@nestjs/common';
import { DatabasesService } from './databases.service';
import { DatabasesController } from './databases.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/users/schemas/user.schema';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [DatabasesController],
  providers: [DatabasesService],
})
export class DatabasesModule {}
