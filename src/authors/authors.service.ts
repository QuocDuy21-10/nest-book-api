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
import { TikiAuthorData } from 'src/crawler/interfaces/tiki-product.interface';

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

  // Find or create an author from Tiki data
  async findOrCreateFromTiki(
    authorData: TikiAuthorData,
  ): Promise<mongoose.Types.ObjectId> {
    try {
      const externalId = authorData.id.toString();
      const source = 'Tiki';

      // Check if author already exists
      let author = await this.authorModel.findOne({
        externalId,
        source,
      });

      if (author) {
        return author._id;
      }

      // Create new author
      author = await this.authorModel.create({
        name: authorData.name,
        externalId,
        slug: authorData.slug,
        source,
        isFromCrawler: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return author._id;
    } catch (error) {
      // Handle duplicate key error
      if (error.code === 11000) {
        const author = await this.authorModel.findOne({
          externalId: authorData.id.toString(),
          source: 'Tiki',
        });

        if (author) {
          return author._id;
        }
      }
      throw error;
    }
  }

  // Find or create multiple authors from Tiki data
  async findOrCreateBulkFromTiki(
    authorsData: TikiAuthorData[],
  ): Promise<mongoose.Types.ObjectId[]> {
    if (!authorsData || authorsData.length === 0) {
      return [];
    }

    const authorIds: mongoose.Types.ObjectId[] = [];

    // Process each author sequentially to maintain order
    for (const authorData of authorsData) {
      try {
        const authorId = await this.findOrCreateFromTiki(authorData);
        authorIds.push(authorId);
      } catch (error) {
        console.error(
          `Failed to find/create author ${authorData.name}: ${error.message}`,
        );
        // Skip this author on error
        continue;
      }
    }

    return authorIds;
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
