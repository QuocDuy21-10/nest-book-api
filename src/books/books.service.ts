import {
  BadRequestException,
  Injectable,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import mongoose from 'mongoose';
import aqp from 'api-query-params';
import { InjectModel } from '@nestjs/mongoose';
import { Book, BookDocument } from './schemas/book.schema';
import type { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { IUser } from 'src/users/users.interface';
import { KAFKA_SERVICE } from 'src/common/constants';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class BooksService {
  constructor(
    @InjectModel(Book.name) private bookModel: SoftDeleteModel<BookDocument>,
    @Inject(KAFKA_SERVICE) private kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    // Subscribe to response topics if needed
    this.kafkaClient.subscribeToResponseOf('book-log-events');
    await this.kafkaClient.connect();
  }

  async onModuleDestroy() {
    await this.kafkaClient.close();
  }

  async create(
    createBookDto: CreateBookDto,
    user?: IUser,
    ip?: string,
  ): Promise<Book> {
    if (!createBookDto.title?.trim()) {
      throw new BadRequestException('Title is required and cannot be empty');
    }
    const newBook = await this.bookModel.create({
      ...createBookDto,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Emit event to Kafka
    this.kafkaClient.emit('book-log-events', {
      eventType: 'BOOK_CREATED',
      timestamp: new Date().toISOString(),
      bookId: newBook._id,
      userId: user?._id || null,
      ipAddress: ip || 'unknown',
    });

    return newBook;
  }

  async findAll(
    currentPage: number,
    limit: number,
    query: string,
    user?: IUser,
    ip?: string,
  ): Promise<{
    result: Book[];
    meta: {
      currentPage: number;
      pageSize: number;
      totalPages: number;
      totalItems: number;
    };
  }> {
    const { filter, sort, population, projection } = aqp(query);

    delete filter.current;
    delete filter.pageSize;

    let offset = (currentPage - 1) * limit;
    let defaultLimit = limit ? limit : 10;

    if (!user) {
      filter.isPremium = false;
    }

    const totalItems = (await this.bookModel.find(filter)).length;
    const totalPages = Math.ceil(totalItems / defaultLimit);

    const result = await this.bookModel
      .find(filter)
      .skip(offset)
      .limit(defaultLimit)
      .sort(sort as any)
      .populate(population)
      .select(projection as any)
      .exec();

    this.kafkaClient.emit('book-log-events', {
      eventType: 'BOOK_READ_ACCESS',
      timestamp: new Date().toISOString(),
      userId: user?._id || null,
      ipAddress: ip || 'unknown',
    });

    return {
      result,
      meta: {
        currentPage,
        pageSize: limit,
        totalPages,
        totalItems,
      },
    };
  }

  async findOne(id: string, user?: IUser, ip?: string): Promise<Book> {
    this.validateObjectId(id);
    const book = await this.bookModel
      .findById(id)
      .populate({
        path: 'authors',
        select: {
          name: 1,
          bio: 1,
          birthDate: 1,
        },
      })
      .exec();

    if (!book) {
      throw new BadRequestException('Book not found');
    }

    if (book.isPremium && !user) {
      throw new ForbiddenException(
        'This book is premium. Please login to view.',
      );
    }

    // Emit event to Kafka
    this.kafkaClient.emit('book-log-events', {
      eventType: 'BOOK_DETAIL_ACCESS',
      timestamp: new Date().toISOString(),
      bookId: book._id,
      userId: user?._id || null,
      ipAddress: ip || 'unknown',
    });

    return book;
  }

  async update(
    id: string,
    updateBookDto: UpdateBookDto,
    user?: IUser,
    ip?: string,
  ) {
    this.validateObjectId(id);
    if (updateBookDto.title !== undefined && !updateBookDto.title?.trim()) {
      throw new BadRequestException('Title cannot be empty');
    }
    const bookUpdated = await this.bookModel
      .updateOne(
        { _id: id },
        { ...updateBookDto, updatedAt: new Date().toISOString() },
      )
      .exec();

    // Emit event to Kafka
    this.kafkaClient.emit('book-log-events', {
      eventType: 'BOOK_UPDATED',
      timestamp: new Date().toISOString(),
      bookId: id,
      userId: user?._id || null,
      ipAddress: ip || 'unknown',
    });

    return bookUpdated;
  }

  async remove(id: string, user?: IUser, ip?: string) {
    this.validateObjectId(id);
    const bookDeleted = await this.bookModel.softDelete({ _id: id });

    // Emit event to Kafka
    this.kafkaClient.emit('book-log-events', {
      eventType: 'BOOK_DELETED',
      timestamp: new Date().toISOString(),
      bookId: id,
      userId: user?._id || null,
      ipAddress: ip || 'unknown',
    });

    return bookDeleted;
  }

  private validateObjectId(id: string): void {
    if (!id?.trim() || !mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID format');
    }
  }
}
