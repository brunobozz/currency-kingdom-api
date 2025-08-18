import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { QueryTransactionDto } from './dto/query-transaction.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { ExchangeDto } from './dto/exchange.dto';
import { UserId } from '../auth/decorators/user-id.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('transactions')
export class TransactionController {
  constructor(private readonly service: TransactionService) { }

  // cria transação para o usuário logado
  @Post()
  async create(@Req() req: any, @Body() body: Omit<CreateTransactionDto, 'userId'>) {
    const userId = req.user?.id ?? req.user?.sub;
    return this.service.create({ ...body, userId });
  }

  // lista minhas transações
  @Get('me')
  async myTransactions(@Req() req: any, @Query() q: QueryTransactionDto) {
    const userId = req.user?.id ?? req.user?.sub;
    return this.service.findAll({ ...q, userId });
  }

  // lista de todos (admin)
  @Get()
  async listAll(@Query() q: QueryTransactionDto) {
    return this.service.findAll(q);
  }

  // detalhe (admin)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  // fazer uma transação com taxa
  @Post('exchange')
  @Roles()
  async exchange(@UserId() userId: string, @Body() dto: ExchangeDto) {
    return this.service.exchange(userId, dto);
  }
}
