import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import { ConfigService } from '@nestjs/config';
import { AccessTokenPayload } from '../interfaces/access-token-payload.interface';
import { EntityManager } from '@mikro-orm/core';
import { Session } from '../../sessions/entities/session.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly em: EntityManager,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: AccessTokenPayload) {
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.sid !== 'string'
    ) {
      throw new UnauthorizedException('Invalid access token');
    }

    const session = await this.em.findOne(Session, {
      id: payload.sid,
      user: {
        id: payload.sub,
      },
      revokedAt: null,
      expiresAt: {
        $gt: new Date(),
      },
    });

    if (!session) {
      throw new UnauthorizedException('Session is invalid or revoked');
    }

    return {
      id: payload.sub,
      email: payload.email,
    };
  }
}
