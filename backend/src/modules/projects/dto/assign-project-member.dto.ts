import { IsString, IsNotEmpty } from 'class-validator';

export class AssignProjectMemberDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}
