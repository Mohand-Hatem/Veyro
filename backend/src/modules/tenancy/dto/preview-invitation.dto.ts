import { IsNotEmpty, IsString } from 'class-validator';

/** CS-11: the invitation secret arrives as a query parameter (the same value as in the invite link). */
export class PreviewInvitationDto {
  @IsString()
  @IsNotEmpty({ message: 'Invitation token is required.' })
  token: string;
}
