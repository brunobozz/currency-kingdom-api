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

  // LISTAR todos com balances
  async findAll(): Promise<UserWithBalances[]> {
    const users = await this.userRepository.find();
    if (users.length === 0) return [];

    const usersWithBalances = await this.attachBalances(users);
    return usersWithBalances;
  }

  // BUSCAR por email (retorna com balances)
  async findByEmail(email: string): Promise<UserWithBalances | null> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) return null;
    const [withBalances] = await this.attachBalances([user]);
    return withBalances;
  }

  // BUSCAR por id (retorna com balances)
  async findOne(id: string): Promise<UserWithBalances> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    const [withBalances] = await this.attachBalances([user]);
    return withBalances;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserWithBalances> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    Object.assign(user, updateUserDto);
    const saved = await this.userRepository.save(user);
    const [withBalances] = await this.attachBalances([saved]);
    return withBalances;
  }

  async remove(id: string): Promise<void> {
    await this.userRepository.delete(id);
  }

  /**
   * Helper: agrega saldos (UserCurrency + Currency) nos usuários informados.
   * Retorna cada usuário com "balances": [{ currencyId, code, name, amount }]
   */
  private async attachBalances(users: User[]): Promise<UserWithBalances[]> {
    const userIds = users.map((u) => u.id);
    // Busca todos os saldos dos usuários informados, já com join nas moedas
    const rows = await this.userCurrencyRepository
      .createQueryBuilder('uc')
      .leftJoin(Currency, 'c', 'c.id = uc.currencyId')
      .select([
        'uc.userId AS "userId"',
        'uc.currencyId AS "currencyId"',
        'uc.amount AS "amount"',
        'c.code AS "code"',
        'c.name AS "name"',
      ])
      .where('uc.userId IN (:...userIds)', { userIds })
      .getRawMany<{
        userId: string;
        currencyId: string;
        amount: string;
        code: string;
        name: string;
      }>();

    // Agrupa por userId
    const byUser: Record<string, UserWithBalances['balances']> = {};
    for (const r of rows) {
      const list = byUser[r.userId] || (byUser[r.userId] = []);
      list.push({
        currencyId: r.currencyId,
        code: r.code,
        name: r.name,
        amount: round2(Number(r.amount)),
      });
    }

    // Para moedas que ainda não têm registro (teoricamente não ocorre
    // porque criamos tudo no create), você pode opcionalmente preencher 0
    // consultando todas as moedas. Se quiser garantir:
    const allCurrencies = await this.currencyRepository.find();
    const ensureAllBalances = (userId: string, balances: UserWithBalances['balances']) => {
      const map = new Map(balances.map(b => [b.currencyId, b]));
      for (const c of allCurrencies) {
        if (!map.has(c.id)) {
          balances.push({
            currencyId: c.id,
            code: c.code,
            name: c.name,
            amount: 0,
          });
        }
      }
      // opcional: ordenar por code
      balances.sort((a, b) => a.code.localeCompare(b.code));
      return balances;
    };

    // Monta resposta final
    return users.map((u) => {
      const balances = ensureAllBalances(u.id, byUser[u.id] ?? []);
      return { ...(u as any), balances };
    });
  }
}
