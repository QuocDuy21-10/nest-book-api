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
  UseGuards,
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
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  OptionalAuth,
  ResponseMessage,
  User,
  Roles,
  RequirePermissions,
} from 'src/decorator/customize';
import type { IUser } from 'src/users/users.interface';
import type { Request } from 'express';
import { LoggingInterceptor } from 'src/core/logging.interceptor';
import { KAFKA_SERVICE } from 'src/common/constants';
import { ClientKafka } from '@nestjs/microservices';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { SystemRole } from 'src/roles/constants/role.constants';
import { PermissionsGuard } from 'src/auth/guard/permissions.guard';
import { Permission } from 'src/roles/enums/permission.enum';

@ApiTags('Books APIs')
@Controller('books')
@UseInterceptors(LoggingInterceptor)
@UseGuards(PermissionsGuard)
export class BooksController {
  constructor(
    private readonly booksService: BooksService,
    @Inject(KAFKA_SERVICE) private kafkaClient: ClientKafka,
  ) {}

  @Post()
  // @UseGuards( RolesGuard)
  // @Roles(SystemRole.ADMIN)
  @RequirePermissions(Permission.BOOK_CREATE)
  @ApiOperation({
    summary: 'Create new book',
    description:
      'Create a new book with the following information: title, description, author, publishedYear, ... (LIBRARIAN or ADMIN only)',
  })
  @ApiCreatedResponse({ type: Object, description: 'Create book' })
  @ApiBadRequestResponse({ description: 'Validation fail' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Not authorized - LIBRARIAN role required' })
  @ResponseMessage('Create book')
  create(
    @Body() createBookDto: CreateBookDto,
    @User() user: IUser,
    @Req() req: Request,
  ) {
    return this.booksService.create(createBookDto, user, req.ip);
  }

  // Get list of books with pagination and filtering
  @RequirePermissions(Permission.BOOK_LIST)
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
  @RequirePermissions(Permission.BOOK_READ)
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
  @RequirePermissions(Permission.BOOK_UPDATE)
  // @Roles(SystemRole.LIBRARIAN, SystemRole.ADMIN)
  @ApiOperation({
    summary: 'Update book',
    description: 'Update information of a book by ID (LIBRARIAN or ADMIN only)',
  })
  @ApiOkResponse({ description: 'Update book', type: Object })
  @ApiBadRequestResponse({ description: 'Validation fail' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Not authorized - LIBRARIAN role required' })
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
  // @UseGuards(RolesGuard)
  // @Roles(SystemRole.ADMIN)
  @RequirePermissions(Permission.BOOK_DELETE)
  @ApiOperation({
    summary: 'Delete book',
    description: 'Delete a book by ID (LIBRARIAN or ADMIN only)',
  })
  @ApiOkResponse({ description: 'Delete book' })
  @ApiNotFoundResponse({ description: 'Book not found' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Not authorized - LIBRARIAN role required' })
  @ResponseMessage('Delete book successfully')
  remove(@Param('id') id: string, @User() user: IUser, @Req() req: Request) {
    this.booksService.remove(id, user, req.ip);
    return;
  }
}
