import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from 'src/users/schemas/user.schema';

export type KeyTokenDocument = HydratedDocument<KeyToken>;

@Schema({ timestamps: true })
export class KeyToken {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, type: String })
  publicKey: string;

  @Prop({ type: String, index: true })
  keyId: string; 

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;

  @Prop({ type: Date, index: true })
  expiresAt?: Date; 

  @Prop({ type: Boolean, default: true })
  isActive: boolean; 
}

export const KeyTokenSchema = SchemaFactory.createForClass(KeyToken);

KeyTokenSchema.index({ userId: 1, keyId: 1 }, { unique: true });
KeyTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); 
