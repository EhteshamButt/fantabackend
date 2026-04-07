import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateGeneralSettingDto {
  @IsOptional()
  @IsString()
  siteTitle?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  currencySymbol?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  siteBaseColor?: string;

  @IsOptional()
  @IsString()
  siteSecondaryColor?: string;

  @IsOptional()
  @IsNumber()
  registrationBonus?: number;

  @IsOptional()
  @IsString()
  defaultPlan?: string;

  @IsOptional()
  @IsNumber()
  balanceTransferFixedCharge?: number;

  @IsOptional()
  @IsNumber()
  balanceTransferPercentCharge?: number;
}

