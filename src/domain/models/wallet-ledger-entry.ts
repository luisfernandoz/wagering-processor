import { Money } from './money.js';

export type LedgerEntryType =
  'BET_DEBIT' | 'WIN_CREDIT' | 'REFUND' | 'ROLLBACK';

export interface LedgerEntryProps {
  id: string;
  walletId: string;
  transactionId: string;
  type: LedgerEntryType;
  amount: Money;
  balanceBefore: Money;
  balanceAfter: Money;
  createdAt: Date;
}

export class WalletLedgerEntry {
  private constructor(public readonly props: LedgerEntryProps) {}

  static create(props: Omit<LedgerEntryProps, 'createdAt'>): WalletLedgerEntry {
    return new WalletLedgerEntry({
      ...props,
      createdAt: new Date(),
    });
  }

  get id(): string {
    return this.props.id;
  }
  get walletId(): string {
    return this.props.walletId;
  }
  get transactionId(): string {
    return this.props.transactionId;
  }
  get type(): LedgerEntryType {
    return this.props.type;
  }
  get amount(): Money {
    return this.props.amount;
  }
  get balanceBefore(): Money {
    return this.props.balanceBefore;
  }
  get balanceAfter(): Money {
    return this.props.balanceAfter;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
}
