-- Apply after `prisma db push` using `prisma db execute --file prisma/guards.sql`.
-- Defense in depth: even if a future API accidentally permits a mutation, posted ledger records are immutable.
CREATE OR REPLACE FUNCTION public.hesabino_guard_journal() RETURNS trigger AS $$
DECLARE debit_sum numeric; credit_sum numeric; period_count integer;
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.status <> 'DRAFT' THEN RAISE EXCEPTION 'Cannot delete a posted journal'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' AND OLD.status IN ('POSTED','REVERSED') THEN
    IF NOT (OLD.status='POSTED' AND NEW.status='REVERSED'
       AND (to_jsonb(NEW)-'status')=(to_jsonb(OLD)-'status'))
    THEN RAISE EXCEPTION 'Posted journals are immutable'; END IF;
  END IF;
  IF NEW.status='POSTED' AND (TG_OP='INSERT' OR OLD.status='DRAFT') THEN
    IF TG_OP='INSERT' THEN RAISE EXCEPTION 'Create a journal draft before posting'; END IF;
    SELECT coalesce(sum(debit),0),coalesce(sum(credit),0) INTO debit_sum, credit_sum
      FROM "JournalLine" WHERE "journalId"=NEW.id;
    IF debit_sum<=0 OR debit_sum<>credit_sum OR
       (SELECT count(*) FROM "JournalLine" WHERE "journalId"=NEW.id)<2
    THEN RAISE EXCEPTION 'Unbalanced or empty journal'; END IF;
    SELECT count(*) INTO period_count FROM "FiscalPeriod"
     WHERE id=NEW."periodId" AND "orgId"=NEW."orgId" AND status='OPEN'
       AND "startsAt"<=NEW."bookedAt" AND "endsAt">=NEW."bookedAt";
    IF period_count<>1 THEN RAISE EXCEPTION 'Fiscal period not open'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS hesabino_journal_guard ON "Journal";
CREATE TRIGGER hesabino_journal_guard BEFORE INSERT OR UPDATE OR DELETE ON "Journal"
FOR EACH ROW EXECUTE FUNCTION public.hesabino_guard_journal();

CREATE OR REPLACE FUNCTION public.hesabino_guard_line() RETURNS trigger AS $$
DECLARE j_org text; j_status text; a_org text; c_org text; p_org text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT "orgId",status::text INTO j_org,j_status FROM "Journal" WHERE id=OLD."journalId";
    IF j_status<>'DRAFT' THEN RAISE EXCEPTION 'Posted journal lines cannot be changed'; END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT "orgId",status::text INTO j_org,j_status FROM "Journal" WHERE id=NEW."journalId";
    IF j_status<>'DRAFT' THEN RAISE EXCEPTION 'Only draft journals accept lines'; END IF;
    SELECT "orgId" INTO a_org FROM "Account" WHERE id=NEW."accountId";
    IF a_org IS NULL OR a_org<>j_org THEN RAISE EXCEPTION 'Cross-company account is prohibited'; END IF;
    IF NEW.debit<0 OR NEW.credit<0 OR (NEW.debit>0 AND NEW.credit>0) OR (NEW.debit=0 AND NEW.credit=0)
    THEN RAISE EXCEPTION 'Invalid debit/credit combination'; END IF;
    IF NEW."centerId" IS NOT NULL THEN
      SELECT "orgId" INTO c_org FROM "CostCenter" WHERE id=NEW."centerId";
      IF c_org IS NULL OR c_org<>j_org THEN RAISE EXCEPTION 'Cross-company cost center'; END IF;
    END IF;
    IF NEW."projectId" IS NOT NULL THEN
      SELECT "orgId" INTO p_org FROM "FinancialProject" WHERE id=NEW."projectId";
      IF p_org IS NULL OR p_org<>j_org THEN RAISE EXCEPTION 'Cross-company project'; END IF;
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS hesabino_line_guard ON "JournalLine";
CREATE TRIGGER hesabino_line_guard BEFORE INSERT OR UPDATE OR DELETE ON "JournalLine"
FOR EACH ROW EXECUTE FUNCTION public.hesabino_guard_line();

CREATE OR REPLACE FUNCTION public.hesabino_guard_invoice() RETURNS trigger AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.status <> 'DRAFT' THEN RAISE EXCEPTION 'Issued invoice cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' AND OLD.status <> 'DRAFT' THEN
    IF OLD.status NOT IN ('ISSUED','PARTIAL') OR NEW.status NOT IN ('PARTIAL','PAID') OR
       (to_jsonb(NEW)-'paid'-'status')<>(to_jsonb(OLD)-'paid'-'status') OR
       NEW.paid <= OLD.paid OR NEW.paid > OLD.total
    THEN RAISE EXCEPTION 'Issued invoice immutable except valid allocations'; END IF;
  END IF;
  IF NEW.paid < 0 OR NEW.paid>NEW.total THEN RAISE EXCEPTION 'Invalid invoice balance'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS hesabino_invoice_guard ON "Invoice";
CREATE TRIGGER hesabino_invoice_guard BEFORE UPDATE OR DELETE ON "Invoice"
FOR EACH ROW EXECUTE FUNCTION public.hesabino_guard_invoice();

CREATE OR REPLACE FUNCTION public.hesabino_guard_movement() RETURNS trigger AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.status='POSTED' THEN RAISE EXCEPTION 'Posted treasury transaction cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' AND OLD.status='POSTED' THEN RAISE EXCEPTION 'Posted treasury transaction is immutable'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS hesabino_movement_guard ON "TreasuryMovement";
CREATE TRIGGER hesabino_movement_guard BEFORE UPDATE OR DELETE ON "TreasuryMovement"
FOR EACH ROW EXECUTE FUNCTION public.hesabino_guard_movement();

CREATE OR REPLACE FUNCTION public.hesabino_audit_append_only() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'Audit logs are append-only'; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS hesabino_audit_guard ON "AuditLog";
CREATE TRIGGER hesabino_audit_guard BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION public.hesabino_audit_append_only();

-- Issued invoice line items are immutable. The invoice itself allows only settlement allocation updates.
CREATE OR REPLACE FUNCTION public.hesabino_guard_invoice_line() RETURNS trigger AS $$
DECLARE invoice_status text;
BEGIN
  IF TG_OP='DELETE' THEN
    SELECT status::text INTO invoice_status FROM "Invoice" WHERE id=OLD."invoiceId";
  ELSE
    SELECT status::text INTO invoice_status FROM "Invoice" WHERE id=NEW."invoiceId";
  END IF;
  IF TG_OP='DELETE' AND invoice_status IS NULL THEN RETURN OLD; END IF;
  IF invoice_status IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'Invoice lines are immutable after issuance'; END IF;
  IF TG_OP='UPDATE' THEN
    SELECT status::text INTO invoice_status FROM "Invoice" WHERE id=OLD."invoiceId";
    IF invoice_status IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'Cannot transfer an issued invoice line'; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS hesabino_invoice_line_guard ON "InvoiceLine";
CREATE TRIGGER hesabino_invoice_line_guard BEFORE INSERT OR UPDATE OR DELETE ON "InvoiceLine"
FOR EACH ROW EXECUTE FUNCTION public.hesabino_guard_invoice_line();
