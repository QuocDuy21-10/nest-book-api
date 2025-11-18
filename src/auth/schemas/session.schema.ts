import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { User } from 'src/users/schemas/user.schema';

export type SessionDocument = HydratedDocument<Session>;

@Schema({ timestamps: true })
export class Session {
  @Prop({ required: true })
  refreshToken: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref:  User.name, required: true })
  user: User;

  @Prop()
  device?: string; 

  @Prop()
  ipAddress?: string; 

  @Prop({ default: Date.now, expires: '7d' }) 
  expireAt: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);