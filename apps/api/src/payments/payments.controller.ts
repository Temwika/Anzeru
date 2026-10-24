import { Body, Controller, Get, Headers, Ip, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { PaymentCreateInput, paymentCreateSchema, reversalDecisionSchema, reversalRequestSchema } from '@anzelu/contracts';
import { AuthUser, CurrentUser, RequirePermissions } from '../common/auth';
import { ZodPipe } from '../common/http';
import { PaymentsService } from './payments.service';

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('payments')
  @RequirePermissions('payments:read')
  list(@CurrentUser() user: AuthUser, @Query() q: Record<string, string>) {
    return this.payments.list(user, q);
  }

  /** The Idempotency-Key header, when sent, takes precedence over the body field. */
  @Post('payments')
  @RequirePermissions('payments:record')
  record(
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') headerKey: string | undefined,
    @Body() raw: Record<string, unknown>,
    @Ip() ip: string,
  ) {
    const body = new ZodPipe(paymentCreateSchema).transform({ ...raw, idempotencyKey: headerKey ?? raw?.idempotencyKey }) as PaymentCreateInput;
    return this.payments.record(user, body, { ip });
  }

  @Get('payments/:id')
  @RequirePermissions('payments:read')
  receipt(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.payments.receipt(user, id);
  }

  @Get('loans/:id/payments')
  @RequirePermissions('payments:read')
  forLoan(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query() q: Record<string, string>) {
    return this.payments.list(user, { ...q, loanId: id });
  }

  @Post('payments/:id/reversals')
  @RequirePermissions('payments:reverse:request')
  requestReversal(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(reversalRequestSchema)) body: { reason: string },
  ) {
    return this.payments.requestReversal(user, id, body.reason);
  }

  @Get('reversals')
  @RequirePermissions('payments:read')
  reversals(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.payments.listReversals(user, status);
  }

  @Post('reversals/:id/decision')
  @RequirePermissions('payments:reverse:approve')
  decideReversal(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(reversalDecisionSchema)) body: { decision: 'approve' | 'reject'; note?: string },
  ) {
    return this.payments.decideReversal(user, id, body.decision, body.note);
  }
}
