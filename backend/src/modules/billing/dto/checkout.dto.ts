import { IsIn } from 'class-validator';

export class CheckoutDto {
  @IsIn(['PRO', 'ENTERPRISE', 'EPIC'], { message: 'Choose one of the paid plans: PRO, ENTERPRISE or EPIC.' })
  tier: 'PRO' | 'ENTERPRISE' | 'EPIC';
}
