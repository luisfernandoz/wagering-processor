import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import mikroOrmConfig from './mikro-orm.config';
import { WalletEntity } from './infrastructure/persistence/entities/wallet.entity';
import { TransactionEntity } from './infrastructure/persistence/entities/transaction.entity';
import { LedgerEntity } from './infrastructure/persistence/entities/ledger.entity';
import { OutboxMessageEntity } from './infrastructure/persistence/entities/outbox-message.entity';
import { FinanceService } from './application/services/finance.service';
import { WagerController } from './presentation/controllers/wager.controller';
import { WalletController } from './presentation/controllers/wallet.controller';
import { OutboxProcessor } from './application/workers/outbox.processor';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MikroOrmModule.forRoot(mikroOrmConfig),
    MikroOrmModule.forFeature([
      WalletEntity,
      TransactionEntity,
      LedgerEntity,
      OutboxMessageEntity,
    ]),
  ],
  controllers: [WagerController, WalletController],
  providers: [FinanceService, OutboxProcessor],
})
export class AppModule {}
