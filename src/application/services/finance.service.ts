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
import { randomUUID } from 'crypto';

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

  async processWin(dto: {
    providerId: string;
    externalTransactionId: string;
    walletId: string;
    amount: string;
    currency: string;
  }): Promise<void> {
    const em = this.em.fork();

    await em.transactional(async (trxEm) => {
      // 1. Verificar idempotência para evitar créditos duplicados
      const existingTx = await trxEm.findOne(TransactionEntity, {
        providerId: dto.providerId,
        externalTransactionId: dto.externalTransactionId,
      });

      if (existingTx) {
        return; // Idempotente: requisição já processada
      }

      // 2. Buscar carteira com lock pessimista para evitar concorrência no saldo
      const walletEntity = await trxEm.findOne(
        WalletEntity,
        { id: dto.walletId },
        { lockMode: 4 as any },
      );

      if (!walletEntity) {
        throw new NotFoundException('Wallet not found.');
      }

      if (walletEntity.currency !== dto.currency.toUpperCase()) {
        throw new BadRequestException('Currency mismatch for wallet.');
      }

      // 3. Reconstituir domínio
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
        amount: dto.amount,
        currency: dto.currency,
      });

      // 4. Executar regra de domínio (crédito)
      const ledgerEntry = wallet.credit(winAmount, dto.externalTransactionId);

      // 5. Criar transação de domínio
      const transaction = WagerTransaction.create({
        id: ledgerEntry.transactionId,
        providerId: dto.providerId,
        externalTransactionId: dto.externalTransactionId,
        walletId: wallet.id,
        type: 'WIN',
        amount: winAmount,
      });

      // 6. Atualizar carteira
      walletEntity.balance = wallet.balance.toString();
      walletEntity.version = wallet.version;

      // 7. Persistir com datas válidas
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

  async processRollback(dto: {
    providerId: string;
    externalTransactionId: string;
    originalTransactionId: string;
    walletId: string;
    amount: string;
    currency: string;
  }): Promise<void> {
    const em = this.em.fork();

    await em.transactional(async (trxEm) => {
      // 1. Verificar idempotência para o estorno
      const existingRollbackTx = await trxEm.findOne(TransactionEntity, {
        providerId: dto.providerId,
        externalTransactionId: dto.externalTransactionId,
      });

      if (existingRollbackTx) {
        return; // Já estornado anteriormente
      }

      // 2. Buscar transação original para saber se foi BET ou WIN
      const originalTx = await trxEm.findOne(TransactionEntity, {
        providerId: dto.providerId,
        externalTransactionId: dto.originalTransactionId,
      });

      if (!originalTx) {
        throw new NotFoundException(
          'Original transaction not found for rollback.',
        );
      }

      // 3. Buscar carteira com lock pessimista
      const walletEntity = await trxEm.findOne(
        WalletEntity,
        { id: dto.walletId },
        { lockMode: 4 as any },
      );

      if (!walletEntity) {
        throw new NotFoundException('Wallet not found.');
      }

      if (walletEntity.currency !== dto.currency.toUpperCase()) {
        throw new BadRequestException('Currency mismatch for wallet.');
      }

      // 4. Reconstituir domínio
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
        amount: dto.amount,
        currency: dto.currency,
      });

      const isCreditRollback = originalTx.type === 'WIN';

      // 5. Executar regra de estorno no domínio
      const ledgerEntry = wallet.rollback(
        rollbackAmount,
        dto.externalTransactionId,
        isCreditRollback,
      );

      // 6. Criar transação de domínio para o estorno
      const transaction = WagerTransaction.create({
        id: ledgerEntry.transactionId,
        providerId: dto.providerId,
        externalTransactionId: dto.externalTransactionId,
        walletId: wallet.id,
        type: 'ROLLBACK',
        amount: rollbackAmount,
      });

      // 7. Atualizar carteira
      walletEntity.balance = wallet.balance.toString();
      walletEntity.version = wallet.version;

      // 8. Persistir dados
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

  async getBalance(walletId: string) {
    const em = this.em.fork();
    const walletEntity = await em.findOne(WalletEntity, { id: walletId });

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
    const em = this.em.fork();

    return await em.transactional(async (trxEm) => {
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
        version: 1, // <--- Adicione esta linha obrigatória exigida pelo TypeScript
        createdAt: new Date(),
        updatedAt: new Date(),
      });

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
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const ledgerEntity = trxEm.create(LedgerEntity, {
          id: randomUUID(),
          walletId: walletId,
          transactionId: txId,
          type: 'OPENING',
          amount: initialMoney.toString(),
          balanceBefore: '0.00',
          balanceAfter: initialMoney.toString(),
          createdAt: new Date(),
        });

        trxEm.persist([walletEntity, txEntity, ledgerEntity]);
      } else {
        trxEm.persist(walletEntity);
      }

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
