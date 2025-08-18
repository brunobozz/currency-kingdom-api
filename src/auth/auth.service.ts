import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../user/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(private users: UserService, private jwt: JwtService) { }

  async register(dto: RegisterDto) {
    // checa duplicidade
    const exists = await this.users.findByEmail(dto.email);
    if (exists) throw new ConflictException('Já existe um usuário com esse email.');

    // cria usuário (hash por hook no entity)
    const user = await this.users.create({
      name: dto.name,
      email: dto.email,
      password: dto.password,
      isAdmin: false,
    });

    return this.buildToken(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findAuthUserByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    if (!user) throw new UnauthorizedException('Credenciais inválidas');

    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) throw new UnauthorizedException('Credenciais inválidas');

    return this.buildToken(user);
  }

  private buildToken(user: User) {
    const payload = { sub: user.id, email: user.email, isAdmin: user.isAdmin };
    const access_token = this.jwt.sign(payload);
    return {
      access_token,
      user: { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin },
    };
  }
}
