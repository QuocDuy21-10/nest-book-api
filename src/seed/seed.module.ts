import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SeedService } from './seed.service';
import { User, UserSchema } from 'src/users/schemas/user.schema';
import { Book, BookSchema } from 'src/books/schemas/book.schema';
import { Author, AuthorSchema } from 'src/authors/schemas/author.schema';
import { softDeletePlugin } from 'soft-delete-plugin-mongoose';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URL'),
        connectionFactory: (connection) => {
          connection.plugin(softDeletePlugin);
          return connection;
        },
      }),
      inject: [ConfigService],
    }),

    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Book.name, schema: BookSchema },
      { name: Author.name, schema: AuthorSchema },
    ]),
  ],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
