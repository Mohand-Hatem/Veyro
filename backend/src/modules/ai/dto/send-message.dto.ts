import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'Prompt content cannot be empty.' })
  @MaxLength(10000)
  content: string;

  @IsString()
  @IsOptional()
  targetWorkspaceId?: string;
}
