import { Controller, HttpCode, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown, Post } from '@nestjs/common';
import { addDays, dec, latePenalty, m, outstandingTotal, todayIn, ZERO } from '@anzelu/finance';
import { and, eq, isNull } from 'drizzle-orm';
import { AuthUser, CurrentUser, RequirePermissions, tenantOf } from '../common/auth';
import { AuditService } from '../core/audit.service';
import { NotificationsService } from '../core/notifications.service';
import { DB, InjectDb } from '../db/database';
import { customers, loans, loanScheduleItems, tenants } from '../db/schema';
import { scheduleRowsByLoan, toServicingItem } from '../loans/servicing';

export interface EndOfDayResult {
  tenantId: string;
  date: string;
  penaltiesApplied: number;
  penaltyTotal: string;
  remindersSent: number;
  overdueNoticesSent: number;
}

/**
 * End-of-day processing per institution: one-off late penalties once the grace
 * period has passed, due-date reminders and overdue notices. Every step is
 * idempotent (penalty_applied_at, notification dedupe keys), so re-running a
 * day is safe. Runs in-process hourly; move to a queue worker as volume grows.
 */
@Injectable()
export class JobsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('EndOfDay');
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectDb() private readonly db: DB,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  onApplicationBootstrap() {
    if (process.env.DISABLE_SCHEDULER === 'true') return;
    const tick = () => void this.runAll().catch((e) => this.logger.error(e instanceof Error ? e.stack : e));
    this.timer = setInterval(tick, 60 * 60 * 1000);
    setTimeout(tick, 5_000).unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  async runAll() {
    const active = await this.db.select().from(tenants).where(eq(tenants.status, 'active'));
    for (const t of active) {
      const r = await this.run(t.id, todayIn(t.timezone), null);
      if (r.penaltiesApplied || r.remindersSent || r.overdueNoticesSent) this.logger.log(`${t.code}: ${JSON.stringify(r)}`);
    }
  }

  async run(tenantId: string, date: string, userId: string | null): Promise<EndOfDayResult> {
    const result: EndOfDayResult = { tenantId, date, penaltiesApplied: 0, penaltyTotal: '0.00', remindersSent: 0, overdueNoticesSent: 0 };
    let penaltyTotal = ZERO;
    const book = await this.db
      .select({ loan: loans, phone: customers.phone, firstName: customers.firstName })
      .from(loans)
      .innerJoin(customers, eq(loans.customerId, customers.id))
      .where(and(eq(loans.tenantId, tenantId), eq(loans.status, 'active')));
    const schedules = await scheduleRowsByLoan(this.db, tenantId, book.map((b) => b.loan.id));
    const reminderDate = addDays(date, 3);

    for (const { loan, phone, firstName } of book) {
      for (const item of schedules.get(loan.id) ?? []) {
        const outstanding = outstandingTotal(toServicingItem(item));
        if (outstanding.lte(0)) continue;

        if (item.dueDate === reminderDate) {
          const sent = await this.notifications.send(this.db, {
            tenantId,
            channel: 'sms',
            recipient: phone,
            template: 'due_reminder',
            message: `Dear ${firstName}, your instalment of K${m(outstanding)} for loan ${loan.loanNumber} is due on ${item.dueDate}.`,
            relatedType: 'loan',
            relatedId: loan.id,
            dedupeKey: `reminder:${item.id}`,
          });
          if (sent) result.remindersSent++;
        }

        const graceEnds = addDays(item.dueDate, loan.graceDays);
        if (graceEnds < date && !item.penaltyAppliedAt && Number(loan.penaltyPct) > 0) {
          const penalty = latePenalty(outstanding, loan.penaltyPct);
          await this.db.transaction(async (tx) => {
            const updated = await tx
              .update(loanScheduleItems)
              .set({ penaltyDue: penalty, penaltyAppliedAt: new Date() })
              .where(and(eq(loanScheduleItems.id, item.id), isNull(loanScheduleItems.penaltyAppliedAt)))
              .returning({ id: loanScheduleItems.id });
            if (!updated.length) return;
            await this.audit.record(tx, {
              tenantId,
              userId,
              action: 'loan.penalty_applied',
              entityType: 'loan',
              entityId: loan.id,
              data: { installmentNo: item.installmentNo, overdue: m(outstanding), penalty, rule: `${loan.penaltyPct}% after ${loan.graceDays} grace days` },
            });
            result.penaltiesApplied++;
            penaltyTotal = penaltyTotal.plus(dec(penalty));
          });
          const sent = await this.notifications.send(this.db, {
            tenantId,
            channel: 'sms',
            recipient: phone,
            template: 'overdue_notice',
            message: `Dear ${firstName}, instalment ${item.installmentNo} on loan ${loan.loanNumber} is overdue. A late fee of K${penalty} has been added. Please pay to avoid further action.`,
            relatedType: 'loan',
            relatedId: loan.id,
            dedupeKey: `overdue:${item.id}`,
          });
          if (sent) result.overdueNoticesSent++;
        }
      }
    }
    result.penaltyTotal = m(penaltyTotal);
    return result;
  }
}

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Post('end-of-day')
  @HttpCode(200)
  @RequirePermissions('jobs:run')
  run(@CurrentUser() user: AuthUser) {
    return this.jobs.run(tenantOf(user), todayIn(user.timezone), user.id);
  }
}
