import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from 'src/transaction/entities/transaction.entity';
import { Currency } from 'src/currency/entities/currency.entity';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { UserCurrencyModule } from '../user-currency/user-currency.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Currency]),
    UserCurrencyModule,
    UserModule
  ],
  providers: [TransactionService],
  controllers: [TransactionController],
  exports: [TypeOrmModule, TransactionService],
})
export class TransactionModule { }
