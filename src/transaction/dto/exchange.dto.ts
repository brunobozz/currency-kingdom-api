import { IsString, IsNumber, Min, Length } from 'class-validator';

export class ExchangeDto {
  @IsString() @Length(1, 16)
  fromCode: string;

  @IsString() @Length(1, 16)
  toCode: string;

  @IsNumber() @Min(0.01)
  fromAmount: number;
}
