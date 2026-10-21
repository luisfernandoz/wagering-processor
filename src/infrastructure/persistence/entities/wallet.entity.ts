import {
  Entity,
  PrimaryKey,
  Property,
  Check,
} from '@mikro-orm/decorators/legacy';

@Entity({ tableName: 'wallets' })
@Check({ expression: 'balance >= 0' })
export class WalletEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'varchar', length: 255 })
  userId!: string;

  @Property({ type: 'numeric', precision: 18, scale: 2 })
  balance!: string;

  @Property({ type: 'varchar', length: 3 })
  currency!: string;

  @Property({ type: 'int', version: true })
  version!: number;

  @Property({ type: 'timestamp', default: 'NOW()' })
  createdAt!: Date;

  @Property({ type: 'timestamp', default: 'NOW()' })
  updatedAt!: Date;

  constructor(id: string, userId: string, balance: string, currency: string) {
    this.id = id;
    this.userId = userId;
    this.balance = balance;
    this.currency = currency;
    this.version = 1;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}
