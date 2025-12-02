import { Permission } from 'src/roles/enums/permission.enum';
import { SystemRole } from '../roles/constants/role.constants';

export interface IUser {
  _id: string;
  name: string;
  email: string;
  role: SystemRole;
  refreshTokenVersion: number;
  permissions: Permission[];
}
