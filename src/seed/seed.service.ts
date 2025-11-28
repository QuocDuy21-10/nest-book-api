import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from 'src/users/schemas/user.schema';
import { Book, BookDocument } from 'src/books/schemas/book.schema';
import { Author, AuthorDocument } from 'src/authors/schemas/author.schema';
import { usersSeedData } from './data/users.seed';
import { booksSeedData } from './data/books.seed';
import { authorsSeedData } from './data/authors.seed';
import * as bcrypt from 'bcryptjs';

/**
 * SeedService handles database seeding operations
 * Following best practices from NestJS documentation
 */
@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Book.name) private bookModel: Model<BookDocument>,
    @InjectModel(Author.name) private authorModel: Model<AuthorDocument>,
  ) {}

  async seed() {
    this.logger.log('Starting database seeding...');

    if (process.env.NODE_ENV !== 'development') {
      this.logger.warn(
        'Seeding is only allowed in development environment',
      );
      return;
    }

    try {
      await this.seedAuthors();
      await this.seedBooks();
      await this.seedUsers();

      this.logger.log('Database seeding completed successfully!');
    } catch (error) {
      this.logger.error('Seeding failed:', error);
      throw error;
    }
  }
  private async seedAuthors() {
    const existingCount = await this.authorModel.countDocuments();

    if (existingCount > 0) {
      this.logger.log(
        `Skipping authors seeding (${existingCount} already exist)`,
      );
      return;
    }

    const authors = await this.authorModel.insertMany(authorsSeedData);
    this.logger.log(`Seeded ${authors.length} authors`);
  }

  private async seedBooks() {
    const existingCount = await this.bookModel.countDocuments();

    if (existingCount > 0) {
      this.logger.log(
        `Skipping books seeding (${existingCount} already exist)`,
      );
      return;
    }

    const authors = await this.authorModel.find().limit(6);

    if (authors.length === 0) {
      this.logger.warn('No authors found. Skipping books seeding.');
      return;
    }

    const booksToInsert = booksSeedData.map((book, index) => ({
      ...book,
      authors: [authors[index % authors.length]._id],
    }));

    const books = await this.bookModel.insertMany(booksToInsert);
    this.logger.log(`Seeded ${books.length} books`);
  }

  private async seedUsers() {
    const existingCount = await this.userModel.countDocuments();

    if (existingCount > 0) {
      this.logger.log(
        `Skipping users seeding (${existingCount} already exist)`,
      );
      return;
    }

    const usersToInsert = await Promise.all(
      usersSeedData.map(async (user) => ({
        ...user,
        password: await bcrypt.hash(user.password, 10),
      })),
    );

    const users = await this.userModel.insertMany(usersToInsert);
    this.logger.log(`Seeded ${users.length} users`);
    this.logger.log('User credentials:');
    usersSeedData.forEach((user) => {
      this.logger.log(`   - ${user.email} / ${user.password} (${user.role})`);
    });
  }

  async clear() {
    if (process.env.NODE_ENV !== 'development') {
      throw new Error('Clear operation is only allowed in development');
    }

    this.logger.log('Clearing all data...');

    await this.userModel.deleteMany({});
    await this.bookModel.deleteMany({});
    await this.authorModel.deleteMany({});

    this.logger.log('All data cleared');
  }
}
