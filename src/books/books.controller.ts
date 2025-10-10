import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  UseInterceptors,
  Inject,
} from '@nestjs/common';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  OptionalAuth,
  Public,
  ResponseMessage,
  User,
} from 'src/decorator/customize';
import type { IUser } from 'src/users/users.interface';
import type { Request } from 'express';
import { LoggingInterceptor } from 'src/core/logging.interceptor';
import { KAFKA_SERVICE } from 'src/common/constants';
import { ClientKafka } from '@nestjs/microservices';

@ApiTags('Books APIs')
@Controller('books')
@UseInterceptors(LoggingInterceptor)
export class BooksController {
  constructor(
    private readonly booksService: BooksService,
    @Inject(KAFKA_SERVICE) private kafkaClient: ClientKafka,
  ) {}

  // Create a new book
  @Post()
  @ApiOperation({
    summary: 'Create new book',
    description:
      'Create a new book with the following information: title, description, author, publishedYear, ...',
  })
  @ApiCreatedResponse({ type: Object, description: 'Create book' })
  @ApiBadRequestResponse({ description: 'Validation fail' })
  @ResponseMessage('Create book')
  create(
    @Body() createBookDto: CreateBookDto,
    @User() user: IUser,
    @Req() req: Request,
  ) {
    return this.booksService.create(createBookDto, user, req.ip);
  }

  // Get list of books with pagination and filtering
  @OptionalAuth()
  @Get()
  @ApiOperation({
    summary: 'Get list of books',
    description: 'Get list of books',
  })
  @ApiOkResponse({ description: 'Success' })
  @ApiOkResponse({ description: 'List of books', type: [Object] })
  @ApiQuery({
    name: 'current',
    required: false,
    type: Number,
    description: 'Current page number',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    description: 'Number of items per page',
  })
  @ResponseMessage('List of books')
  findAll(
    @Query('current') currentPage: string,
    @Query('pageSize') limit: string,
    @Query() query: string,
    @User() user: IUser,
    @Req() req: Request,
  ) {
    return this.booksService.findAll(+currentPage, +limit, query, user, req.ip);
  }

  // Get book details by ID
  @OptionalAuth()
  @Get(':id')
  @ApiOperation({
    summary: 'Get book detail',
    description: 'Get details of a book by ID',
  })
  @ApiOkResponse({ description: 'Book detail', type: Object })
  @ApiNotFoundResponse({ description: 'Book not found' })
  @ResponseMessage('Book detail')
  findOne(@Param('id') id: string, @User() user: IUser, @Req() req: Request) {
    return this.booksService.findOne(id, user, req.ip);
  }

  // Update book information by ID
  @Patch(':id')
  @ApiOperation({
    summary: 'Update book',
    description: 'Update information of a book by ID',
  })
  @ApiOkResponse({ description: 'Update book', type: Object })
  @ApiBadRequestResponse({ description: 'Validation fail' })
  @ResponseMessage('Update book')
  update(
    @Param('id') id: string,
    @Body() updateBookDto: UpdateBookDto,
    @User() user: IUser,
    @Req() req: Request,
  ) {
    return this.booksService.update(id, updateBookDto, user, req.ip);
  }

  // Delete a book by ID
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete book',
    description: 'Delete a book by ID',
  })
  @ApiOkResponse({ description: 'Delete book' })
  @ApiNotFoundResponse({ description: 'Book not found' })
  @ResponseMessage('Delete book successfully')
  remove(@Param('id') id: string, @User() user: IUser, @Req() req: Request) {
    this.booksService.remove(id, user, req.ip);
    return;
  }
}
