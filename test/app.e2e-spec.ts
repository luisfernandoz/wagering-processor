import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { randomUUID } from 'crypto';

describe('Wagering Processor E2E Tests', () => {
  let app: INestApplication;
  let walletId: string;
  let playerId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    playerId = randomUUID();
  });

  it('/wallets (POST) - should create a wallet with initial balance', async () => {
    const response = await request(app.getHttpServer())
      .post('/wallets')
      .send({
        playerId,
        initialBalance: {
          amount: '100.00',
          currency: 'USD',
        },
      });

    console.log('WALLET CRIADA NO TESTE:', response.body);

    expect([200, 201]).toContain(response.status);
    expect(response.body).toHaveProperty('id');
    walletId = response.body.id;
  });

  it('/wagering/transactions (POST) - should process a BET successfully', async () => {
    expect(walletId).toBeDefined();

    const response = await request(app.getHttpServer())
      .post('/wagering/transactions')
      .set('idempotency-key', 'provider-test:bet-unique-01')
      .send({
        providerId: 'provider-test',
        externalTransactionId: 'bet-unique-01',
        playerId,
        walletId,
        roundId: 'round-01',
        gameId: 'slot-game',
        kind: 'BET',
        money: {
          amount: '30.00',
          currency: 'USD',
        },
      });

    expect([200, 201]).toContain(response.status);

    const walletRes = await request(app.getHttpServer())
      .get(`/wallets/${walletId}`)
      .expect(200);

    console.log('WALLET CONSULTADA APOS BET:', walletRes.body);

    expect(walletRes.body.balance).toEqual('70.00');
  });

  it('/wagering/transactions (POST) - should be idempotent on duplicate BET', async () => {
    // Executa a mesma transação duplicada para garantir idempotência mantendo o saldo em 70.00
    const response = await request(app.getHttpServer())
      .post('/wagering/transactions')
      .set('idempotency-key', 'provider-test:bet-unique-01')
      .send({
        providerId: 'provider-test',
        externalTransactionId: 'bet-unique-01',
        playerId,
        walletId,
        roundId: 'round-01',
        gameId: 'slot-game',
        kind: 'BET',
        money: {
          amount: '30.00',
          currency: 'USD',
        },
      });

    expect([200, 201]).toContain(response.status);

    const walletRes = await request(app.getHttpServer())
      .get(`/wallets/${walletId}`)
      .expect(200);

    expect(walletRes.body.balance).toEqual('70.00');
  });

  it('/wagering/transactions (POST) - should fail on insufficient balance', async () => {
    const response = await request(app.getHttpServer())
      .post('/wagering/transactions')
      .set('idempotency-key', 'provider-test:bet-excessive')
      .send({
        providerId: 'provider-test',
        externalTransactionId: 'bet-excessive',
        playerId,
        walletId,
        roundId: 'round-02',
        gameId: 'slot-game',
        kind: 'BET',
        money: {
          amount: '500.00',
          currency: 'USD',
        },
      });

    expect(response.status).toEqual(400);
  });

  it('/wagering/transactions (POST) - should process a WIN successfully', async () => {
    const response = await request(app.getHttpServer())
      .post('/wagering/transactions')
      .set('idempotency-key', 'provider-test:win-unique-01')
      .send({
        providerId: 'provider-test',
        externalTransactionId: 'win-unique-01',
        playerId,
        walletId,
        roundId: 'round-01',
        gameId: 'slot-game',
        kind: 'WIN',
        money: {
          amount: '150.00',
          currency: 'USD',
        },
      });

    expect([200, 201]).toContain(response.status);

    const walletRes = await request(app.getHttpServer())
      .get(`/wallets/${walletId}`)
      .expect(200);

    console.log('WALLET CONSULTADA APOS WIN:', walletRes.body);

    expect(walletRes.body.balance).toEqual('220.00');
  });
});
