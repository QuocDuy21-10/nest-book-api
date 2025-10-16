import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { AuthorsService } from './authors.service';
import { CreateAuthorDto } from './dto/create-author.dto';
import { UpdateAuthorDto } from './dto/update-author.dto';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Public, ResponseMessage } from 'src/decorator/customize';

@ApiTags('Authors APIs')
@Controller('authors')
export class AuthorsController {
  constructor(private readonly authorsService: AuthorsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create new author',
    description: 'Create a new author with name, bio, books, etc.',
  })
  @ApiCreatedResponse({ description: 'Author created successfully' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ResponseMessage('Create author')
  create(@Body() createAuthorDto: CreateAuthorDto) {
    return this.authorsService.create(createAuthorDto);
  }

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Get list of authors',
    description: 'Get paginated list of authors',
  })
  @ApiQuery({
    name: 'current',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
  })
  @ApiOkResponse({ description: 'List of authors' })
  @ResponseMessage('List of authors')
  findAll(
    @Query('current') currentPage: string,
    @Query('pageSize') limit: string,
    @Query() query: string,
  ) {
    return this.authorsService.findAll(+currentPage, +limit, query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Get author detail',
    description: 'Get author by ID',
  })
  @ApiOkResponse({ description: 'Author detail retrieved' })
  @ApiNotFoundResponse({ description: 'Author not found' })
  @ResponseMessage('Author detail')
  findOne(@Param('id') id: string) {
    return this.authorsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update author',
    description: 'Update author information by ID',
  })
  @ApiOkResponse({ description: 'Author updated successfully' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ResponseMessage('Update author')
  update(@Param('id') id: string, @Body() updateAuthorDto: UpdateAuthorDto) {
    return this.authorsService.update(id, updateAuthorDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete author',
    description: 'Delete author by ID',
  })
  @ApiOkResponse({ description: 'Author deleted successfully' })
  @ApiNotFoundResponse({ description: 'Author not found' })
  @ResponseMessage('Delete author successfully')
  remove(@Param('id') id: string) {
    return this.authorsService.remove(id);
  }
}
