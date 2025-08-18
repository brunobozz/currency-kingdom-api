import {
  IsOptional, IsUUID, IsInt, Min, Max, IsIn, IsString, IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QueryTransactionDto {
  @IsOptional() @IsUUID()
  userId?: string;

  @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 20;

  @IsOptional() @IsIn(['createdAt', 'fromAmount', 'toAmountGross', 'toAmountNet'])
  orderBy: 'createdAt' | 'fromAmount' | 'toAmountGross' | 'toAmountNet' = 'createdAt';

  @IsOptional() @IsIn(['ASC', 'DESC'])
  order: 'ASC' | 'DESC' = 'DESC';

  // já existia
  @IsOptional() @IsString()
  term?: string;

  // NOVOS:
  @IsOptional() @IsDateString()
  date?: string;

  @IsOptional() @IsString()
  currencyOrigin?: string;

  @IsOptional() @IsString()
  currencyDestiny?: string;
}
