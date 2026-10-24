import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ApplicationsController } from "./applications/applications.controller";
import { ApplicationsService } from "./applications/applications.service";
import { AuthController } from "./auth/auth.controller";
import { AuthGuard } from "./common/auth";
import { AllExceptionsFilter, EnvelopeInterceptor, RequestIdMiddleware } from "./common/http";
import { CoreModule } from "./core/core.module";
import { CustomersController } from "./customers/customers.controller";
import { CustomersService } from "./customers/customers.service";
import { DatabaseModule } from "./db/database";
import { AccountingController } from "./accounting/accounting.controller";
import { BorrowerController } from "./borrower/borrower.controller";
import { CollectionsService } from "./borrower/collections.service";
import { PublicController } from "./borrower/public.controller";
import { HealthController } from "./health.controller";
import { WebhooksController } from "./integrations/webhooks.controller";
import { JobsController, JobsService } from "./jobs/jobs.service";
import { AuditController, SettingsController, TenantsController } from "./settings/settings.controller";
import { LoansController } from "./loans/loans.controller";
import { LoansService } from "./loans/loans.service";
import { PaymentsController } from "./payments/payments.controller";
import { PaymentsService } from "./payments/payments.service";
import { ReportsController } from "./reports/reports.controller";
import { ReportsService } from "./reports/reports.service";
import { LoanGroupsController } from "./customers/groups.controller";
import { OperationsReportsController } from "./reports/operations.controller";
import { CompanyController } from "./settings/company.controller";

export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET must be set to at least 32 characters in production");
  return "anzelu-development-only-secret-do-not-use-in-production";
}

@Module({
  imports: [DatabaseModule, CoreModule, JwtModule.register({ global: true, secret: jwtSecret() }), ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }])],
  controllers: [
    OperationsReportsController,
    LoanGroupsController,
    CompanyController,
    HealthController,
    AuthController,
    CustomersController,
    ApplicationsController,
    LoansController,
    PaymentsController,
    ReportsController,
    SettingsController,
    TenantsController,
    AuditController,
    AccountingController,
    JobsController,
    WebhooksController,
    BorrowerController,
    PublicController,
  ],
  providers: [
    CustomersService,
    ApplicationsService,
    LoansService,
    PaymentsService,
    ReportsService,
    JobsService,
    CollectionsService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes("{*path}");
  }
}
