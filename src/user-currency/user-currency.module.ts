import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserCurrency } from 'src/user-currency/entities/user-currency.entity';
import { UserCurrencyService } from 'src/user-currency/user-currency.service';
import { UserCurrencyController } from 'src/user-currency/user-currency.controller';
import { Currency } from '../currency/entities/currency.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserCurrency, Currency])],
  controllers: [UserCurrencyController],
  providers: [UserCurrencyService],
  exports: [TypeOrmModule, UserCurrencyService],
})
export class UserCurrencyModule { }
