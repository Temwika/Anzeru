import { Injectable, Logger } from '@nestjs/common';
import { Executor } from '../db/database';
import { notifications } from '../db/schema';

export interface OutboundMessage {
  tenantId: string;
  channel: 'sms' | 'email';
  recipient: string;
  template: string;
  message: string;
  relatedType?: string;
  relatedId?: string;
  /** Prevents the same reminder going out twice (e.g. one per instalment per day). */
  dedupeKey?: string;
}

/**
 * Records outbound customer messages. The sandbox gateway marks them sent and
 * logs them; a production SMS/email adapter would deliver from a worker queue.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');

  async send(ex: Executor, msg: OutboundMessage): Promise<boolean> {
    const rows = await ex
      .insert(notifications)
      .values({ ...msg, status: 'sent', sentAt: new Date() })
      .onConflictDoNothing()
      .returning({ id: notifications.id });
    if (rows.length) this.logger.debug(`[sandbox ${msg.channel}] to ${msg.recipient}: ${msg.message}`);
    return rows.length > 0;
  }
}
