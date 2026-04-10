import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refresh_token!: string;
}

export class DeviceLoginDto {
  @IsString()
  @IsNotEmpty()
  device_code!: string;

  @IsString()
  @IsNotEmpty()
  device_secret!: string;

  /** Optional: updates Device.deviceName on successful login (POS display name). */
  @IsOptional()
  @IsString()
  device_name?: string;
}

export class CashierLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
