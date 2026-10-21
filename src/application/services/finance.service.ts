import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { WalletEntity } from '../../infrastructure/persistence/entities/wallet.entity';
import { TransactionEntity } from '../../infrastructure/persistence/entities/transaction.entity';
import { LedgerEntity } from '../../infrastructure/persistence/entities/ledger.entity';
import { OutboxMessageEntity } from '../../infrastructure/persistence/entities/outbox-message.entity';
import { Wallet } from '../../domain/models/wallet';
import { Money } from '../../domain/models/money';
import { WagerTransaction } from '../../domain/models/wager-transaction';
import { randomUUID } from 'crypto';

@Injectable()
export class FinanceService {
  constructor(private readonly em: EntityManager) {}

  async processBet(dto: {
    providerId: string;
    externalTransactionId: string;
    walletId: string;
    amount?: string;
    currency?: string;
    money?: { amount: string; currency: string };
  }): Promise<void> {
    const amountStr = dto.amount || dto.money?.amount;
    const currencyStr = dto.currency || dto.money?.currency;

    if (!amountStr || !currencyStr) {
      throw new BadRequestException('Amount and currency are required.');
    }

    try {
      await this.em.transactional(async (trxEm) => {
        const existingTx = await trxEm.findOne(TransactionEntity, {
          providerId: dto.providerId,
          externalTransactionId: dto.externalTransactionId,
        });

        if (existingTx) {
          console.log(
            '⚠️ [processBet] Transação já existe (Idempotência acionada):',
            dto.externalTransactionId,
          );
          return;
        }

        const walletEntity = await trxEm.findOne(
          WalletEntity,
          { id: dto.walletId },
          { lockMode: 4 as any },
        );

        if (!walletEntity) {
          throw new NotFoundException('Wallet not found.');
        }

        if (walletEntity.currency !== currencyStr.toUpperCase()) {
          throw new BadRequestException('Currency mismatch for wallet.');
        }

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
          amount: amountStr,
          currency: currencyStr,
        });

        let ledgerEntry;
        try {
          ledgerEntry = wallet.debit(betAmount, dto.externalTransactionId);
        } catch (err: any) {
          if (err.message?.includes('Insufficient funds')) {
            throw new BadRequestException('Insufficient funds.');
          }
          throw err;
        }

        const transaction = WagerTransaction.create({
          id: ledgerEntry.transactionId,
          providerId: dto.providerId,
          externalTransactionId: dto.externalTransactionId,
          walletId: wallet.id,
          type: 'BET',
          amount: betAmount,
        });

        const now = new Date();
        const newBalance = ledgerEntry.balanceAfter.toString();
        const newVersion = walletEntity.version + 1;

        console.log(
          '✅ [processBet] Executando nativeUpdate para saldo:',
          newBalance,
        );

        await trxEm.nativeUpdate(
          WalletEntity,
          { id: walletEntity.id },
          {
            balance: newBalance,
            version: newVersion,
            updatedAt: now,
          },
        );

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

        const outboxMessage = trxEm.create(OutboxMessageEntity, {
          id: randomUUID(),
          aggregateType: 'Wallet',
          aggregateId: wallet.id,
          eventType: 'WalletDebited',
          payload: {
            transactionId: transaction.id,
            walletId: wallet.id,
            amount: betAmount.toString(),
            currency: currencyStr,
          },
          status: 'PENDING',
          createdAt: now,
        });

        trxEm.persist([txEntity, ledgerDbEntity, outboxMessage]);
        await trxEm.flush();
      });
    } catch (error) {
      console.error('❌ ERRO CRÍTICO NA TRANSAÇÃO [processBet]:', error);
      throw error;
    }
  }

  async processWin(dto: {
    providerId: string;
    externalTransactionId: string;
    walletId: string;
    amount?: string;
    currency?: string;
    money?: { amount: string; currency: string };
  }): Promise<void> {
    const amountStr = dto.amount || dto.money?.amount;
    const currencyStr = dto.currency || dto.money?.currency;

    if (!amountStr || !currencyStr) {
      throw new BadRequestException('Amount and currency are required.');
    }

    await this.em.transactional(async (trxEm) => {
      const existingTx = await trxEm.findOne(TransactionEntity, {
        providerId: dto.providerId,
        externalTransactionId: dto.externalTransactionId,
      });

      if (existingTx) {
        return;
      }

      const walletEntity = await trxEm.findOne(
        WalletEntity,
        { id: dto.walletId },
        { lockMode: 4 as any },
      );

      if (!walletEntity) {
        throw new NotFoundException('Wallet not found.');
      }

      if (walletEntity.currency !== currencyStr.toUpperCase()) {
        throw new BadRequestException('Currency mismatch for wallet.');
      }

      const wallet = Wallet.reconstitute({
        id: walletEntity.id,
        userId: walletEntity.userId,
        balance: Money.from({
          amount: walletEntity.balance,
          currency: walletEntity.currency,
        }),
        version: walletEntity.version,
      });

      const winAmount = Money.from({
        amount: amountStr,
        currency: currencyStr,
      });

      const ledgerEntry = wallet.credit(winAmount, dto.externalTransactionId);

      const transaction = WagerTransaction.create({
        id: ledgerEntry.transactionId,
        providerId: dto.providerId,
        externalTransactionId: dto.externalTransactionId,
        walletId: wallet.id,
        type: 'WIN',
        amount: winAmount,
      });

      const now = new Date();
      const newBalance = ledgerEntry.balanceAfter.toString();
      const newVersion = walletEntity.version + 1;

      await trxEm.nativeUpdate(
        WalletEntity,
        { id: walletEntity.id },
        {
          balance: newBalance,
          version: newVersion,
          updatedAt: now,
        },
      );

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

      const outboxMessage = trxEm.create(OutboxMessageEntity, {
        id: randomUUID(),
        aggregateType: 'Wallet',
        aggregateId: wallet.id,
        eventType: 'WalletCredited',
        payload: {
          transactionId: transaction.id,
          walletId: wallet.id,
          amount: winAmount.toString(),
          currency: currencyStr,
        },
        status: 'PENDING',
        createdAt: now,
      });

      trxEm.persist([txEntity, ledgerDbEntity, outboxMessage]);
      await trxEm.flush();
    });
  }

  async processRollback(dto: {
    providerId: string;
    externalTransactionId: string;
    originalTransactionId: string;
    walletId: string;
    amount?: string;
    currency?: string;
    money?: { amount: string; currency: string };
  }): Promise<void> {
    const amountStr = dto.amount || dto.money?.amount;
    const currencyStr = dto.currency || dto.money?.currency;

    if (!amountStr || !currencyStr) {
      throw new BadRequestException('Amount and currency are required.');
    }

    await this.em.transactional(async (trxEm) => {
      const existingRollbackTx = await trxEm.findOne(TransactionEntity, {
        providerId: dto.providerId,
        externalTransactionId: dto.externalTransactionId,
      });

      if (existingRollbackTx) {
        return;
      }

      const originalTx = await trxEm.findOne(TransactionEntity, {
        providerId: dto.providerId,
        externalTransactionId: dto.originalTransactionId,
      });

      if (!originalTx) {
        throw new NotFoundException(
          'Original transaction not found for rollback.',
        );
      }

      const walletEntity = await trxEm.findOne(
        WalletEntity,
        { id: dto.walletId },
        { lockMode: 4 as any },
      );

      if (!walletEntity) {
        throw new NotFoundException('Wallet not found.');
      }

      if (walletEntity.currency !== currencyStr.toUpperCase()) {
        throw new BadRequestException('Currency mismatch for wallet.');
      }

      const wallet = Wallet.reconstitute({
        id: walletEntity.id,
        userId: walletEntity.userId,
        balance: Money.from({
          amount: walletEntity.balance,
          currency: walletEntity.currency,
        }),
        version: walletEntity.version,
      });

      const rollbackAmount = Money.from({
        amount: amountStr,
        currency: currencyStr,
      });

      const isCreditRollback = originalTx.type === 'WIN';
      const ledgerEntry = wallet.rollback(
        rollbackAmount,
        dto.externalTransactionId,
        isCreditRollback,
      );

      const transaction = WagerTransaction.create({
        id: ledgerEntry.transactionId,
        providerId: dto.providerId,
        externalTransactionId: dto.externalTransactionId,
        walletId: wallet.id,
        type: 'ROLLBACK',
        amount: rollbackAmount,
      });

      const now = new Date();
      const newBalance = ledgerEntry.balanceAfter.toString();
      const newVersion = walletEntity.version + 1;

      await trxEm.nativeUpdate(
        WalletEntity,
        { id: walletEntity.id },
        {
          balance: newBalance,
          version: newVersion,
          updatedAt: now,
        },
      );

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

      const outboxMessage = trxEm.create(OutboxMessageEntity, {
        id: randomUUID(),
        aggregateType: 'Wallet',
        aggregateId: wallet.id,
        eventType: 'WalletRolledBack',
        payload: {
          transactionId: transaction.id,
          walletId: wallet.id,
          amount: rollbackAmount.toString(),
          currency: currencyStr,
        },
        status: 'PENDING',
        createdAt: now,
      });

      trxEm.persist([txEntity, ledgerDbEntity, outboxMessage]);
      await trxEm.flush();
    });
  }

  async getBalance(walletId: string) {
    const em = this.em.fork();
    const walletEntity = await em.findOne(WalletEntity, { id: walletId }, {
      refresh: true,
    } as any);

    if (!walletEntity) {
      throw new NotFoundException('Wallet not found.');
    }

    return {
      walletId: walletEntity.id,
      balance: walletEntity.balance,
      currency: walletEntity.currency,
      version: walletEntity.version,
    };
  }

  async getLedger(walletId: string) {
    const em = this.em.fork();
    const walletEntity = await em.findOne(WalletEntity, { id: walletId });

    if (!walletEntity) {
      throw new NotFoundException('Wallet not found.');
    }

    const entries = await em.find(
      LedgerEntity,
      { walletId },
      { orderBy: { createdAt: 'DESC' } },
    );

    return entries;
  }

  async reconcileWallet(walletId: string, storedBalanceAmount: string) {
    const em = this.em.fork();
    const walletEntity = await em.findOne(WalletEntity, { id: walletId });

    if (!walletEntity) {
      throw new NotFoundException('Wallet not found.');
    }

    const entries = await em.find(LedgerEntity, { walletId });

    let calculated = Money.zero(walletEntity.currency);
    for (const entry of entries) {
      const entryMoney = Money.from({
        amount: entry.amount,
        currency: walletEntity.currency,
      });
      if (entry.type === 'BET' || entry.type === 'DEBIT') {
        calculated = calculated.subtract(entryMoney);
      } else if (
        entry.type === 'WIN' ||
        entry.type === 'CREDIT' ||
        entry.type === 'ROLLBACK'
      ) {
        calculated = calculated.add(entryMoney);
      }
    }

    const stored = Money.from({
      amount: storedBalanceAmount,
      currency: walletEntity.currency,
    });
    const currentMaterialized = Money.from({
      amount: walletEntity.balance,
      currency: walletEntity.currency,
    });

    const consistent =
      currentMaterialized.equals(calculated) &&
      currentMaterialized.equals(stored);

    return {
      walletId,
      storedBalance: {
        amount: stored.toString(),
        currency: walletEntity.currency,
      },
      calculatedBalance: {
        amount: calculated.toString(),
        currency: walletEntity.currency,
      },
      materializedBalance: {
        amount: currentMaterialized.toString(),
        currency: walletEntity.currency,
      },
      consistent,
      checkedEntries: entries.length,
    };
  }

  async createWallet(dto: {
    playerId: string;
    initialBalance: { amount: string; currency: string };
  }) {
    return await this.em.transactional(async (trxEm) => {
      const existing = await trxEm.findOne(WalletEntity, {
        userId: dto.playerId,
        currency: dto.initialBalance.currency.toUpperCase(),
      });

      if (existing) {
        throw new BadRequestException(
          'Wallet already exists for this player and currency.',
        );
      }

      const walletId = randomUUID();
      const initialMoney = Money.from(dto.initialBalance);

      const walletEntity = trxEm.create(WalletEntity, {
        id: walletId,
        userId: dto.playerId,
        currency: dto.initialBalance.currency.toUpperCase(),
        balance: initialMoney.toString(),
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const now = new Date();

      if (!initialMoney.isZero()) {
        const txId = randomUUID();
        const txEntity = trxEm.create(TransactionEntity, {
          id: txId,
          providerId: 'internal',
          externalTransactionId: `opening-${walletId}`,
          walletId: walletId,
          type: 'OPENING',
          amount: initialMoney.toString(),
          status: 'PROCESSED',
          createdAt: now,
          updatedAt: now,
        });

        const ledgerEntity = trxEm.create(LedgerEntity, {
          id: randomUUID(),
          walletId: walletId,
          transactionId: txId,
          type: 'OPENING',
          amount: initialMoney.toString(),
          balanceBefore: '0.00',
          balanceAfter: initialMoney.toString(),
          createdAt: now,
        });

        const outboxMessage = trxEm.create(OutboxMessageEntity, {
          id: randomUUID(),
          aggregateType: 'Wallet',
          aggregateId: walletId,
          eventType: 'WalletCreated',
          payload: {
            walletId: walletId,
            playerId: dto.playerId,
            initialBalance: initialMoney.toString(),
            currency: dto.initialBalance.currency.toUpperCase(),
          },
          status: 'PENDING',
          createdAt: now,
        });

        trxEm.persist([walletEntity, txEntity, ledgerEntity, outboxMessage]);
      } else {
        const outboxMessage = trxEm.create(OutboxMessageEntity, {
          id: randomUUID(),
          aggregateType: 'Wallet',
          aggregateId: walletId,
          eventType: 'WalletCreated',
          payload: {
            walletId: walletId,
            playerId: dto.playerId,
            initialBalance: '0.00',
            currency: dto.initialBalance.currency.toUpperCase(),
          },
          status: 'PENDING',
          createdAt: now,
        });

        trxEm.persist([walletEntity, outboxMessage]);
      }

      await trxEm.flush();

      return {
        id: walletEntity.id,
        playerId: walletEntity.userId,
        balance: {
          amount: walletEntity.balance,
          currency: walletEntity.currency,
        },
        version: walletEntity.version,
      };
    });
  }
}
