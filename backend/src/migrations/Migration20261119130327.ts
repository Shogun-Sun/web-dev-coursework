import { Migration } from '@mikro-orm/migrations';

export class Migration20261119130327 extends Migration {

  override name = 'Migration20261119130327';

  override up(): void | Promise<void> {
    this.addSql(`create table "refresh_tokens" ("id" uuid not null, "session_id" uuid not null, "jti" varchar(255) not null, "token_hash" varchar(255) not null, "expires_at" date not null, "revoked_at" date null, "created_at" date not null, primary key ("id"));`);
    this.addSql(`alter table "refresh_tokens" add constraint "refresh_tokens_jti_unique" unique ("jti");`);

    this.addSql(`alter table "refresh_tokens" add constraint "refresh_tokens_session_id_foreign" foreign key ("session_id") references "sessions" ("id");`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "refresh_tokens" cascade;`);
  }

}
