import { Body, Controller, Get, Ip, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApplicationCreateInput, applicationCreateSchema, decisionSchema } from '@anzelu/contracts';
import { AuthUser, CurrentUser, RequirePermissions } from '../common/auth';
import { ZodPipe } from '../common/http';
import { ApplicationsService } from './applications.service';

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get()
  @RequirePermissions('applications:read')
  list(@CurrentUser() user: AuthUser, @Query() q: Record<string, string>) {
    return this.applications.list(user, q);
  }

  @Post()
  @RequirePermissions('applications:write')
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(applicationCreateSchema)) body: ApplicationCreateInput, @Ip() ip: string) {
    return this.applications.create(user, body, ip);
  }

  @Get(':id')
  @RequirePermissions('applications:read')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.applications.get(user, id);
  }

  @Post(':id/decisions')
  @RequirePermissions('applications:decide')
  decide(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(decisionSchema)) body: { decision: 'approve' | 'reject'; reason: string },
    @Ip() ip: string,
  ) {
    return this.applications.decide(user, id, body.decision, body.reason, ip);
  }
}
