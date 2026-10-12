import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateWorkspaceDto {
  @IsString()
  @IsNotEmpty({ message: 'Workspace name is required.' })
  @MinLength(2, { message: 'Workspace name must be at least 2 characters long.' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Workspace slug is required.' })
  @MinLength(2, { message: 'Workspace slug must be at least 2 characters long.' })
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Workspace slug must contain only lowercase alphanumeric characters and hyphens.',
  })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  slug: string;
}
