import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { UserCurrency } from './entities/user-currency.entity';
import { Currency } from '../currency/entities/currency.entity';

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class UserCurrencyService {
  constructor(
    @InjectRepository(UserCurrency)
    private readonly repo: Repository<UserCurrency>,

    @InjectRepository(Currency)
    private readonly currencyRepo: Repository<Currency>,
  ) { }

  async getOrCreate(userId: string, currencyId: string) {
    let uc = await this.repo.findOne({ where: { userId, currencyId } });
    if (!uc) {
      uc = this.repo.create({ userId, currencyId, amount: 0 });
      uc = await this.repo.save(uc);
    }
    return uc;
  }

  async getBalance(userId: string, currencyId: string): Promise<number> {
    const uc = await this.repo.findOne({ where: { userId, currencyId } });
    return round2(uc?.amount ?? 0);
  }

  async credit(userId: string, currencyId: string, amount: number) {
    const uc = await this.getOrCreate(userId, currencyId);
    uc.amount = round2(Number(uc.amount) + Number(amount));
    return this.repo.save(uc);
  }

  async debit(userId: string, currencyId: string, amount: number) {
    const uc = await this.getOrCreate(userId, currencyId);
    const after = round2(Number(uc.amount) - Number(amount));
    if (after < 0) throw new Error('Saldo insuficiente');
    uc.amount = after;
    return this.repo.save(uc);
  }

  async list(params: { userId?: string; currencyId?: string; page?: number; limit?: number }) {
    const { userId, currencyId, page = 1, limit = 20 } = params;
    const where: any = {};
    if (userId) where.userId = userId;
    if (currencyId) where.currencyId = currencyId;

    const [data, total] = await this.repo.findAndCount({
      where,
      order: { updatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new Error('Registro não encontrado');
    return row;
  }

  /** Seta o saldo absoluto (com getOrCreate) */
  async setAmount(userId: string, currencyId: string, amount: number) {
    const to2 = (n: number) => Math.round(n * 100) / 100;
    if (amount < 0) throw new Error('Valor inválido');
    const uc = await this.getOrCreate(userId, currencyId);
    uc.amount = to2(amount);
    return this.repo.save(uc);
  }

  async listAllForUser(userId: string) {
    // pega saldos existentes do usuário + metadados da moeda
    const rows = await this.repo
      .createQueryBuilder('uc')
      .leftJoin(Currency, 'c', 'c.id = uc.currencyId')
      .select([
        'uc.currencyId AS "currencyId"',
        'uc.amount AS "amount"',  // numeric -> string no PG
        'c.code AS "code"',
        'c.name AS "name"',
        'c.color AS "color"',
      ])
      .where('uc.userId = :userId', { userId })
      .getRawMany<{
        currencyId: string;
        amount: string;
        code: string;
        name: string;
        color: string;
      }>();

    const amountByCurrencyId = new Map<string, number>();
    for (const r of rows) {
      amountByCurrencyId.set(r.currencyId, round2(Number(r.amount)));
    }

    // garante que TODAS as moedas apareçam (as que não têm registro vêm com 0)
    const allCurrencies = await this.currencyRepo.find();

    return allCurrencies
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((c) => ({
        currencyId: c.id,
        code: c.code,
        name: c.name,
        color: c.color,
        amount: amountByCurrencyId.get(c.id) ?? 0,
      }));
  }

  private repoTx(manager: EntityManager) {
    return manager.getRepository(UserCurrency);
  }

  async getOrCreateTx(manager: EntityManager, userId: string, currencyId: string) {
    const r = this.repoTx(manager);
    let uc = await r.findOne({ where: { userId, currencyId } });
    if (!uc) {
      uc = r.create({ userId, currencyId, amount: 0 });
      uc = await r.save(uc);
    }
    return uc;
  }

  async creditTx(manager: EntityManager, userId: string, currencyId: string, amount: number) {
    const r = this.repoTx(manager);
    const uc = await this.getOrCreateTx(manager, userId, currencyId);
    uc.amount = round2(Number(uc.amount) + Number(amount));
    return r.save(uc);
  }

  async debitTx(manager: EntityManager, userId: string, currencyId: string, amount: number) {
    const r = this.repoTx(manager);
    const uc = await this.getOrCreateTx(manager, userId, currencyId);
    const after = round2(Number(uc.amount) - Number(amount));
    if (after < 0) throw new Error('Saldo insuficiente');
    uc.amount = after;
    return r.save(uc);
  }

}
