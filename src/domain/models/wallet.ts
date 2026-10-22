import { randomUUID } from 'crypto';
import { Money } from './money';

export interface LedgerEntryProps {
  id: string;
  walletId: string;
  transactionId: string;
  type: string;
  amount: Money;
  balanceBefore: Money;
  balanceAfter: Money;
}

export class Wallet {
  private constructor(
    public readonly id: string,
    public readonly userId: string,
    private _balance: Money,
    public readonly version: number,
  ) {}

  get balance(): Money {
    return this._balance;
  }

  static reconstitute(props: {
    id: string;
    userId: string;
    balance: Money;
    version: number;
  }): Wallet {
    return new Wallet(props.id, props.userId, props.balance, props.version);
  }

  debit(amount: Money, externalTransactionId: string): LedgerEntryProps {
    if (amount.isZero() || amount.isNegative()) {
      throw new Error('Debit amount must be greater than zero.');
    }

    if (this._balance.isLessThan(amount)) {
      throw new Error('Insufficient funds.');
    }

    const balanceBefore = this._balance;
    this._balance = this._balance.subtract(amount);
    const balanceAfter = this._balance;

    const transactionId = randomUUID();
    const ledgerId = randomUUID();

    return {
      id: ledgerId,
      walletId: this.id,
      transactionId,
      type: 'BET',
      amount,
      balanceBefore,
      balanceAfter,
    };
  }
  credit(amount: Money, externalTransactionId: string): LedgerEntryProps {
    if (amount.isZero() || amount.isNegative()) {
      throw new Error('Credit amount must be greater than zero.');
    }

    const balanceBefore = this._balance;
    this._balance = this._balance.add(amount);
    const balanceAfter = this._balance;

    const transactionId = randomUUID();
    const ledgerId = randomUUID();

    return {
      id: ledgerId,
      walletId: this.id,
      transactionId,
      type: 'WIN',
      amount,
      balanceBefore,
      balanceAfter,
    };
  }
  rollback(
    amount: Money,
    externalTransactionId: string,
    isCreditRollback: boolean,
  ): LedgerEntryProps {
    if (amount.isZero() || amount.isNegative()) {
      throw new Error('Rollback amount must be greater than zero.');
    }

    const balanceBefore = this._balance;

    if (isCreditRollback) {
      if (this._balance.isLessThan(amount)) {
        throw new Error('Insufficient funds to rollback credit.');
      }
      this._balance = this._balance.subtract(amount);
    } else {
      this._balance = this._balance.add(amount);
    }

    const balanceAfter = this._balance;
    const transactionId = randomUUID();
    const ledgerId = randomUUID();

    return {
      id: ledgerId,
      walletId: this.id,
      transactionId,
      type: 'ROLLBACK',
      amount,
      balanceBefore,
      balanceAfter,
    };
  }
  loss(amount: Money): LedgerEntryProps | null {
    return null;
  }
}
