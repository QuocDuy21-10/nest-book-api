import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Session, SessionDocument } from './schemas/session.schema';
import type { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
@Injectable()
export class SessionsService {
  constructor(
      @InjectModel(Session.name) private sessionModel: SoftDeleteModel<SessionDocument>, 
  
  ) {}
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
  
  public async deleteSessionByUserId(userId: string) {
      return this.sessionModel.deleteMany({ user: userId });
  }

    async deleteUserSessionsExcept(userId: string, currentRefreshToken: string) {
    return this.sessionModel.deleteMany({
      user: userId,
      refreshToken: { $ne: currentRefreshToken }, 
    });
  }
  
}
