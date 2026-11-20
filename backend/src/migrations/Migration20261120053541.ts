import { Migration } from '@mikro-orm/migrations';

export class Migration20261120053541 extends Migration {

  override name = 'Migration20261120053541';

  override up(): void | Promise<void> {
    this.addSql(`alter table "sessions" drop column "token_hash";`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "sessions" add "token_hash" varchar(255) not null;`);
  }

}
