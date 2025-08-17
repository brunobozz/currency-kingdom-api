import { IsString, IsNumber, Min } from 'class-validator';

export class ConvertPreviewDto {
  @IsString()
  fromCode: string;

  @IsString()
  toCode: string;

  @IsNumber()
  @Min(0.01)
  amount: number;
}
