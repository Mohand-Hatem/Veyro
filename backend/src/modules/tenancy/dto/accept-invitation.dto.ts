import { IsNotEmpty, IsString } from 'class-validator';

export class AcceptInvitationDto {
  @IsString()
  @IsNotEmpty({ message: 'Invitation token is required.' })
  token: string;
}
