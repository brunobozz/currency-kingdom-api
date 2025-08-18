import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Transaction } from 'src/transaction/entities/transaction.entity';
import { Currency } from 'src/currency/entities/currency.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ExchangeDto } from './dto/exchange.dto';
import { UserCurrencyService } from '../user-currency/user-currency.service';
import { BankService } from '../user/bank.service';

const round2 = (n: number) => Math.round(Number(n ?? 0) * 100) / 100;
const to6 = (n: number) => Number.isFinite(n) ? Math.round(n * 1_000_000) / 1_000_000 : NaN;
const FEE_PERCENT = 0.005; // 0,5%

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(Transaction)
    private readonly repo: Repository<Transaction>,
    @InjectRepository(Currency)
    private readonly currencyRepo: Repository<Currency>,
    private readonly userCurrency: UserCurrencyService,
    private readonly bankService: BankService,
    private readonly dataSource: DataSource,
  ) { }

  private async findCurrencyByCodeOrThrow(code: string): Promise<Currency> {
    const c = await this.currencyRepo.findOne({ where: { code } });
    if (!c) throw new NotFoundException(`Moeda ${code} não encontrada`);
    return c;
  }

  async create(dto: CreateTransactionDto) {
    const { userId, fromCode, toCode } = dto;
    const fromAmount = round2(Number(dto.fromAmount));

    if (!userId) throw new BadRequestException('userId obrigatório');
    if (fromCode === toCode) throw new BadRequestException('Moedas de origem e destino devem ser diferentes');
    if (fromAmount <= 0) throw new BadRequestException('fromAmount deve ser > 0');

    const from = await this.findCurrencyByCodeOrThrow(fromCode);
    const to = await this.findCurrencyByCodeOrThrow(toCode);

    const fFrom = Number(from.factorToBase);
    const fTo = Number(to.factorToBase);
    if (!fFrom || !fTo) throw new BadRequestException('factorToBase inválido');

    // rate = quantos TO valem 1 FROM
    const rate = to6(fTo / fFrom);

    // valores destino
    const toAmountGross = round2(fromAmount * rate);           // antes da taxa
    const feeAmount = round2(toAmountGross * FEE_PERCENT); // taxa do banco (0,5%)
    const toAmountNet = round2(toAmountGross - feeAmount);   // após taxa

    if (toAmountNet <= 0) {
      throw new BadRequestException('Valor líquido insuficiente após taxa');
    }

    const tx = this.repo.create({
      userId,
      fromCurrencyId: from.id,
      toCurrencyId: to.id,
      fromAmount,                // 2 casas
      toAmountGross,             // 2 casas
      toAmountNet,               // 2 casas
      rate: String(rate),        // até 6 casas
      quoteFromToBase: String(to6(fFrom)), // ex.: TIBAR=2.5
      feePercent: String(FEE_PERCENT),     // "0.005"
      feeAmount,                 // 2 casas
    });

    return this.repo.save(tx);
  }

  async findAll(params: { userId?: string; page?: number; limit?: number }) {
    const { userId, page = 1, limit = 20 } = params || {};

    const qb = this.repo
      .createQueryBuilder('t')
      // user: só os campos necessários
      .leftJoin('t.user', 'u')
      .addSelect(['u.id', 'u.name', 'u.email'])
      // moedas: pegue também metadados úteis
      .leftJoin('t.fromCurrency', 'fc')
      .addSelect(['fc.id', 'fc.code', 'fc.name', 'fc.color'])
      .leftJoin('t.toCurrency', 'tc')
      .addSelect(['tc.id', 'tc.code', 'tc.name', 'tc.color']);

    if (userId) {
      qb.where('t.userId = :userId', { userId });
    }

    qb.orderBy('t.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data, // cada item tem: user { id, name, email }, fromCurrency, toCurrency
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const tx = await this.repo.findOne({
      where: { id },
      relations: ['fromCurrency', 'toCurrency'],
    });
    if (!tx) throw new NotFoundException('Transação não encontrada');
    return tx;
  }

  async exchange(userId: string, dto: ExchangeDto) {
    const { fromCode, toCode, fromAmount } = dto;

    if (fromCode === toCode) {
      throw new BadRequestException('Moedas de origem e destino devem ser diferentes');
    }
    if (!userId) throw new BadRequestException('userId obrigatório');

    const from = await this.findCurrencyByCodeOrThrow(fromCode);
    const to = await this.findCurrencyByCodeOrThrow(toCode);

    const fFrom = Number(from.factorToBase);
    const fTo = Number(to.factorToBase);
    if (!fFrom || !fTo) throw new BadRequestException('factorToBase inválido');

    const rate = to6(fTo / fFrom);                 // 1 FROM => rate TO
    const toGross = round2(Number(fromAmount) * rate);
    const feeAmount = round2(toGross * FEE_PERCENT);
    const toNet = round2(toGross - feeAmount);

    if (toNet <= 0) throw new BadRequestException('Valor líquido insuficiente após taxa');

    const bankId = await this.bankService.getBankUserId();

    // Tudo atômico
    const saved = await this.dataSource.transaction(async (manager) => {
      // 1) débito da moeda origem do usuário
      await this.userCurrency.debitTx(manager, userId, from.id, round2(fromAmount));

      // 2) crédito da moeda origem para o banco
      await this.userCurrency.creditTx(manager, bankId, from.id, round2(fromAmount));

      // 3) débito da (moeda destino - 0,5%) para o banco
      await this.userCurrency.debitTx(manager, bankId, to.id, toNet);

      // 4) crédito da (moeda destino - 0,5%) para o usuário
      await this.userCurrency.creditTx(manager, userId, to.id, toNet);

      // 5) registrar transação
      const txRepo = manager.getRepository(Transaction);
      const tx = txRepo.create({
        userId,
        fromCurrencyId: from.id,
        toCurrencyId: to.id,
        fromAmount: round2(fromAmount),
        toAmountGross: toGross,
        toAmountNet: toNet,
        rate: String(rate),
        quoteFromToBase: String(to6(fFrom)),
        feePercent: String(FEE_PERCENT), // 0.005
        feeAmount,
      });
      return txRepo.save(tx);
    });

    return {
      id: saved.id,
      userId,
      fromCode,
      toCode,
      fromAmount: round2(fromAmount),
      rate,
      toAmountGross: toGross,
      feePercent: FEE_PERCENT,
      feeAmount,
      toAmountNet: toNet,
      createdAt: saved.createdAt,
    };
  }
}
