import { Money } from './money';

export interface WagerTransactionProps {
  id: string;
  providerId: string;
  externalTransactionId: string;
  walletId: string;
  type: string;
  amount: Money;
  status?: string;
}

export class WagerTransaction {
  private constructor(
    public readonly id: string,
    public readonly providerId: string,
    public readonly externalTransactionId: string,
    public readonly walletId: string,
    public readonly type: string,
    public readonly amount: Money,
    public readonly status: string,
  ) {}

  static create(props: WagerTransactionProps): WagerTransaction {
    if (!props.id) {
      throw new Error('Transaction ID is required.');
    }
    return new WagerTransaction(
      props.id,
      props.providerId,
      props.externalTransactionId,
      props.walletId,
      props.type,
      props.amount,
      props.status || 'SUCCESS',
    );
  }
}
