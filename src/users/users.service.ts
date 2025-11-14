
import { BadRequestException, Injectable } from '@nestjs/common';
import { RegisterUserDto } from './dto/create-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schemas/user.schema';
import type { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { compareSync, genSaltSync, hashSync } from 'bcryptjs';
import mongoose from 'mongoose';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: SoftDeleteModel<UserDocument>,
  ) {}
  hashPassword(password: string) {
    const salt = genSaltSync(10);
    const hash = hashSync(password, salt);
    return hash;
  }

  // Register user
  async register(user: RegisterUserDto) {
    const { name, email, password } = user;
    const isExistEmail = await this.userModel.findOne({
      email,
      isDeleted: false,
    });
    if (isExistEmail) {
      throw new BadRequestException(
        `Email: ${email} already exists in the system. Please use another email.`,
      );
    }
    const hashedPassword = this.hashPassword(password);
    let newUser = await this.userModel.create({
      name,
      email,
      password: hashedPassword,
    });
    return newUser;
  }

  findUserByRefreshToken(refreshToken: string) {
    return this.userModel.findOne({ refreshToken });
  }

  updateUserToken(userId: string, refreshToken: string) {
    this.validateObjectId(userId);
    return this.userModel.findByIdAndUpdate(
      { _id: userId },
      { refreshToken },
    );
  }
  
  findOneByUsername(username: string) {
    return this.userModel.findOne({ email: username });
  }

  isValidPassword(password: string, hash: string) {
    return compareSync(password, hash);
  }

  async incRefreshTokenVersion(userId: string) {
    return this.userModel.findByIdAndUpdate(
      { _id: userId },
      { $inc: { refreshTokenVersion: 1 } }
    );
  }

  private validateObjectId(id: string): void {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID format');
    }
  }
}
