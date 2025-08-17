import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

type ReqUser = { userId: string; email: string; isAdmin?: boolean; roles?: string[] };

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    // Lê @Roles() do handler e, se não houver, do controller
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    // Se a rota não requer papéis específicos, libera
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = req.user as ReqUser | undefined;
    if (!user) return false; // JwtAuthGuard deve rodar antes para popular req.user

    // Normaliza os papéis do usuário
    // Se você só usa 'admin' vs 'user', derive 'admin' a partir de isAdmin:
    const userRoles = new Set<string>([
      ...(user.roles ?? []),
      user.isAdmin ? 'admin' : 'user',
    ]);

    // Regra: se o endpoint exigir algum papel, basta o usuário ter um deles
    return requiredRoles.some(role => userRoles.has(role));
  }
}
