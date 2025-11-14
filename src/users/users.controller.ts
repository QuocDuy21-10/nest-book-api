import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('User APIs')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
}
