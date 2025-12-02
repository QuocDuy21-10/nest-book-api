export enum Permission {
  BOOK_CREATE = 'BOOK_CREATE',
  BOOK_READ = 'BOOK_READ',
  BOOK_UPDATE = 'BOOK_UPDATE',
  BOOK_DELETE = 'BOOK_DELETE',
  BOOK_LIST = 'BOOK_LIST',

  AUTHOR_CREATE = 'AUTHOR_CREATE',
  AUTHOR_READ = 'AUTHOR_READ',
  AUTHOR_UPDATE = 'AUTHOR_UPDATE',
  AUTHOR_DELETE = 'AUTHOR_DELETE',
  AUTHOR_LIST = 'AUTHOR_LIST',

  USER_CREATE = 'USER_CREATE',
  USER_READ = 'USER_READ',
  USER_UPDATE = 'USER_UPDATE',
  USER_DELETE = 'USER_DELETE',
  USER_LIST = 'USER_LIST',

  ROLE_CREATE = 'ROLE_CREATE',
  ROLE_READ = 'ROLE_READ',
  ROLE_UPDATE = 'ROLE_UPDATE',
  ROLE_DELETE = 'ROLE_DELETE',
  ROLE_LIST = 'ROLE_LIST',
}

export const PermissionGroups = {
  BOOK: [
    Permission.BOOK_CREATE,
    Permission.BOOK_READ,
    Permission.BOOK_UPDATE,
    Permission.BOOK_DELETE,
    Permission.BOOK_LIST,
  ],
  AUTHOR: [
    Permission.AUTHOR_CREATE,
    Permission.AUTHOR_READ,
    Permission.AUTHOR_UPDATE,
    Permission.AUTHOR_DELETE,
    Permission.AUTHOR_LIST,
  ],
  USER: [
    Permission.USER_CREATE,
    Permission.USER_READ,
    Permission.USER_UPDATE,
    Permission.USER_DELETE,
    Permission.USER_LIST,
  ],
  ROLE: [
    Permission.ROLE_CREATE,
    Permission.ROLE_READ,
    Permission.ROLE_UPDATE,
    Permission.ROLE_DELETE,
    Permission.ROLE_LIST,
  ],
} as const;

export const getAllPermissions = (): Permission[] => {
  return Object.values(Permission);
};

export const isValidPermission = (permission: string): boolean => {
  return Object.values(Permission).includes(permission as Permission);
};
