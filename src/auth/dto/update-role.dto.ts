import { IsEnum, IsNotEmpty } from 'class-validator';
import { Role } from '../../users/user.schema';

export class UpdateRoleDto {
  @IsEnum(Role)
  @IsNotEmpty()
  role: Role;
}
