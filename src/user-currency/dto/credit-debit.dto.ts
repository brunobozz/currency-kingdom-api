import { IsUUID, IsNumber, Min } from 'class-validator';

export class CreditDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  currencyId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;
}

export class DebitDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  currencyId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;
}
