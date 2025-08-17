// src/user/user.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { BankService } from './bank.service';
import { CurrencyModule } from '../currency/currency.module';
import { UserCurrencyModule } from '../user-currency/user-currency.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), CurrencyModule, UserCurrencyModule],
  controllers: [UserController],
  providers: [UserService, BankService],
  exports: [UserService, BankService],
})
export class UserModule { }
