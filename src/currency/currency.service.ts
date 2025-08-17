// src/currency/currency.service.ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Currency } from './entities/currency.entity';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';

@Injectable()
export class CurrencyService {
  constructor(
    @InjectRepository(Currency)
    private readonly repo: Repository<Currency>,
  ) {}

  async create(dto: CreateCurrencyDto): Promise<Currency> {
    try {
      const currency = this.repo.create(dto);
      return await this.repo.save(currency);
    } catch (e: any) {
      if (e?.code === '23505') {
        // unique_violation (code)
        throw new ConflictException('Já existe uma moeda com esse código.');
      }
      throw e;
    }
  }

  findAll(): Promise<Currency[]> {
    return this.repo.find();
  }

  async findOne(id: string): Promise<Currency> {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Moeda não encontrada');
    return c;
  }

  findByCode(code: string): Promise<Currency | null> {
    return this.repo.findOne({ where: { code } });
  }

  async update(id: string, dto: UpdateCurrencyDto): Promise<Currency> {
    const currency = await this.findOne(id);
    Object.assign(currency, dto);
    try {
      return await this.repo.save(currency);
    } catch (e: any) {
      if (e?.code === '23505') {
        throw new ConflictException('Já existe uma moeda com esse código.');
      }
      throw e;
    }
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
