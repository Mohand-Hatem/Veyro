import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** `DELETE /users/me`: the password confirms that the person at the keyboard is the owner of the account. */
export class DeleteAccountDto {
  @IsString()
  @IsNotEmpty({ message: 'Password is required.' })
  @MaxLength(128)
  password: string;
}
