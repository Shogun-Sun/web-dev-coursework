import { Migration } from '@mikro-orm/migrations';

export class Migration20261116093140 extends Migration {

  override name = 'Migration20261116093140';

  override up(): void | Promise<void> {
    this.addSql(`create table "sessions" ("id" uuid not null, "user_id" uuid not null, "token_hash" varchar(255) not null, "expires_at" timestamptz not null, "revoked_at" timestamptz null, "created_at" timestamptz not null, primary key ("id"));`);

    this.addSql(`alter table "sessions" add constraint "sessions_user_id_foreign" foreign key ("user_id") references "users" ("id");`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "sessions" cascade;`);
  }

}
