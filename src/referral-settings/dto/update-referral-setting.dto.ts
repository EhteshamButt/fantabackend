import { IsArray, IsBoolean, IsNumber, IsOptional, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class LevelDto {
  @IsNumber()
  @Min(1)
  level: number;

  @IsNumber()
  @Min(0)
  percentage: number;
}

export class UpdateReferralSettingDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LevelDto)
  levels: LevelDto[];
}

export class ToggleReferralSettingDto {
  @IsBoolean()
  enabled: boolean;
}
