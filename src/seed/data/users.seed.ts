import { SystemRole } from '../../roles/constants/role.constants';

export const usersSeedData = [
  {
    name: 'Admin User',
    email: 'admin@gmail.com',
    password: '123456',
    role: SystemRole.ADMIN,
  },
  {
    name: 'Librarian User',
    email: 'lib@gmail.com',
    password: '123456',
    role: SystemRole.LIBRARIAN,
  },
  {
    name: 'Reader User 1',
    email: 'reader1@gmail.com',
    password: '123456',
    role: SystemRole.READER,
  },
  {
    name: 'Reader User 2',
    email: 'reader2@gmail.com',
    password: '123456',
    role: SystemRole.READER,
  },
  {
    name: 'Standard User',
    email: 'user@gmail.com',
    password: '123456',
    role: SystemRole.USER,
  },
];
