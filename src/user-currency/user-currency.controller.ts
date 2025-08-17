import { Controller, Get, Query, Param, Post, Body } from '@nestjs/common';
import { UserCurrencyService } from './user-currency.service';
import { QueryUserCurrencyDto } from './dto/query-user-currency.dto';
import { UpsertUserCurrencyDto } from './dto/upsert-user-currency.dto';
import { CreditDto, DebitDto } from './dto/credit-debit.dto';

@Controller('user-currencies')
export class UserCurrencyController {
  constructor(private readonly service: UserCurrencyService) { }

  // Listar com filtros/paginação
  @Get()
  async list(@Query() q: QueryUserCurrencyDto) {
    return this.service.list(q);
  }

  // Buscar por ID
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  // Upsert (set absoluto do saldo)
  @Post('upsert')
  async upsert(@Body() dto: UpsertUserCurrencyDto) {
    return this.service.setAmount(dto.userId, dto.currencyId, dto.amount);
  }

  // Crédito (soma)
  @Post('credit')
  async credit(@Body() dto: CreditDto) {
    return this.service.credit(dto.userId, dto.currencyId, dto.amount);
  }

  // Débito (subtrai)
  @Post('debit')
  async debit(@Body() dto: DebitDto) {
    return this.service.debit(dto.userId, dto.currencyId, dto.amount);
  }

  // (Opcional) pegar saldo direto
  @Get('balance/by')
  async balanceBy(@Query('userId') userId: string, @Query('currencyId') currencyId: string) {
    return { balance: await this.service.getBalance(userId, currencyId) };
  }
}
