import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
} from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Currency } from 'src/currency/entities/currency.entity';
import { UserCurrency } from 'src/user-currency/entities/user-currency.entity';

const round2 = (n: number) => Math.round(Number(n ?? 0) * 100) / 100;

type UserWithBalances = User & {
  balances: Array<{
    currencyId: string;
    code: string;
    name: string;
    color: string;
    amount: number; // 2 casas
  }>;
};

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Currency)
    private readonly currencyRepository: Repository<Currency>,

    @InjectRepository(UserCurrency)
    private readonly userCurrencyRepository: Repository<UserCurrency>,

    private readonly dataSource: DataSource,
  ) { }

  // CREATE com transação + carteiras zeradas
  async create(createUserDto: CreateUserDto): Promise<UserWithBalances> {
    try {
      const created = await this.dataSource.transaction(async (manager) => {
        const userRepo = manager.getRepository(User);
        const currencyRepo = manager.getRepository(Currency);
        const userCurrencyRepo = manager.getRepository(UserCurrency);

        const user = userRepo.create(createUserDto);
        const saved = await userRepo.save(user);

        const currencies = await currencyRepo.find();
        if (currencies.length > 0) {
          await userCurrencyRepo
            .createQueryBuilder()
            .insert()
            .into(UserCurrency)
            .values(
              currencies.map((c) => ({
                userId: saved.id,
                currencyId: c.id,
                amount: 0,
              })),
            )
            .onConflict(`("userId","currencyId") DO NOTHING`)
            .execute();
        }

        return saved;
      });

      // retorna já com balances
      return await this.findOne(created.id);
    } catch (error: any) {
      if (error?.code === '23505') {
        // unique_violation (Postgres)
        throw new ConflictException('Já existe um usuário com esse email.');
      }
      throw error;
    }
  }

  // LISTAR todos (exclui isSystem)
  async findAll(): Promise<UserWithBalances[]> {
    const users = await this.userRepository.find({ where: { isSystem: false } });
    if (users.length === 0) return [];
    return this.attachBalances(users);
  }

  // BUSCAR por email (exclui isSystem)
  async findByEmail(email: string): Promise<UserWithBalances | null> {
    const user = await this.userRepository.findOne({ where: { email, isSystem: false } });
    if (!user) return null;
    const [withBalances] = await this.attachBalances([user]);
    return withBalances;
  }

  // BUSCAR por id (exclui isSystem)
  async findOne(id: string): Promise<UserWithBalances> {
    const user = await this.userRepository.findOne({ where: { id, isSystem: false } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    const [withBalances] = await this.attachBalances([user]);
    return withBalances;
  }

  // UPDATE (opcionalmente blinda system user)
  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserWithBalances> {
    const user = await this.userRepository.findOne({ where: { id, isSystem: false } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    Object.assign(user, updateUserDto);
    const saved = await this.userRepository.save(user);
    const [withBalances] = await this.attachBalances([saved]);
    return withBalances;
  }

  // DELETE (opcionalmente blinda system user)
  async remove(id: string): Promise<void> {
    // só remove se NÃO for system
    const user = await this.userRepository.findOne({ where: { id, isSystem: false } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    await this.userRepository.delete(id);
  }

  /**
   * Helper: agrega saldos (UserCurrency + Currency) nos usuários informados.
   * Retorna cada usuário com "balances": [{ currencyId, code, name, amount }]
   */
  private async attachBalances(users: User[]): Promise<UserWithBalances[]> {
    const userIds = users.map((u) => u.id);

    // 1) Moedas já ordenadas por criação (ordem canônica do output)
    const currencies = await this.currencyRepository.find({
      order: { createdAt: 'ASC' },
      select: ['id', 'code', 'name', 'color', 'createdAt'],
    });

    // 2) Saldos existentes dos usuários (sem join, só o necessário)
    const rows = await this.userCurrencyRepository
      .createQueryBuilder('uc')
      .select([
        'uc.userId AS "userId"',
        'uc.currencyId AS "currencyId"',
        'uc.amount AS "amount"', // numeric -> string
      ])
      .where('uc.userId IN (:...userIds)', { userIds })
      .getRawMany<{ userId: string; currencyId: string; amount: string }>();

    // 3) Indexa saldos por usuário -> (currencyId -> amount)
    const amountsByUser: Record<string, Map<string, number>> = {};
    for (const r of rows) {
      const map = amountsByUser[r.userId] || (amountsByUser[r.userId] = new Map());
      map.set(r.currencyId, round2(Number(r.amount)));
    }

    // 4) Monta a resposta final seguindo a ordem de `currencies`
    return users.map((u) => {
      const map = amountsByUser[u.id] || new Map<string, number>();
      const balances = currencies.map((c) => ({
        currencyId: c.id,
        code: c.code,
        name: c.name,
        color: c.color,                         // 👈 incluído
        amount: map.get(c.id) ?? 0,             // moedas sem registro => 0
      }));
      return { ...(u as any), balances };
    });
  }


  async findSystem(): Promise<UserWithBalances> {
    const user = await this.userRepository.findOne({ where: { isSystem: true } });
    if (!user) throw new NotFoundException('Usuário do sistema não encontrado');
    const [withBalances] = await this.attachBalances([user]);
    return withBalances;
  }
}
