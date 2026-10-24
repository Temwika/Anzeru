import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { LedgerService } from './ledger.service';
import { NotificationsService } from './notifications.service';
import { NumberingService } from './numbering.service';

@Global()
@Module({
  providers: [AuditService, NumberingService, LedgerService, NotificationsService],
  exports: [AuditService, NumberingService, LedgerService, NotificationsService],
})
export class CoreModule {}
