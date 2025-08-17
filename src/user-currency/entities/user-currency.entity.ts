import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index, Unique
} from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { Currency } from 'src/currency/entities/currency.entity';

const round2 = (n: number) => Math.round(n * 100) / 100;

@Entity('user_currencies')
@Unique('UQ_user_currency', ['userId', 'currencyId'])
export class UserCurrency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  userId: string;

  @Index()
  @Column('uuid')
  currencyId: string;

  // NUMERIC(18,2) para evitar erro binário do double
  @Column({
    type: 'numeric', precision: 18, scale: 2, default: 0,
    transformer: {
      to: (v: number) => round2(Number(v ?? 0)),
      from: (v: string) => round2(Number(v ?? 0)),
    }
  })
  amount: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Currency, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'currencyId' })
  currency: Currency;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
