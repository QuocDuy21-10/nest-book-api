import { UserRole } from '../../users/enums/user-role.enum';

export const usersSeedData = [
  {
    name: 'Admin User',
    email: 'admin@gmail.com',
    password: '123456',
    role: UserRole.ADMIN,
  },
  {
    name: 'Librarian User',
    email: 'lib@gmail.com',
    password: '123456',
    role: UserRole.LIBRARIAN,
  },
  {
    name: 'Reader User 1',
    email: 'reader1@gmail.com',
    password: '123456',
    role: UserRole.READER,
  },
  {
    name: 'Reader User 2',
    email: 'reader2@gmail.com',
    password: '123456',
    role: UserRole.READER,
  },
  {
    name: 'Standard User',
    email: 'user@gmail.com',
    password: '123456',
    role: UserRole.USER,
  },
];
