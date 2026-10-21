import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { FinanceService } from '../../application/services/finance.service';
import { generateCanonicalPayloadHash } from '../../domain/utils/hash.util';

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
      money?: { amount: string; currency: string };
      amount?: string;
      currency?: string;
      originalTransactionId?: string;
    },
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required.');
    }

    // Normaliza para suportar tanto { money: { amount, currency } } quanto { amount, currency } direto
    const amount = dto.money?.amount ?? dto.amount;
    const currency = dto.money?.currency ?? dto.currency;

    if (!amount || !currency) {
      throw new BadRequestException(
        'Amount and currency must be provided either directly or inside the money object.',
      );
    }

    const payloadHash = generateCanonicalPayloadHash(dto);

    switch (dto.kind) {
      case 'BET':
        return await this.financeService.processBet({
          providerId: dto.providerId,
          externalTransactionId: dto.externalTransactionId,
          walletId: dto.walletId,
          amount,
          currency,
        });

      case 'WIN':
        return await this.financeService.processWin({
          providerId: dto.providerId,
          externalTransactionId: dto.externalTransactionId,
          walletId: dto.walletId,
          amount,
          currency,
        });

      case 'LOSS':
        return await this.financeService.processWin({
          providerId: dto.providerId,
          externalTransactionId: dto.externalTransactionId,
          walletId: dto.walletId,
          amount: '0.00',
          currency,
        });

      case 'ROLLBACK':
      case 'REFUND':
        return await this.financeService.processRollback({
          providerId: dto.providerId,
          externalTransactionId: dto.externalTransactionId,
          originalTransactionId:
            dto.originalTransactionId || dto.externalTransactionId,
          walletId: dto.walletId,
          amount,
          currency,
        });

      default:
        throw new BadRequestException(
          `Unsupported transaction kind: ${dto.kind}`,
        );
    }
  }

  @Get('transactions/:id')
  async getTransactionById(@Param('id') id: string) {
    return { message: 'Transaction lookup endpoint ready', transactionId: id };
  }
}
