import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { hash, verify } from 'argon2';
import { EntityManager, LockMode } from '@mikro-orm/core';
import { ConfigService } from '@nestjs/config';
import ms, { type StringValue } from 'ms';
import { randomUUID } from 'node:crypto';
import { Session } from '../sessions/entities/session.entity';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RefreshToken } from './refresh-token.entity';

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

    if (payload.type !== 'refresh' || !payload.sid || !payload.jti) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const refreshExpiresIn = this.configService.getOrThrow<string>(
      'JWT_REFRESH_EXPIRES_IN',
    ) as StringValue;

    const refreshExpiresInMs = ms(refreshExpiresIn);

    if (!refreshExpiresInMs || refreshExpiresInMs <= 0) {
      throw new Error('Invalid JWT_REFRESH_EXPIRES_IN value');
    }

    const result = await this.em.transactional(async (em) => {
      const session = await em.findOne(
        Session,
        {
          id: payload.sid,
        },
        {
          populate: ['user'],
          lockMode: LockMode.PESSIMISTIC_WRITE,
        },
      );

      if (!session) {
        return { status: 'invalid' as const };
      }

      const storedToken = await em.findOne(RefreshToken, {
        jti: payload.jti,
        session: session.id,
      });

      if (!storedToken) {
        return { status: 'invalid' as const };
      }

      if (storedToken.revokedAt) {
        if (!session.revokedAt) {
          session.revokedAt = new Date();
          await em.flush();
        }

        return { status: 'reused' as const };
      }

      const now = new Date();

      if (
        session.revokedAt ||
        session.expiresAt <= now ||
        storedToken.expiresAt <= now ||
        session.user.id !== payload.sub
      ) {
        return { status: 'invalid' as const };
      }

      const isTokenValid = await verify(
        storedToken.tokenHash,
        refreshTokenDto.refreshToken,
      );

      if (!isTokenValid) {
        return { status: 'invalid' as const };
      }

      storedToken.revokedAt = now;

      const newJti = randomUUID();

      const newRefreshToken = await this.jwtService.signAsync(
        {
          sub: session.user.id,
          email: session.user.email,
          sid: session.id,
          jti: newJti,
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

      const newTokenHash = await hash(newRefreshToken);
      const newExpiresAt = new Date(now.getTime() + refreshExpiresInMs);

      session.expiresAt = newExpiresAt;

      const newRefreshTokenEntity = em.create(RefreshToken, {
        session,
        jti: newJti,
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
      });

      em.persist(newRefreshTokenEntity);

      await em.flush();

      return {
        status: 'success' as const,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    });

    if (result.status === 'reused') {
      throw new UnauthorizedException(
        'Refresh token reuse detected. Session revoked.',
      );
    }

    if (result.status === 'invalid') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      tokenType: 'Bearer',
    };
  }

  async logout(refreshTokenDto: RefreshTokenDto) {
    const payload = await this.verifyRefreshToken(refreshTokenDto.refreshToken);

    return this.em.transactional(async (transactionalEm) => {
      const session = await transactionalEm.findOne(
        Session,
        {
          id: payload.sid,
          user: {
            id: payload.sub,
          },
        },
        {
          populate: ['user'],
          lockMode: LockMode.PESSIMISTIC_WRITE,
        },
      );

      if (!session || session.expiresAt <= new Date()) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (session.revokedAt) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const refreshToken = await transactionalEm.findOne(RefreshToken, {
        jti: payload.jti,
        session: session.id,
      });

      if (
        !refreshToken ||
        refreshToken.revokedAt ||
        refreshToken.expiresAt <= new Date()
      ) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const isTokenValid = await verify(
        refreshToken.tokenHash,
        refreshTokenDto.refreshToken,
      );

      if (!isTokenValid) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const now = new Date();

      session.revokedAt = now;

      const activeRefreshTokens = await transactionalEm.find(RefreshToken, {
        session: session.id,
        revokedAt: null,
      });

      for (const activeRefreshToken of activeRefreshTokens) {
        activeRefreshToken.revokedAt = now;
      }

      await transactionalEm.flush();

      return {
        message: 'Logged out successfully',
      };
    });
  }

  private async verifyRefreshToken(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
        sid: string;
        jti: string;
        type: string;
      }>(refreshToken, {
        secret: this.refreshSecret,
      });

      if (
        payload.type !== 'refresh' ||
        typeof payload.sid !== 'string' ||
        typeof payload.jti !== 'string' ||
        typeof payload.sub !== 'string' ||
        !payload.sid ||
        !payload.jti ||
        !payload.sub
      ) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logoutAll(userId: string) {
    return this.em.transactional(async (transactionalEm) => {
      const sessions = await transactionalEm.find(
        Session,
        {
          user: {
            id: userId,
          },
          revokedAt: null,
        },
        {
          lockMode: LockMode.PESSIMISTIC_WRITE,
        },
      );
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

      const sessionIds = sessions.map((session) => session.id);
      const refreshTokens = await transactionalEm.find(RefreshToken, {
        session: {
          id: {
            $in: sessionIds,
          },
        },
        revokedAt: null,
      });
      for (const refreshToken of refreshTokens) {
        refreshToken.revokedAt = now;
      }

      await transactionalEm.flush();

      return {
        message: 'All sessions logged out successfully',
        revokedCount: sessions.length,
      };
    });
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
    return this.em.transactional(async (transactionalEm) => {
      const session = await transactionalEm.findOne(
        Session,
        {
          id: sessionId,
          user: {
            id: userId,
          },
        },
        {
          lockMode: LockMode.PESSIMISTIC_WRITE,
        },
      );

      if (!session) {
        throw new NotFoundException('Session not found');
      }

      if (session.revokedAt) {
        return {
          message: 'Session already revoked',
        };
      }

      const now = new Date();

      session.revokedAt = now;

      const activeRefreshTokens = await transactionalEm.find(RefreshToken, {
        session: session.id,
        revokedAt: null,
      });

      for (const activeRefreshToken of activeRefreshTokens) {
        activeRefreshToken.revokedAt = now;
      }

      await transactionalEm.flush();

      return {
        message: 'Session revoked successfully',
      };
    });
  }
}
