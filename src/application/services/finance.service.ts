import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { WalletEntity } from '../../infrastructure/persistence/entities/wallet.entity';
import { TransactionEntity } from '../../infrastructure/persistence/entities/transaction.entity';
import { LedgerEntity } from '../../infrastructure/persistence/entities/ledger.entity';
import { Wallet } from '../../domain/models/wallet';
import { Money } from '../../domain/models/money';
import { WagerTransaction } from '../../domain/models/wager-transaction';

@Injectable()
export class FinanceService {
  constructor(private readonly em: EntityManager) {}

  async processBet(dto: {
    providerId: string;
    externalTransactionId: string;
    walletId: string;
    amount: string;
    currency: string;
  }): Promise<void> {
    const em = this.em.fork();

    await em.transactional(async (trxEm) => {
      // 1. Verificar idempotência
      const existingTx = await trxEm.findOne(TransactionEntity, {
        providerId: dto.providerId,
        externalTransactionId: dto.externalTransactionId,
      });

      if (existingTx) {
        return; // Idempotente: requisição duplicada processada com sucesso sem duplicar débito
      }

      // 2. Buscar carteira com lock pessimista para concorrência segura
      const walletEntity = await trxEm.findOne(
        WalletEntity,
        { id: dto.walletId },
        { lockMode: 4 as any }, // Pessimistic write lock
      );

      if (!walletEntity) {
        throw new NotFoundException('Wallet not found.');
      }

      if (walletEntity.currency !== dto.currency.toUpperCase()) {
        throw new BadRequestException('Currency mismatch for wallet.');
      }

      // 3. Reconstituir domínio da carteira
      const wallet = Wallet.reconstitute({
        id: walletEntity.id,
        userId: walletEntity.userId,
        balance: Money.from({
          amount: walletEntity.balance,
          currency: walletEntity.currency,
        }),
        version: walletEntity.version,
      });

      const betAmount = Money.from({
        amount: dto.amount,
        currency: dto.currency,
      });

      // 4. Executar regra de domínio (gerando UUIDs seguros internamente)
      const ledgerEntry = wallet.debit(betAmount, dto.externalTransactionId);

      // 5. Criar transação de domínio
      const transaction = WagerTransaction.create({
        id: ledgerEntry.transactionId,
        providerId: dto.providerId,
        externalTransactionId: dto.externalTransactionId,
        walletId: wallet.id,
        type: 'BET',
        amount: betAmount,
      });

      // 6. Atualizar entidade de persistência da carteira
      walletEntity.balance = wallet.balance.toString();
      walletEntity.version = wallet.version;

      // 7. Persistir transação e ledger com datas válidas
      const now = new Date();

      const txEntity = trxEm.create(TransactionEntity, {
        id: transaction.id,
        providerId: transaction.providerId,
        externalTransactionId: transaction.externalTransactionId,
        walletId: transaction.walletId,
        type: transaction.type,
        amount: transaction.amount.toString(),
        status: transaction.status,
        createdAt: now,
        updatedAt: now,
      });

      const ledgerDbEntity = trxEm.create(LedgerEntity, {
        id: ledgerEntry.id,
        walletId: ledgerEntry.walletId,
        transactionId: ledgerEntry.transactionId,
        type: ledgerEntry.type,
        amount: ledgerEntry.amount.toString(),
        balanceBefore: ledgerEntry.balanceBefore.toString(),
        balanceAfter: ledgerEntry.balanceAfter.toString(),
        createdAt: now,
      });

      trxEm.persist([walletEntity, txEntity, ledgerDbEntity]);
    });
  }
}
