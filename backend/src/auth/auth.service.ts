import { Injectable, UnauthorizedException } from '@nestjs/common';
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

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UsersService,
    private readonly jwtService: JwtService,
    private readonly em: EntityManager,
    private readonly configService: ConfigService,
  ) {}

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
    const refreshSecret =
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');

    const refreshExpiresIn = this.configService.getOrThrow<string>(
      'JWT_REFRESH_EXPIRES_IN',
    ) as StringValue;

    const refreshExpiresInMs = ms(refreshExpiresIn);

    if (!refreshExpiresInMs || refreshExpiresInMs <= 0) {
      throw new Error('Invalid JWT_REFRESH_EXPIRES_IN value');
    }

    const sessionId = randomUUID();

    const refreshToken = await this.jwtService.signAsync(
      {
        ...payload,
        sid: sessionId,
        type: 'refresh',
      },
      {
        secret: refreshSecret,
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

    this.em.persist(session);
    await this.em.flush();

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
    };
  }

  async refresh(refreshTokenDto: RefreshTokenDto) {
    const refreshSecret =
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');

    let payload: {
      sub: string;
      email: string;
      sid: string;
      type: string;
    };

    try {
      payload = await this.jwtService.verifyAsync(
        refreshTokenDto.refreshToken,
        {
          secret: refreshSecret,
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

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
        secret: refreshSecret,
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
    }
  }
}
