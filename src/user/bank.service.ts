import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class BankService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) { }

  /** Retorna o ID do usuário do banco (isSystem=true) */
  async getBankUserId(): Promise<string> {
    const bank = await this.users.findOne({ where: { isSystem: true } });
    if (!bank) {
      throw new Error('Usuário do banco não existe. Crie um via POST /users com isSystem=true.');
    }
    return bank.id;
  }

  /** Retorna a entidade do usuário do banco (isSystem=true) */
  async getBankUser(): Promise<User> {
    const bank = await this.users.findOne({ where: { isSystem: true } });
    if (!bank) {
      throw new Error('Usuário do banco não existe. Crie um via POST /users com isSystem=true.');
    }
    return bank;
  }

  /** (Opcional) Verifica se já existe usuário do banco */
  async hasBankUser(): Promise<boolean> {
    const count = await this.users.count({ where: { isSystem: true } });
    return count > 0;
  }
}
