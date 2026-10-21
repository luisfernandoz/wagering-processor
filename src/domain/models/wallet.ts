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

    const transactionId = randomUUID(); // Garante UUID válido para a transação
    const ledgerId = randomUUID(); // Garante UUID válido para o ledger

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
}
