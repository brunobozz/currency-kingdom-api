import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn, Index
} from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { Currency } from 'src/currency/entities/currency.entity';

const round2 = (n: number) => Math.round(Number(n ?? 0) * 100) / 100;

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column('uuid')
  fromCurrencyId: string;

  @ManyToOne(() => Currency, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'fromCurrencyId' })
  fromCurrency: Currency;

  @Index()
  @Column('uuid')
  toCurrencyId: string;

  @ManyToOne(() => Currency, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'toCurrencyId' })
  toCurrency: Currency;

  // valores (2 casas)
  @Column({
    type: 'numeric', precision: 18, scale: 2,
    transformer: { to: round2, from: (v: string) => round2(v as any) }
  })
  fromAmount: number;

  // bruto (antes da taxa)
  @Column({
    type: 'numeric', precision: 18, scale: 2,
    transformer: { to: round2, from: (v: string) => round2(v as any) }
  })
  toAmountGross: number;

  // líquido (após taxa)
  @Column({
    type: 'numeric', precision: 18, scale: 2,
    transformer: { to: round2, from: (v: string) => round2(v as any) }
  })
  toAmountNet: number;

  // rate = quantos TO valem 1 FROM (até 6 casas)
  @Column({ type: 'numeric', precision: 18, scale: 6, default: 0 })
  rate: string;

  // cotação base da moeda ORIGEM (factorToBase no momento)
  @Column({ type: 'numeric', precision: 18, scale: 6, default: 0 })
  quoteFromToBase: string;

  // taxa cobrada pelo banco
  @Column({ type: 'numeric', precision: 6, scale: 5, default: 0 }) // ex.: 0.005
  feePercent: string;

  // valor da taxa na moeda destino (2 casas)
  @Column({
    type: 'numeric', precision: 18, scale: 2,
    transformer: { to: round2, from: (v: string) => round2(v as any) }
  })
  feeAmount: number;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
