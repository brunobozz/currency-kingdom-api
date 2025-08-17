import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn
} from 'typeorm';

@Entity('currencies')
export class Currency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 16, unique: true })
  code: string;

  @Column({ length: 16 })
  color: string;

  @Column({ type: 'numeric', precision: 18, scale: 6, default: 1 })
  factorToBase: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
