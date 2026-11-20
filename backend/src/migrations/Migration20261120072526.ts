import { Migration } from '@mikro-orm/migrations';

export class Migration20261120072526 extends Migration {

  override name = 'Migration20261120072526';

  override up(): void | Promise<void> {
    this.addSql(`alter table "sessions" add "ip_address" varchar(255) null, add "user_agent" varchar(255) null, add "device_name" varchar(255) null, add "last_activity_at" timestamptz not null default now();`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "sessions" drop column "ip_address", drop column "user_agent", drop column "device_name", drop column "last_activity_at";`);
  }

}
