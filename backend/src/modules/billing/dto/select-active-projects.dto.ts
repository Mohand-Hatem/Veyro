import { IsArray, IsString, ArrayMaxSize } from 'class-validator';

export class SelectActiveProjectsDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(3, { message: 'A maximum of 3 projects can be selected for Free tier.' })
  activeProjectIds: string[];
}
