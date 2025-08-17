// src/currency/currency.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { CurrencyService } from './currency.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SetRateDto } from './dto/set-rate.dto';
import { ConvertPreviewDto } from './dto/convert-preview.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('currencies')
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) { }

  @Roles('admin')
  @Post()
  create(@Body() dto: CreateCurrencyDto) {
    return this.currencyService.create(dto);
  }

  @Get()
  findAll() {
    return this.currencyService.findAll();
  }

  @Roles()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.currencyService.findOne(id);
  }

  @Roles('admin')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCurrencyDto) {
    return this.currencyService.update(id, dto);
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.currencyService.remove(id);
  }

  @Roles()
  @Get('code/:code')
  findByCode(@Param('code') code: string) {
    return this.currencyService.findByCodeOrThrow(code);
  }

  @Roles('admin')
  @Post('rate')
  setRate(@Body() dto: SetRateDto) {
    return this.currencyService.setRate(dto.code, dto.factorToBase);
  }

  @Roles()
  @Post('convert-preview')
  preview(@Body() dto: ConvertPreviewDto) {
    return this.currencyService.previewConvert(dto.fromCode, dto.toCode, dto.amount);
  }
}
