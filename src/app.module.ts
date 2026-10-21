import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule'; // <--- Importante para o cron funcionar
import { MikroOrmModule } from '@mikro-orm/nestjs';
import mikroOrmConfig from './mikro-orm.config';
import { WalletEntity } from './infrastructure/persistence/entities/wallet.entity';
import { TransactionEntity } from './infrastructure/persistence/entities/transaction.entity';
import { LedgerEntity } from './infrastructure/persistence/entities/ledger.entity';
import { OutboxMessageEntity } from './infrastructure/persistence/entities/outbox-message.entity'; // <--- Adicionado
import { FinanceService } from './application/services/finance.service';
import { WagerController } from './presentation/controllers/wager.controller';
import { WalletController } from './presentation/controllers/wallet.controller';
import { OutboxProcessor } from './application/workers/outbox.processor';

@Module({
  imports: [
    ScheduleModule.forRoot(), // <--- Ativa o motor de agendamento de cron jobs
    MikroOrmModule.forRoot(mikroOrmConfig),
    MikroOrmModule.forFeature([
      WalletEntity,
      TransactionEntity,
      LedgerEntity,
      OutboxMessageEntity, // <--- Registrado aqui
    ]),
  ],
  controllers: [WagerController, WalletController],
  providers: [FinanceService, OutboxProcessor],
})
export class AppModule {}
