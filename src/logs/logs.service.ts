import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Log, LogDocument } from './schemas/log.schema';

@Injectable()
export class LogsService {
  constructor(@InjectModel(Log.name) private logModel: Model<LogDocument>) {}
  async create(log: Partial<Log>) {
    await this.logModel.create(log);
  }
}
