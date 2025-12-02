import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Permission } from '../enums/permission.enum';

export type RoleDocument = HydratedDocument<Role>;

@Schema({ timestamps: true })
export class Role {
  @Prop({
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    minlength: 2,
    maxlength: 50,
    index: true,
  })
  name: string;

  @Prop({
    trim: true,
  })
  description: string;

  @Prop({
    type: [String],
    enum: Permission,
    default: [],
    index: true,
  })
  permissions: Permission[];

  @Prop({
    default: true,
    index: true,
  })
  isActive: boolean;

  @Prop({
    default: false,
  })
  isSystemRole: boolean;

  @Prop({
    default: false,
  })
  isDeleted: boolean;

  @Prop()
  deletedAt?: Date;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const RoleSchema = SchemaFactory.createForClass(Role);

RoleSchema.index({ name: 1 }, { unique: true });
RoleSchema.index({ isActive: 1, isDeleted: 1 });
RoleSchema.index({ permissions: 1 });
