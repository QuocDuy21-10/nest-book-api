import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateAuthorDto } from './dto/create-author.dto';
import { UpdateAuthorDto } from './dto/update-author.dto';
import * as mongoose from 'mongoose';
import aqp from 'api-query-params';
import { InjectModel } from '@nestjs/mongoose';
import { Author, AuthorDocument } from './schemas/author.schema';
import type { SoftDeleteModel } from 'soft-delete-plugin-mongoose';

@Injectable()
export class AuthorsService {
  constructor(
    @InjectModel(Author.name)
    private authorModel: SoftDeleteModel<AuthorDocument>,
  ) {}

  async create(createAuthorDto: CreateAuthorDto): Promise<Author> {
    if (!createAuthorDto.name?.trim()) {
      throw new BadRequestException('Name is required');
    }
    return await this.authorModel.create({
      ...createAuthorDto,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  async findAll(
    currentPage: number,
    limit: number,
    query: string,
  ): Promise<{
    result: Author[];
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

    const offset = (currentPage - 1) * limit;
    const defaultLimit = limit ? limit : 10;

    const totalItems = (await this.authorModel.find(filter)).length;
    const totalPages = Math.ceil(totalItems / defaultLimit);

    const result = await this.authorModel
      .find(filter)
      .skip(offset)
      .limit(defaultLimit)
      .sort(sort as any)
      .populate(population)
      .select(projection as any)
      .exec();

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

  async findOne(id: string) {
    this.validateObjectId(id);
    return await this.authorModel
      .findById(id)
      .populate({
        path: 'books',
        select: {
          title: 1,
          description: 1,
          publishedAt: 1,
        },
      })
      .exec();
  }

  async update(id: string, updateAuthorDto: UpdateAuthorDto) {
    this.validateObjectId(id);
    if (updateAuthorDto.name !== undefined && !updateAuthorDto.name?.trim()) {
      throw new BadRequestException('Name cannot be empty');
    }

    const author = await this.authorModel.findByIdAndUpdate(
      id,
      {
        ...updateAuthorDto,
        updatedAt: new Date().toISOString(),
      },
      { new: true },
    );

    if (!author) {
      throw new NotFoundException('Author not found');
    }
    return author;
  }

  async remove(id: string) {
    this.validateObjectId(id);
    return this.authorModel.softDelete({ _id: id });
  }

  private validateObjectId(id: string): void {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID format');
    }
  }
}
