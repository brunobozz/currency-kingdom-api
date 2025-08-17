import { IsString, IsNumber, Min } from 'class-validator';

export class SetRateDto {
  @IsString()
  code: string;

  @IsNumber()
  @Min(0.000001)
  factorToBase: number;
}
