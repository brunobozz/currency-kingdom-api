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

const DEFAULT_TZ = 'America/Sao_Paulo';

// "DD/MM/YYYY HH:mm:ss" no fuso desejado, forçando 24h
function toLocal24(date: Date, tz = DEFAULT_TZ): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value; return acc;
  }, {});
  // return `${parts.day}/${parts.month}/${parts.year} - ${parts.hour}:${parts.minute}:${parts.second}`;
  return `${parts.day}/${parts.month} - ${parts.hour}:${parts.minute}:${parts.second}`;
}

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

  async findAll(params: {
    userId?: string; page?: number; limit?: number;
    orderBy?: any; order?: any; term?: string;
    date?: string; currencyOrigin?: string; currencyDestiny?: string;
    tz?: string; // 👈 novo: fuso opcional
  }) {
    const {
      userId,
      page = 1,
      limit = 20,
      orderBy = 'createdAt',
      order = 'DESC',
      term,
      date,
      currencyOrigin,
      currencyDestiny,
      tz = DEFAULT_TZ, // 👈 padrão
    } = params || {};

    const qb = this.repo
      .createQueryBuilder('t')
      .leftJoin('t.user', 'u').addSelect(['u.id', 'u.name', 'u.email'])
      .leftJoin('t.fromCurrency', 'fc').addSelect(['fc.id', 'fc.code', 'fc.name', 'fc.color'])
      .leftJoin('t.toCurrency', 'tc').addSelect(['tc.id', 'tc.code', 'tc.name', 'tc.color']);

    if (userId) qb.andWhere('t.userId = :userId', { userId });

    if (term && term.trim()) {
      const t = `%${term.trim().toLowerCase()}%`;
      qb.andWhere('(LOWER(u.name) LIKE :t OR LOWER(u.email) LIKE :t)', { t });
    }

    // Dia local com timezone() 
    if (date) {
      qb.andWhere(
        `timezone(CAST(:tz AS text), t."createdAt") >= CAST(:date AS date)
     AND timezone(CAST(:tz AS text), t."createdAt") < (CAST(:date AS date) + INTERVAL '1 day')`,
        { tz, date },
      );
    }

    const norm = (s?: string) => (s ?? '').replace(/\$/g, '').trim().toUpperCase();
    if (currencyOrigin && norm(currencyOrigin)) qb.andWhere('UPPER(fc.code) = :fcCode', { fcCode: norm(currencyOrigin) });
    if (currencyDestiny && norm(currencyDestiny)) qb.andWhere('UPPER(tc.code) = :tcCode', { tcCode: norm(currencyDestiny) });

    const orderMap: Record<string, string> = {
      createdAt: 't.createdAt',
      fromAmount: 't.fromAmount',
      toAmountGross: 't.toAmountGross',
      toAmountNet: 't.toAmountNet',
    };
    const orderColumn = orderMap[orderBy] ?? 't.createdAt';
    const orderDir = (String(order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC') as 'ASC' | 'DESC';

    qb.orderBy(orderColumn, orderDir)
      .skip((page - 1) * limit)
      .take(limit);

    const [rows, total] = await qb.getManyAndCount();

    const data = rows.map(tx => ({
      ...tx,
      createdAtLocal: toLocal24(tx.createdAt, tz), // 👈 sempre 24h no fuso
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        orderBy,
        order: orderDir,
        term: term ?? null,
        date: date ?? null,
        currencyOrigin: currencyOrigin ?? null,
        currencyDestiny: currencyDestiny ?? null,
        tz, // ecoa fuso usado
      },
    };
  }

  async findOne(id: string, tz = DEFAULT_TZ) {
    const tx = await this.repo
      .createQueryBuilder('t')
      .leftJoin('t.user', 'u').addSelect(['u.id', 'u.name', 'u.email'])
      .leftJoin('t.fromCurrency', 'fc').addSelect(['fc.id', 'fc.code', 'fc.name', 'fc.color'])
      .leftJoin('t.toCurrency', 'tc').addSelect(['tc.id', 'tc.code', 'tc.name', 'tc.color'])
      .where('t.id = :id', { id })
      .getOne();

    if (!tx) throw new NotFoundException('Transação não encontrada');
    return { ...tx, createdAtLocal: toLocal24(tx.createdAt, tz) };
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
