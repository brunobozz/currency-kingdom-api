import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Currency } from 'src/currency/entities/currency.entity';
import { CurrencyService } from 'src/currency/currency.service';
import { CurrencyController } from 'src/currency/currency.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Currency])],
  controllers: [CurrencyController],
  providers: [CurrencyService],
  exports: [TypeOrmModule, CurrencyService],
})
export class CurrencyModule { }
