import { IsNotEmpty, IsNumber, IsPositive, IsString, Matches, Min } from 'class-validator';

export class CreateCurrencyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string; // ex: 'Or$' / 'Tb$' (único)

  @IsNumber()
  @Min(0)
  amount: number;

  @IsNumber()
  @IsPositive()
  baseValue: number;

  @IsString()
  @Matches(/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/, { message: 'color deve ser um hex válido, ex: #D49000' })
  color: string;
}
