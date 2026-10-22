import { IsArray, IsString, ArrayMaxSize } from 'class-validator';

/** The per-plan cap (3 / 7 / 15 / 25) is enforced in BillingService; 25 is the largest plan, so it bounds the payload. */

export class SelectActiveProjectsDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(25)
  activeProjectIds: string[];
}
