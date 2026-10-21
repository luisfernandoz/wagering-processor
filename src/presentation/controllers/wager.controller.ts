import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { FinanceService } from '../../application/services/finance.service';

interface ProcessBetDto {
  providerId: string;
  externalTransactionId: string;
  walletId: string;
  amount: string;
  currency: string;
}

@Controller('wagers')
export class WagerController {
  constructor(private readonly financeService: FinanceService) {}

  @Post('bet')
  @HttpCode(HttpStatus.OK)
  async processBet(@Body() dto: ProcessBetDto) {
    await this.financeService.processBet(dto);
    return {
      success: true,
      message: 'Bet processed successfully.',
    };
  }
}
