
import { BadRequestException, Injectable } from '@nestjs/common';
import { RegisterUserDto } from './dto/create-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schemas/user.schema';
import type { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { compareSync, genSaltSync, hashSync } from 'bcryptjs';
import mongoose from 'mongoose';
import { Session, SessionDocument } from 'src/auth/schemas/session.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: SoftDeleteModel<UserDocument>,
    @InjectModel(Session.name) private sessionModel: SoftDeleteModel<SessionDocument>, 
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
  async findOne(id: string) {
      return this.userModel.findById(id);
  }

  async createSession(userId: string, refreshToken: string, device?: string, ipAddress?: string) {
    return this.sessionModel.create({
      user: userId,
      refreshToken,
      device,     
      ipAddress, 
    });
  }

  async findSessionByToken(refreshToken: string) {
    return this.sessionModel.findOne({ refreshToken }).populate('user');
  }

  async deleteSession(refreshToken: string) {
    return this.sessionModel.deleteOne({ refreshToken });
  }
  
  async deleteSessionByUserId(userId: string) {
      return this.sessionModel.deleteMany({ user: userId });
  }
  
  findOneByUsername(username: string) {
    return this.userModel.findOne({ email: username });
  }

  isValidPassword(password: string, hash: string) {
    return compareSync(password, hash);
  }

  async logoutAll(userId: string) {
    await this.deleteSessionByUserId(userId); 
    await this.incRefreshTokenVersion(userId);
  }

  async deleteUserSessionsExcept(userId: string, currentRefreshToken: string) {
    return this.sessionModel.deleteMany({
      user: userId,
      refreshToken: { $ne: currentRefreshToken }, 
    });
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
