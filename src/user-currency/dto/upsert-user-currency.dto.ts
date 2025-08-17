import { IsUUID, IsNumber, Min } from 'class-validator';

export class UpsertUserCurrencyDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  currencyId: string;

  @IsNumber()
  @Min(0)
  amount: number;
}
