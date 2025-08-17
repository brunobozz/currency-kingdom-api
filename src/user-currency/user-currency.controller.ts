import { Controller, Get, Query, Param, Post, Body, Req } from '@nestjs/common';
import { UserCurrencyService } from './user-currency.service';
import { QueryUserCurrencyDto } from './dto/query-user-currency.dto';
import { UpsertUserCurrencyDto } from './dto/upsert-user-currency.dto';
import { CreditDto, DebitDto } from './dto/credit-debit.dto';

@Controller('user-currencies')
export class UserCurrencyController {
  constructor(private readonly service: UserCurrencyService) { }

  @Get()
  async list(@Query() q: QueryUserCurrencyDto) {
    return this.service.list(q);
  }

  @Get('me')
  async myBalances(@Req() req: any) {
    const userId = req.user?.id ?? req.user?.sub;
    return this.service.listAllForUser(userId);
  }

  // Pegar saldo direto
  @Get('balance/by')
  async balanceBy(
    @Query('userId') userId: string,
    @Query('currencyId') currencyId: string) {
    return { balance: await this.service.getBalance(userId, currencyId) };
  }

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

}
