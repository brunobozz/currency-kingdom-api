import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

//MODULES
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { CurrencyModule } from './currency/currency.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      synchronize: true,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      ssl: {
        rejectUnauthorized: false,
      },
    }),
    AuthModule,
    UserModule,
    CurrencyModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
