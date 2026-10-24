import { describe, expect, it } from "vitest";
import { generateSchedule } from "../src";

// Chilimbitso's 28-day marketeers schedule: 5% of the loan each day, 40% interest over the whole loan.
const SHEET = [
  ["500", "25.00", "700.00"],
  ["1000", "50.00", "1400.00"],
  ["2500", "125.00", "3500.00"],
  ["5000", "250.00", "7000.00"],
] as const;

describe("flat_term (a fixed % for the whole loan)", () => {
  it.each(SHEET)("K%s over 28 days → %s a day, %s in total", (principal, daily, total) => {
    const s = generateSchedule({ principal, annualRatePct: "40", term: 28, method: "flat_term", frequency: "daily", startDate: "2026-11-02" });
    expect(s.installments).toHaveLength(28);
    expect(s.installmentAmount).toBe(daily);
    expect(s.installments.every((i) => i.total === daily)).toBe(true);
    expect(s.totals.repayable).toBe(total);
    expect(s.installments[0].dueDate).toBe("2026-11-03");
    expect(s.installments[27].dueDate).toBe("2026-11-30");
  });

  it("charges the same interest however long the loan runs", () => {
    const short = generateSchedule({ principal: "1000", annualRatePct: "40", term: 14, method: "flat_term", frequency: "daily", startDate: "2026-11-02" });
    expect(short.totals.interest).toBe("400.00");
  });
});
