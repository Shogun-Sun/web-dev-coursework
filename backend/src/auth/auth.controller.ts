import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  Res,
  Delete,
  Param,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { type AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { type Request } from 'express';
import { UAParser } from 'ua-parser-js';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({
    default: {
      limit: 5,
      ttl: 60_000,
    },
  })
  @ApiOperation({ summary: 'User login' })
  login(@Body() loginDto: LoginDto, @Req() request: Request) {
    const userAgent = request.headers['user-agent'];

    const parser = new UAParser(userAgent);
    const result = parser.getResult();

    const deviceName = [
      result.browser.name,
      result.os.name,
      result.device.type ?? 'Desktop',
    ]
      .filter(Boolean)
      .join(' / ');

    return this.authService.login(loginDto, {
      ipAddress: request.ip,
      userAgent: userAgent,
      deviceName: deviceName,
    });
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get Current user profile' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Post('refresh')
  @Throttle({
    default: {
      limit: 10,
      ttl: 60_000,
    },
  })
  @ApiOperation({ summary: 'Refresh access and refresh tokens' })
  refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refresh(refreshTokenDto);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout from current session' })
  logout(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.logout(refreshTokenDto);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Logout from all sessions' })
  logoutAll(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logoutAll(user.id);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get active sessions' })
  getActiveSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getActiveSessions(user.id);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke a specific session' })
  revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') sessionId: string,
  ) {
    return this.authService.revokeSession(user.id, sessionId);
  }
}
