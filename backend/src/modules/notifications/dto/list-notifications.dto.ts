import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

/** `GET /notifications`: one page, newest first. */
export class ListNotificationsDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d\d-\d\dT[\d:.]+Z\|[a-z0-9]+$/, { message: 'cursor is not valid.' })
  cursor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
