// src/currency/currency.service.ts
import { ConflictException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Currency } from './entities/currency.entity';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';

const to6 = (n: number) => Number.isFinite(n) ? Math.round(n * 1_000_000) / 1_000_000 : NaN;
const round2 = (n: number) => Math.round(Number(n ?? 0) * 100) / 100;
const FEE_PERCENT = 0.005; 

@Injectable()
export class CurrencyService {
  constructor(
    @InjectRepository(Currency)
    private readonly repo: Repository<Currency>,
  ) { }

  async create(dto: CreateCurrencyDto): Promise<Currency> {
    try {
      const factor =
        dto.factorToBase === undefined ? 1 : to6(Number(dto.factorToBase));

      if (!factor || factor <= 0) {
        throw new BadRequestException('factorToBase inválido (precisa ser > 0).');
      }

      const currency = this.repo.create({
        ...dto,
        factorToBase: String(factor),
      });

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

  async update(id: string, dto: UpdateCurrencyDto): Promise<Currency> {
    const currency = await this.findOne(id);

    if (dto.factorToBase !== undefined) {
      const factor = to6(Number(dto.factorToBase));
      if (!factor || factor <= 0) {
        throw new BadRequestException('factorToBase inválido (precisa ser > 0).');
      }
      (currency as any).factorToBase = String(factor);
      delete (dto as any).factorToBase; // evita sobrepor abaixo
    }

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

  async findByCodeOrThrow(code: string): Promise<Currency> {
    const c = await this.repo.findOne({ where: { code } });
    if (!c) throw new NotFoundException(`Moeda ${code} não encontrada`);
    return c;
  }

  async setRate(code: string, factorToBase: number) {
    const factor = to6(Number(factorToBase));
    if (!factor || factor <= 0) {
      throw new BadRequestException('factorToBase inválido (precisa ser > 0).');
    }
    const c = await this.findByCodeOrThrow(code);
    c.factorToBase = String(factor); // salvar como string para numeric
    return this.repo.save(c);
  }

  /** Simula conversão */
  async previewConvert(fromCode: string, toCode: string, amount: number) {
    if (amount <= 0) throw new BadRequestException('amount deve ser > 0');
    const amt = round2(amount);

    const from = await this.findByCodeOrThrow(fromCode);
    const to = await this.findByCodeOrThrow(toCode);

    if (from.code === to.code) {
      // sem taxa quando mesma moeda (opcional)
      return {
        fromCode, toCode, amount: amt,
        rate: 1,
        toAmountGross: amt,
        feePercent: FEE_PERCENT,
        feeAmount: 0,
        toAmountNet: amt,
        // para compat: result = líquido
        result: amt,
      };
    }

    const fFrom = Number(from.factorToBase);
    const fTo = Number(to.factorToBase);
    if (!fFrom || !fTo) {
      throw new BadRequestException('factorToBase inválido para alguma moeda');
    }

    // rate = quantos TO valem 1 FROM
    const rate = to6(fTo / fFrom);

    // bruto (antes da taxa)
    const toAmountGross = round2(amt * rate);

    // taxa (0,5%) na moeda destino
    const feeAmount = round2(toAmountGross * FEE_PERCENT);

    // líquido (após taxa)
    const toAmountNet = round2(toAmountGross - feeAmount);

    return {
      fromCode,
      toCode,
      amount: amt,
      rate,                 // TO por 1 FROM
      toAmountGross,        // bruto (2 casas)
      feePercent: FEE_PERCENT,
      feeAmount,            // 2 casas
      toAmountNet,          // líquido (2 casas)
      // manter "result" para compatibilidade (líquido)
      result: toAmountNet,
    };
  }
}
