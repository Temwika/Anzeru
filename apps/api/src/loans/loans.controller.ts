import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Channel, collectionActivitySchema, disbursementDecisionSchema, disbursementRequestSchema } from '@anzelu/contracts';
import { AuthUser, CurrentUser, RequirePermissions } from '../common/auth';
import { ZodPipe } from '../common/http';
import { LoansService } from './loans.service';

@Controller('loans')
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  @Get('disbursements/queue')
  @RequirePermissions('loans:read')
  disbursements(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.loans.listDisbursements(user, status === 'completed' || status === 'rejected' ? status : 'requested');
  }

  @Get()
  @RequirePermissions('loans:read')
  list(@CurrentUser() user: AuthUser, @Query() q: Record<string, string>) {
    return this.loans.list(user, q);
  }

  @Get(':id')
  @RequirePermissions('loans:read')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.loans.get(user, id);
  }

  @Get(':id/schedule')
  @RequirePermissions('loans:read')
  async schedule(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return (await this.loans.get(user, id)).schedule;
  }

  @Post(':id/disbursements')
  @RequirePermissions('disbursements:request')
  requestDisbursement(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(disbursementRequestSchema)) body: { channel: Channel; destination: string; valueDate?: string },
  ) {
    return this.loans.requestDisbursement(user, id, body);
  }

  @Post(':id/disbursements/decision')
  @RequirePermissions('disbursements:authorise')
  decideDisbursement(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(disbursementDecisionSchema)) body: { decision: 'authorise' | 'reject'; note?: string },
  ) {
    return this.loans.decideDisbursement(user, id, body.decision, body.note);
  }

  @Post(':id/activities')
  @RequirePermissions('collections:write')
  addActivity(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(collectionActivitySchema))
    body: { type: 'call' | 'sms' | 'visit' | 'promise_to_pay' | 'note'; note: string; promisedAmount?: string; promisedDate?: string },
  ) {
    return this.loans.addActivity(user, id, body);
  }
}
