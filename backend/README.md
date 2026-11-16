# Project Setup

## 1. Clone the repository

```bash
git clone https://github.com/Shogun-Sun/web-dev-coursework.git
cd coursework
```

## 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in the required values in `.env`.

Generate a JWT secret:

```bash
openssl rand -base64 48
```

## 3. Start PostgreSQL

Run from the project root directory:

```bash
docker compose up -d
```

## 4. Install backend dependencies

```bash
cd backend
npm ci
```

## 5. Run migrations and seed the database

```bash
npm run orm -- migration:up
npm run orm -- seeder:run
```

## 6. Start the backend

```bash
npm run start:dev
```

## 7. API Documentation

Swagger UI:

```text
http://localhost:3000/api/docs
```