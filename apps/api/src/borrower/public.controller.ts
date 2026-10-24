import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { Public } from '../common/auth';
import { DB, InjectDb } from '../db/database';
import { loanProducts, tenants } from '../db/schema';

/**
 * Read-only marketing data for an institution's public website. The product
 * catalogue is served from the same settings that price real loans, so the
 * figures advertised can never drift from what is booked.
 */
@Controller('public')
export class PublicController {
  constructor(@InjectDb() private readonly db: DB) {}

  @Public()
  @Get('institutions/:code')
  async institution(@Param('code') code: string) {
    const [tenant] = await this.db
      .select({ id: tenants.id, name: tenants.name, currency: tenants.currency, status: tenants.status })
      .from(tenants)
      .where(eq(tenants.code, code.toUpperCase()));
    if (!tenant || tenant.status !== 'active') throw new NotFoundException('Institution not found');
    const products = await this.db
      .select({
        name: loanProducts.name,
        code: loanProducts.code,
        description: loanProducts.description,
        interestMethod: loanProducts.interestMethod,
        annualRatePct: loanProducts.annualRatePct,
        repaymentFrequency: loanProducts.repaymentFrequency,
        minAmount: loanProducts.minAmount,
        maxAmount: loanProducts.maxAmount,
        minTerm: loanProducts.minTerm,
        maxTerm: loanProducts.maxTerm,
        processingFeePct: loanProducts.processingFeePct,
        requiresGuarantor: loanProducts.requiresGuarantor,
      })
      .from(loanProducts)
      .where(and(eq(loanProducts.tenantId, tenant.id), eq(loanProducts.isActive, true)))
      .orderBy(asc(loanProducts.minAmount));
    return { name: tenant.name, currency: tenant.currency, products };
  }
}
