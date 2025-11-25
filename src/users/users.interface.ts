import { UserRole } from './enums/user-role.enum';

export interface IUser {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  refreshTokenVersion: number;
}
