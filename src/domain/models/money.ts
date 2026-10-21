import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface MoneyProps {
  amount: string; // decimal string, ex.: "25.00"
  currency: string; // ISO-4217
}

export class Money {
  private constructor(
    private readonly value: Decimal,
    public readonly currency: string,
  ) {}

  static from(props: MoneyProps): Money {
    if (
      !props ||
      typeof props.amount !== 'string' ||
      typeof props.currency !== 'string'
    ) {
      throw new Error('Invalid money props format.');
    }

    const currency = props.currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new Error(`Invalid ISO-4217 currency: ${props.currency}`);
    }

    const rawAmount = props.amount.trim();
    if (
      rawAmount === '' ||
      !/^-?\d+(\.\d+)?$/.test(rawAmount) ||
      rawAmount.includes('e') ||
      rawAmount.includes('E')
    ) {
      throw new Error(`Invalid decimal amount format: "${props.amount}"`);
    }

    const decimalValue = new Decimal(rawAmount);
    if (!decimalValue.isFinite()) {
      throw new Error('Amount must be a finite number.');
    }

    const fixedValue = new Decimal(decimalValue.toFixed(2));
    return new Money(fixedValue, currency);
  }

  static zero(currency: string): Money {
    return Money.from({ amount: '0.00', currency });
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.value.plus(other.value), this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.value.minus(other.value), this.currency);
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  isPositive(): boolean {
    return this.value.isPositive() && !this.value.isZero();
  }

  isNegative(): boolean {
    return this.value.isNegative();
  }

  isLessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.value.lessThan(other.value);
  }

  equals(other: Money): boolean {
    if (!other) return false;
    return this.currency === other.currency && this.value.equals(other.value);
  }

  toString(): string {
    return this.value.toFixed(2);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(
        `Currency mismatch: ${this.currency} vs ${other.currency}`,
      );
    }
  }
}
