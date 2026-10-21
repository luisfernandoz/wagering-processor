import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { FinanceService } from '../../application/services/finance.service';

@Controller('wallets')
export class WalletController {
  constructor(private readonly financeService: FinanceService) {}

  @Post()
  async createWallet(
    @Body()
    dto: {
      playerId: string;
      initialBalance: { amount: string; currency: string };
    },
  ) {
    return await this.financeService.createWallet(dto);
  }

  @Get(':walletId')
  async getWallet(@Param('walletId') walletId: string) {
    return await this.financeService.getBalance(walletId);
  }
}
