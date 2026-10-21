import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
} from '@nestjs/common';

import { FinanceService } from '../../application/services/finance.service';

@Controller('wagering')
export class WagerController {
  constructor(private readonly financeService: FinanceService) {}

  @Post('transactions')
  async handleTransaction(
    @Headers('idempotency-key') idempotencyKey: string,
    @Body()
    dto: {
      providerId: string;
      externalTransactionId: string;
      playerId: string;
      walletId: string;
      roundId: string;
      gameId: string;
      kind: 'BET' | 'WIN' | 'LOSS' | 'REFUND' | 'ROLLBACK';
      money?: {
        amount: string;
        currency: string;
      };
      amount?: string;
      currency?: string;
      originalTransactionId?: string;
    },
  ) {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException('Idempotency-Key header is required.');
    }

    if (!dto.providerId || !dto.externalTransactionId || !dto.walletId) {
      throw new BadRequestException(
        'providerId, externalTransactionId and walletId are required.',
      );
    }

    const amount = dto.money?.amount ?? dto.amount;
    const currency = dto.money?.currency ?? dto.currency;

    if (
      amount === undefined ||
      amount === null ||
      amount.trim() === '' ||
      !currency?.trim()
    ) {
      throw new BadRequestException('Amount and currency are required.');
    }

    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      throw new BadRequestException('Amount must be greater than zero.');
    }

    console.log('WAGER REQUEST:', {
      idempotencyKey,
      providerId: dto.providerId,
      externalTransactionId: dto.externalTransactionId,
      walletId: dto.walletId,
      kind: dto.kind,
      amount,
      currency,
    });

    const transaction = {
      providerId: dto.providerId,
      externalTransactionId: dto.externalTransactionId,
      walletId: dto.walletId,
      amount,
      currency: currency.toUpperCase(),
      idempotencyKey, // <-- Passando a idempotencyKey corretamente
    };

    switch (dto.kind) {
      case 'BET':
        return this.financeService.processBet(transaction);

      case 'WIN':
        return this.financeService.processWin(transaction);

      case 'LOSS':
        throw new BadRequestException('LOSS processing is not implemented.');

      case 'ROLLBACK':
      case 'REFUND':
        if (!dto.originalTransactionId) {
          throw new BadRequestException(
            'originalTransactionId is required for rollback/refund.',
          );
        }

        return this.financeService.processRollback({
          ...transaction,
          originalTransactionId: dto.originalTransactionId,
        });

      default:
        throw new BadRequestException(
          `Unsupported transaction kind: ${dto.kind}`,
        );
    }
  }

  @Get('transactions/:id')
  async getTransactionById(@Param('id') id: string) {
    return {
      message: 'Transaction lookup endpoint ready',
      transactionId: id,
    };
  }
}
