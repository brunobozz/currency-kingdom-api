import { IsEmail, IsNotEmpty, MinLength, IsOptional, IsBoolean } from 'class-validator';

export class RegisterDto {
  @IsNotEmpty() name: string;
  @IsEmail() email: string;
  @MinLength(6) password: string;
  @IsOptional() @IsBoolean() isAdmin?: boolean;
}
