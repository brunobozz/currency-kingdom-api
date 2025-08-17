import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('/api/v1');
  app.enableCors();
  const port = process.env.PORT || 3001;
  await app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
  });
}
bootstrap();



