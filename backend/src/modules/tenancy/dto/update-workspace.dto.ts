import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

/** BR-WS-01.3: URL-safe, lowercase alphanumeric with single hyphens, 3 to 50 characters. */
export const WORKSPACE_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class UpdateWorkspaceDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2, { message: 'Workspace name must be at least 2 characters long.' })
  @MaxLength(100, { message: 'Workspace name must be at most 100 characters long.' })
  name?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @MinLength(3, { message: 'Workspace slug must be at least 3 characters long.' })
  @MaxLength(50, { message: 'Workspace slug must be at most 50 characters long.' })
  @Matches(WORKSPACE_SLUG_REGEX, {
    message: 'Workspace slug must use lowercase letters, digits and single hyphens (no leading or trailing hyphen).',
  })
  slug?: string;
}
