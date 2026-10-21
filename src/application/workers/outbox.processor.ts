import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EntityManager } from '@mikro-orm/postgresql';
import { OutboxMessageEntity } from '../../infrastructure/persistence/entities/outbox-message.entity';

@Injectable()
export class OutboxProcessor {
  private readonly logger = new Logger(OutboxProcessor.name);

  constructor(private readonly em: EntityManager) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async handleOutboxMessages() {
    const em = this.em.fork();

    try {
      const messages = await em.find(
        OutboxMessageEntity,
        { status: 'PENDING' },
        { limit: 50, orderBy: { createdAt: 'ASC' } },
      );

      if (messages.length === 0) {
        return;
      }

      for (const message of messages) {
        try {
          this.logger.log(
            `[OUTBOX EVENT DISPATCHED] Type: ${message.eventType} | Aggregate ID: ${message.aggregateId} | Payload: ${JSON.stringify(message.payload)}`,
          );

          message.status = 'PROCESSED';
          message.processedAt = new Date();
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `Failed to process outbox message ${message.id}: ${errorMessage}`,
          );
          message.status = 'FAILED';
        }
      }

      await em.flush();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error processing outbox batch: ${errorMessage}`);
    }
  }
}
