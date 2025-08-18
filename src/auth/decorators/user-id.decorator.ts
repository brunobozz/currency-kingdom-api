import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const UserId = createParamDecorator((data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest();
  const u = req.user || {};
  return u.id ?? u.sub ?? u.userId ?? u.uid ?? u.user_id ?? u.payload?.sub ?? u.payload?.id;
});
