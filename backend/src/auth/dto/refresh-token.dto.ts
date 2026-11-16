import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'RefreshToken',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
