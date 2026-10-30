import { registerDecorator, ValidationOptions } from 'class-validator';

/** What a deleted person is called (step G2). The user row keeps this English text; the app shows it in the reader's language. */
export const DELETED_USER_NAME = 'Deleted user';
const RESERVED = [DELETED_USER_NAME, 'مستخدم محذوف'].map((n) => n.toLowerCase());

/** True for the reserved name however it is spaced or cased, so nobody can pass as a deleted user. */
export const isReservedName = (name: unknown): boolean =>
  typeof name === 'string' && RESERVED.includes(name.trim().replace(/\s+/g, ' ').toLowerCase());

export function IsNotReservedName(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isNotReservedName',
      target: object.constructor,
      propertyName,
      options: { message: 'This name is reserved. Choose another one.', ...options },
      validator: { validate: (value: unknown) => !isReservedName(value) },
    });
}
