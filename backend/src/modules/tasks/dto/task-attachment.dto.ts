import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** POST /tasks/:id/attachments/sign: the name of the file about to be uploaded (its extension decides how it is stored). */
export class SignAttachmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fileName: string;
}

/** POST /tasks/:id/attachments: the public id that was signed, once the browser has uploaded the file to it. */
export class ConfirmAttachmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  publicId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fileName: string;
}
