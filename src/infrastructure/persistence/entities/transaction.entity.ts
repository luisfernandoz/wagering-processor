import {
  Entity,
  PrimaryKey,
  Property,
  Index,
} from '@mikro-orm/decorators/legacy';

@Entity({ tableName: 'transactions' })
@Index({
  properties: ['providerId', 'externalTransactionId'],
  options: { unique: true },
})
export class TransactionEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'varchar', length: 100 })
  providerId!: string;

  @Property({ type: 'varchar', length: 100 })
  externalTransactionId!: string;

  @Property({ type: 'uuid' })
  walletId!: string;

  @Property({ type: 'varchar', length: 50 })
  type!: string;

  @Property({ type: 'numeric', precision: 18, scale: 2 })
  amount!: string;

  @Property({ type: 'varchar', length: 50 })
  status!: string;

  @Property({ type: 'timestamp', default: 'NOW()' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamp', default: 'NOW()' })
  updatedAt: Date = new Date();
}
