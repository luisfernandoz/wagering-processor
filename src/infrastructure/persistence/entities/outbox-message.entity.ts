import {
  Entity,
  PrimaryKey,
  Property,
  Check,
} from '@mikro-orm/decorators/legacy';

@Entity({ tableName: 'outbox_messages' })
export class OutboxMessageEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'string' })
  aggregateType!: string; // Ex: 'Wallet'

  @Property({ type: 'uuid' })
  aggregateId!: string; // Ex: walletId

  @Property({ type: 'string' })
  eventType!: string; // Ex: 'WalletDebited' ou 'WalletCredited'

  @Property({ type: 'json' })
  payload!: any; // Dados do evento

  @Property({ type: 'string', default: 'PENDING' })
  status: 'PENDING' | 'PROCESSED' | 'FAILED' = 'PENDING';

  @Property({ type: 'date', default: 'NOW()' })
  createdAt: Date = new Date();

  @Property({ type: 'date', nullable: true })
  processedAt?: Date;
}
