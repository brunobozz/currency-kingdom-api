import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserCurrency } from './entities/user-currency.entity';

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class UserCurrencyService {
  constructor(
    @InjectRepository(UserCurrency)
    private readonly repo: Repository<UserCurrency>,
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

}
