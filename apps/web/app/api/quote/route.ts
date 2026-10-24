import { quoteSchema } from "@anzelu/contracts";
import { generateSchedule, todayIn } from "@anzelu/finance";

/**
 * Public, read-only repayment quote. Runs the shared finance engine on the
 * server so the calculation is identical to what the lending API books.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = quoteSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: { code: "VALIDATION_FAILED", message: "Check the highlighted fields", details: parsed.error.issues } },
      { status: 422 },
    );
  }
  const q = parsed.data;
  try {
    const schedule = generateSchedule({
      principal: q.amount,
      annualRatePct: q.annualRatePct,
      term: q.term,
      method: q.interestMethod,
      frequency: q.frequency,
      startDate: q.startDate ?? todayIn("Africa/Lusaka"),
      processingFeePct: q.processingFeePct,
    });
    return Response.json({ data: schedule });
  } catch (err) {
    return Response.json(
      { error: { code: "QUOTE_FAILED", message: err instanceof Error ? err.message : "Unable to calculate" } },
      { status: 422 },
    );
  }
}
