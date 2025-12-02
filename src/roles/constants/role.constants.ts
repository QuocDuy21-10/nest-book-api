import { Permission } from '../enums/permission.enum';

export enum SystemRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  READER = 'READER',
  LIBRARIAN = 'LIBRARIAN',
  COLLABORATOR = 'COLLABORATOR',
}

export const SYSTEM_PROTECTED_ROLES = [
  SystemRole.ADMIN,
  SystemRole.USER,
] as const;

export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRole, Permission[]> = {
  [SystemRole.ADMIN]: Object.values(Permission), 

  [SystemRole.USER]: [
    Permission.BOOK_READ,
    Permission.BOOK_LIST,
    Permission.AUTHOR_READ,
    Permission.AUTHOR_LIST,
  ],

  [SystemRole.READER]: [
    Permission.BOOK_READ,
    Permission.BOOK_LIST,
    Permission.AUTHOR_READ,
    Permission.AUTHOR_LIST,
  ],

  [SystemRole.LIBRARIAN]: [
    Permission.BOOK_CREATE,
    Permission.BOOK_READ,
    Permission.BOOK_UPDATE,
    Permission.BOOK_DELETE,
    Permission.BOOK_LIST,
    Permission.AUTHOR_CREATE,
    Permission.AUTHOR_READ,
    Permission.AUTHOR_UPDATE,
    Permission.AUTHOR_DELETE,
    Permission.AUTHOR_LIST,
  ],

  [SystemRole.COLLABORATOR]: [
    Permission.BOOK_UPDATE,
    Permission.BOOK_DELETE,
    Permission.BOOK_READ,
    Permission.BOOK_LIST,
    Permission.AUTHOR_READ,
    Permission.AUTHOR_LIST,
  ],
};


export const ROLE_VALIDATION = {
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
  DESCRIPTION_MAX_LENGTH: 500,
} as const;

export const ROLE_ERROR_MESSAGES = {
  ROLE_NOT_FOUND: 'Role not found',
  ROLE_ALREADY_EXISTS: 'Role with this name already exists',
  ROLE_NAME_REQUIRED: 'Role name is required',
  ROLE_NAME_TOO_SHORT: `Role name must be at least ${ROLE_VALIDATION.NAME_MIN_LENGTH} characters`,
  ROLE_NAME_TOO_LONG: `Role name must not exceed ${ROLE_VALIDATION.NAME_MAX_LENGTH} characters`,
  ROLE_DESCRIPTION_TOO_LONG: `Role description must not exceed ${ROLE_VALIDATION.DESCRIPTION_MAX_LENGTH} characters`,
  INVALID_PERMISSIONS: 'One or more permissions are invalid',
  CANNOT_DELETE_PROTECTED_ROLE: 'Cannot delete system protected role',
  CANNOT_UPDATE_PROTECTED_ROLE: 'Cannot update system protected role',
  ROLE_IN_USE: 'Cannot delete role that is currently assigned to users',
} as const;

export const ROLE_SUCCESS_MESSAGES = {
  ROLE_CREATED: 'Role created successfully',
  ROLE_UPDATED: 'Role updated successfully',
  ROLE_DELETED: 'Role deleted successfully',
  ROLES_FETCHED: 'Roles fetched successfully',
  ROLE_FETCHED: 'Role fetched successfully',
} as const;
