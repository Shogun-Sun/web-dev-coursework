import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { hash, verify } from 'argon2';
import { EntityManager } from '@mikro-orm/core';
import { ConfigService } from '@nestjs/config';
import ms, { type StringValue } from 'ms';
import { randomUUID } from 'node:crypto';
import { Session } from '../sessions/entities/session.entity';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import {RefreshToken} from "./refresh-token.entity";

@Injectable()
export class AuthService {
  private readonly refreshSecret: string;

  constructor(
    private readonly userService: UsersService,
    private readonly jwtService: JwtService,
    private readonly em: EntityManager,
    private readonly configService: ConfigService,
  ) {
    this.refreshSecret =
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  async login(loginDto: LoginDto) {
    const user = await this.userService.findByEmail(loginDto.email);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await verify(user.passwordHash, loginDto.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = {
      sub: user.id,
      email: user.email,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    const refreshExpiresIn = this.configService.getOrThrow<string>(
      'JWT_REFRESH_EXPIRES_IN',
    ) as StringValue;

    const refreshExpiresInMs = ms(refreshExpiresIn);

    if (!refreshExpiresInMs || refreshExpiresInMs <= 0) {
      throw new Error('Invalid JWT_REFRESH_EXPIRES_IN value');
    }

    const sessionId = randomUUID();
    const jti = randomUUID();


    const refreshToken = await this.jwtService.signAsync(
      {
        ...payload,
        sid: sessionId,
        jti,
        type: 'refresh',
      },
      {
        secret: this.refreshSecret,
        expiresIn: refreshExpiresInMs,
      },
    );

    const tokenHash = await hash(refreshToken);

    const session = this.em.create(Session, {
      id: sessionId,
      user,
      tokenHash,
      expiresAt: new Date(Date.now() + refreshExpiresInMs),
    });

    const refreshTokenEntity = this.em.create(RefreshToken, {
      session,
      jti,
      tokenHash,
      expiresAt: session.expiresAt,
    });

    this.em.persist([session, refreshTokenEntity]);
    await this.em.flush();

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
    };
  }

  async refresh(refreshTokenDto: RefreshTokenDto) {
    const payload = await this.verifyRefreshToken(refreshTokenDto.refreshToken);

    if (payload.type !== 'refresh' || !payload.sid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.em.findOne(
      Session,
      {
        id: payload.sid,
      },
      { populate: ['user'] },
    );

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.id !== payload.sub
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isTokenValid = await verify(
      session.tokenHash,
      refreshTokenDto.refreshToken,
    );

    if (!isTokenValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const refreshExpiresIn = this.configService.getOrThrow<string>(
      'JWT_REFRESH_EXPIRES_IN',
    ) as StringValue;

    const refreshExpiresInMs = ms(refreshExpiresIn);

    if (!refreshExpiresInMs || refreshExpiresInMs <= 0) {
      throw new Error('Invalid JWT_REFRESH_EXPIRES_IN value');
    }

    const newRefreshToken = await this.jwtService.signAsync(
      {
        sub: session.user.id,
        email: session.user.email,
        sid: session.id,
        type: 'refresh',
      },
      {
        secret: this.refreshSecret,
        expiresIn: refreshExpiresInMs,
      },
    );

    const newAccessToken = await this.jwtService.signAsync({
      sub: session.user.id,
      email: session.user.email,
    });

    session.tokenHash = await hash(newRefreshToken);
    session.expiresAt = new Date(Date.now() + refreshExpiresInMs);

    await this.em.flush();

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      tokenType: 'Bearer',
    };
  }

  async logout(refreshTokenDto: RefreshTokenDto) {
    const payload = await this.verifyRefreshToken(refreshTokenDto.refreshToken);

    const session = await this.em.findOne(
      Session,
      {
        id: payload.sid,
      },
      { populate: ['user'] },
    );

    if (
      !session ||
      session.user.id !== payload.sub ||
      session.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isTokenValid = await verify(
      session.tokenHash,
      refreshTokenDto.refreshToken,
    );

    if (!isTokenValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!session.revokedAt) {
      session.revokedAt = new Date();
      await this.em.flush();
    }

    return {
      message: 'Logged out successfully',
    };
  }

  private async verifyRefreshToken(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
        sid: string;
        type: string;
      }>(refreshToken, {
        secret: this.refreshSecret,
      });

      if (payload.type !== 'refresh' || !payload.sid) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logoutAll(userId: string) {
    const sessions = await this.em.find(Session, {
      user: { id: userId },
      revokedAt: null,
    });

    if (sessions.length === 0) {
      return {
        message: 'All sessions logged out successfully',
        revokedCount: 0,
      };
    }

    const now = new Date();

    for (const session of sessions) {
      session.revokedAt = now;
    }

    await this.em.flush();

    return {
      message: 'All sessions logged out successfully',
      revokedCount: sessions.length,
    };
  }

  async getActiveSessions(userId: string) {
    const sessions = await this.em.find(
      Session,
      {
        user: { id: userId },
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      },
      {
        orderBy: {
          createdAt: 'DESC',
        },
      },
    );

    return {
      sessions: sessions.map((session) => ({
        id: session.id,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      })),
    };
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.em.findOne(Session, {
      id: sessionId,
      user: { id: userId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.revokedAt) {
      return {
        message: 'Session already revoked',
      };
    }

    session.revokedAt = new Date();

    await this.em.flush();

    return {
      message: 'Session revoked successfully',
    };
  }
}
