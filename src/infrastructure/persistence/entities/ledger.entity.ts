import {
  Entity,
  PrimaryKey,
  Property,
  Index,
} from '@mikro-orm/decorators/legacy';

@Entity({ tableName: 'wallet_ledger' })
export class LedgerEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Index()
  @Property({ type: 'uuid' })
  walletId!: string;

  @Property({ type: 'uuid' })
  transactionId!: string;

  @Property({ type: 'varchar', length: 50 })
  type!: string;

  @Property({ type: 'numeric', precision: 18, scale: 2 })
  amount!: string;

  @Property({ type: 'numeric', precision: 18, scale: 2 })
  balanceBefore!: string;

  @Property({ type: 'numeric', precision: 18, scale: 2 })
  balanceAfter!: string;

  @Property({ type: 'timestamp', default: 'NOW()' })
  createdAt: Date = new Date();
}
