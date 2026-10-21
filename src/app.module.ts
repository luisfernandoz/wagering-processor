import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import mikroOrmConfig from './mikro-orm.config';
import { WalletEntity } from './infrastructure/persistence/entities/wallet.entity';
import { TransactionEntity } from './infrastructure/persistence/entities/transaction.entity';
import { LedgerEntity } from './infrastructure/persistence/entities/ledger.entity';
import { FinanceService } from './application/services/finance.service';
import { WagerController } from './presentation/controllers/wager.controller';
import { WalletController } from './presentation/controllers/wallet.controller';

@Module({
  imports: [
    MikroOrmModule.forRoot(mikroOrmConfig),
    MikroOrmModule.forFeature([WalletEntity, TransactionEntity, LedgerEntity]),
  ],
  controllers: [WagerController, WalletController],
  providers: [FinanceService],
})
export class AppModule {}
