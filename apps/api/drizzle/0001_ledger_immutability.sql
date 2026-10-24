-- Posted financial records are immutable. Corrections are made with reversing
-- entries, never by editing or deleting history.
CREATE OR REPLACE FUNCTION anzelu_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Posted records in % are immutable; post a reversal instead', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER journal_entries_immutable BEFORE UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION anzelu_block_mutation();
--> statement-breakpoint
CREATE TRIGGER journal_lines_immutable BEFORE UPDATE OR DELETE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION anzelu_block_mutation();
--> statement-breakpoint
CREATE TRIGGER payment_allocations_immutable BEFORE UPDATE OR DELETE ON payment_allocations
  FOR EACH ROW EXECUTE FUNCTION anzelu_block_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_logs_immutable BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION anzelu_block_mutation();
--> statement-breakpoint
-- Payments may only change status (posted -> reversed); amounts and references are fixed.
CREATE OR REPLACE FUNCTION anzelu_guard_payment() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Payments cannot be deleted; reverse them instead';
  END IF;
  IF NEW.amount <> OLD.amount OR NEW.loan_id <> OLD.loan_id OR NEW.receipt_number <> OLD.receipt_number
     OR NEW.unallocated <> OLD.unallocated OR NEW.received_on <> OLD.received_on OR NEW.channel <> OLD.channel THEN
    RAISE EXCEPTION 'Posted payment details are immutable';
  END IF;
  IF OLD.status = 'reversed' AND NEW.status <> 'reversed' THEN
    RAISE EXCEPTION 'A reversed payment cannot be reinstated';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER payments_guard BEFORE UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION anzelu_guard_payment();
--> statement-breakpoint
-- Every journal entry must balance. Deferred so lines can be inserted one by one inside the transaction.
CREATE OR REPLACE FUNCTION anzelu_check_entry_balanced() RETURNS trigger AS $$
DECLARE
  d numeric; c numeric;
BEGIN
  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0) INTO d, c FROM journal_lines WHERE entry_id = NEW.entry_id;
  IF d <> c THEN
    RAISE EXCEPTION 'Journal entry % is unbalanced (debits %, credits %)', NEW.entry_id, d, c;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER journal_lines_balanced AFTER INSERT ON journal_lines
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anzelu_check_entry_balanced();
