import { Controller, Get, Query, Param, Post, Body, UseGuards } from '@nestjs/common';
import { UserCurrencyService } from './user-currency.service';
import { QueryUserCurrencyDto } from './dto/query-user-currency.dto';
import { UpsertUserCurrencyDto } from './dto/upsert-user-currency.dto';
import { CreditDto, DebitDto } from './dto/credit-debit.dto';
import { UserId } from 'src/auth/decorators/user-id.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('user-currencies')
export class UserCurrencyController {
  constructor(private readonly service: UserCurrencyService) { }
  
  @Get()
  async list(@Query() q: QueryUserCurrencyDto) {
    return this.service.list(q);
  }

  @Get('me')
  async myBalances(@UserId() userId: string) {
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
