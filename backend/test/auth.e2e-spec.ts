import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/core';
import request from 'supertest';
import { hash, verify } from 'argon2';
import { randomUUID } from 'node:crypto';

import { AppModule } from '../src/app.module';
import { User } from '../src/users/entities/user.entity';
import { Session } from '../src/sessions/entities/session.entity';
import { RefreshToken } from '../src/auth/refresh-token.entity';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let orm: MikroORM;

  let testUserId: string;
  let testEmail: string;
  let testPassword: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    await app.init();

    orm = app.get(MikroORM);
  });

  beforeEach(async () => {
    testEmail = `test-${randomUUID()}@example.com`;
    testPassword = 'TestPassword123!';

    const em = orm.em.fork();

    const passwordHash = await hash(testPassword);

    const user = em.create(User, {
      email: testEmail,
      passwordHash,
      firstName: 'Test',
      lastName: 'User',
      isActive: true,
    });

    em.persist(user);
    await em.flush()

    testUserId = user.id;
  });

  afterEach(async () => {
    const em = orm.em.fork();

    const sessions = await em.find(Session, {
      user: testUserId,
    });

    const sessionIds = sessions.map((session) => session.id);

    const refreshTokens =
      sessionIds.length > 0
        ? await em.find(RefreshToken, {
            session: { $in: sessionIds },
          })
        : [];

    const user = await em.findOne(User, {
      id: testUserId,
    });

    em.remove([...refreshTokens, ...sessions]);

    if (user) {
      em.remove(user);
    }

    await em.flush();
    em.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  async function login() {
    return request(app.getHttpServer()).post('/auth/login').send({
      email: testEmail,
      password: testPassword,
    });
  }

  describe('POST /auth/login', () => {
    it('should successfully authenticate user and create session', async () => {
      const response = await login();
      expect(response.status).toBe(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          tokenType: 'Bearer',
        }),
      );

      const em = orm.em.fork();

      const sessions = await em.find(Session, {
        user: testUserId,
      });

      expect(sessions).toHaveLength(1);

      const refreshTokens = await em.find(RefreshToken, {
        session: sessions[0].id,
      });

      expect(refreshTokens).toHaveLength(1);
      expect(refreshTokens[0].revokedAt).toBeNull();

      expect(refreshTokens[0].tokenHash).not.toBe(response.body.refreshToken);

      expect(
        await verify(refreshTokens[0].tokenHash, response.body.refreshToken),
      ).toBe(true);
    });

    it('should reject login with incorrect password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword123!',
        })
        .expect(401);

      const em = orm.em.fork();

      const sessions = await em.find(Session, {
        user: testUserId,
      });

      expect(sessions).toHaveLength(0);
    });

    it('should reject login for non-existent user', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testPassword,
        })
        .expect(401);
    });
  });

  describe('GET /auth/profile', () => {
    it('should return authenticated user profile', async () => {
      const loginResponse = await login();
      expect(loginResponse.status).toBe(201);

      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
        .expect(200);

      expect(response.body).toEqual({
        id: testUserId,
        email: testEmail,
      });
    });

    it('should reject request without access token', async () => {
      await request(app.getHttpServer()).get('/auth/profile').expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should rotate refresh token successfully', async () => {
      const loginResponse = await login();
      expect(loginResponse.status).toBe(201);


      const oldRefreshToken = loginResponse.body.refreshToken;

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          refreshToken: oldRefreshToken,
        })
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          tokenType: 'Bearer',
        }),
      );

      expect(response.body.refreshToken).not.toBe(oldRefreshToken);

      const em = orm.em.fork();

      const sessions = await em.find(Session, {
        user: testUserId,
      });

      expect(sessions).toHaveLength(1);

      const refreshTokens = await em.find(RefreshToken, {
        session: sessions[0].id,
      });

      expect(refreshTokens).toHaveLength(2);

      const revokedTokens = refreshTokens.filter(
        (token) => token.revokedAt !== null,
      );

      const activeTokens = refreshTokens.filter(
        (token) => token.revokedAt === null,
      );

      expect(revokedTokens).toHaveLength(1);
      expect(activeTokens).toHaveLength(1);

      expect(
        await verify(activeTokens[0].tokenHash, response.body.refreshToken),
      ).toBe(true);
    });

    it('should revoke session when an old refresh token is reused', async () => {
      const loginResponse = await login();
      expect(loginResponse.status).toBe(201);


      const oldRefreshToken = loginResponse.body.refreshToken;

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          refreshToken: oldRefreshToken,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          refreshToken: oldRefreshToken,
        })
        .expect(401);

      const em = orm.em.fork();

      const sessions = await em.find(Session, {
        user: testUserId,
      });

      expect(sessions).toHaveLength(1);
      expect(sessions[0].revokedAt).not.toBeNull();
    });

    it('should reject invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          refreshToken: 'invalid-token',
        })
        .expect(401);
    });

    it('should revoke the session when two refresh requests run concurrently', async () => {
      const loginResponse = await login();
      const oldRefreshToken = loginResponse.body.refreshToken;

      const responses = await Promise.all([
        request(app.getHttpServer())
          .post('/auth/refresh')
          .send({ refreshToken: oldRefreshToken }),

        request(app.getHttpServer())
          .post('/auth/refresh')
          .send({ refreshToken: oldRefreshToken }),
      ]);

      const statuses = responses.map((response) => response.status).sort();

      expect(statuses).toEqual([201, 401]);

      const successfulResponse = responses.find(
        (response) => response.status === 201,
      );

      expect(successfulResponse).toBeDefined();
      expect(successfulResponse!.body.refreshToken).toEqual(expect.any(String));

      const checkEm = orm.em.fork();

      const sessions = await checkEm.find(Session, {
        user: testUserId,
      });

      expect(sessions).toHaveLength(1);
      expect(sessions[0].revokedAt).not.toBeNull();

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          refreshToken: successfulResponse!.body.refreshToken,
        })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should revoke session and refresh token', async () => {
      const loginResponse = await login();
      expect(loginResponse.status).toBe(201);


      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({
          refreshToken: loginResponse.body.refreshToken,
        })
        .expect(201);

      const em = orm.em.fork();

      const sessions = await em.find(Session, {
        user: testUserId,
      });

      expect(sessions).toHaveLength(1);
      expect(sessions[0].revokedAt).not.toBeNull();

      const refreshTokens = await em.find(RefreshToken, {
        session: sessions[0].id,
      });

      expect(refreshTokens).toHaveLength(1);
      expect(refreshTokens[0].revokedAt).not.toBeNull();
    });

    it('should reject logout with already revoked refresh token', async () => {
      const loginResponse = await login();
      expect(loginResponse.status).toBe(201);


      const refreshToken = loginResponse.body.refreshToken;

      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken })
        .expect(401);
    });
  });

  describe('POST /auth/logout-all', () => {
    it('should revoke all user sessions and refresh tokens', async () => {
      const firstLogin = await login();
      expect(firstLogin.status).toBe(201);
      const secondLogin = await login();
      expect(secondLogin.status).toBe(201);

      const response = await request(app.getHttpServer())
        .post('/auth/logout-all')
        .set('Authorization', `Bearer ${firstLogin.body.accessToken}`)
        .expect(201);

      expect(response.body).toEqual({
        message: 'All sessions logged out successfully',
        revokedCount: 2,
      });

      const em = orm.em.fork();

      const sessions = await em.find(Session, {
        user: testUserId,
      });

      expect(sessions).toHaveLength(2);

      for (const session of sessions) {
        expect(session.revokedAt).not.toBeNull();

        const refreshTokens = await em.find(RefreshToken, {
          session: session.id,
        });

        expect(refreshTokens.length).toBeGreaterThan(0);

        for (const token of refreshTokens) {
          expect(token.revokedAt).not.toBeNull();
        }
      }
    });
  });

  describe('GET /auth/sessions', () => {
    it('should return active user sessions', async () => {
      const loginResponse = await login();
      expect(loginResponse.status).toBe(201);

      const response = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
        .expect(200);

      expect(response.body.sessions).toHaveLength(1);

      expect(response.body.sessions[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          createdAt: expect.any(String),
          expiresAt: expect.any(String),
        }),
      );
    });
  });

  describe('DELETE /auth/sessions/:id', () => {
    it('should revoke a specific session', async () => {
      const loginResponse = await login();

      const em = orm.em.fork();

      const session = await em.findOneOrFail(Session, {
        user: testUserId,
      });

      await request(app.getHttpServer())
        .delete(`/auth/sessions/${session.id}`)
        .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
        .expect(200);

      const checkEm = orm.em.fork();

      const updatedSession = await checkEm.findOneOrFail(Session, {
        id: session.id,
      });

      expect(updatedSession.revokedAt).not.toBeNull();

      const refreshTokens = await checkEm.find(RefreshToken, {
        session: session.id,
      });

      expect(refreshTokens.length).toBeGreaterThan(0);

      for (const token of refreshTokens) {
        expect(token.revokedAt).not.toBeNull();
      }
    });
  });
});
