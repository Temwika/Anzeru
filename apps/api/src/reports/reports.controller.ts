import { Controller, Get, Query, Res } from "@nestjs/common";
import { AGEING_BUCKETS, AgeingBucket } from "@anzelu/contracts";
import type { Response } from "express";
import { AuthUser, CurrentUser, RequirePermissions } from "../common/auth";
import { ReportsService } from "./reports.service";

export const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  // Neutralise spreadsheet formula injection and quote every cell.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("reports/dashboard")
  @RequirePermissions("loans:read")
  dashboard(@CurrentUser() user: AuthUser) {
    return this.reports.dashboard(user);
  }

  /** Counts for the signed-in user's inbox (sidebar badges, notification bell, home page). */
  @Get("reports/tasks")
  tasks(@CurrentUser() user: AuthUser) {
    return this.reports.tasks(user);
  }

  @Get("reports/portfolio")
  @RequirePermissions("reports:read")
  async portfolio(@CurrentUser() user: AuthUser) {
    return (await this.reports.portfolio(user)).map((l) => ({ ...l, ...l.position, position: undefined }));
  }

  @Get("reports/portfolio.csv")
  @RequirePermissions("reports:read")
  async portfolioCsv(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const book = await this.reports.portfolio(user);
    const header = [
      "Loan",
      "Customer",
      "Branch",
      "Officer",
      "Product",
      "Disbursed",
      "Principal",
      "Principal outstanding",
      "Total outstanding",
      "Overdue",
      "Days past due",
      "Bucket",
    ];
    const lines = book.map((l) =>
      [
        l.loanNumber,
        l.customerName,
        l.branchName,
        l.officerName,
        l.productName,
        l.disbursedOn,
        l.principal,
        l.position.principalOutstanding,
        l.position.totalOutstanding,
        l.position.overdueAmount,
        l.position.daysPastDue,
        l.position.bucket,
      ]
        .map(csvCell)
        .join(","),
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="portfolio-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send([header.map(csvCell).join(","), ...lines].join("\r\n"));
  }

  @Get("collections/overdue")
  @RequirePermissions("collections:read")
  overdue(@CurrentUser() user: AuthUser, @Query("bucket") bucket?: string) {
    return this.reports.overdue(user, AGEING_BUCKETS.includes(bucket as AgeingBucket) ? (bucket as AgeingBucket) : undefined);
  }
}
