-- Portable initial schema; review with Prisma Migrate before real finance usage.
DO $$ BEGIN CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'ACCOUNTANT', 'FINANCE_MANAGER', 'VIEWER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "JournalStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PeriodStatus" AS ENUM ('OPEN', 'LOCKED', 'CLOSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PartyKind" AS ENUM ('CUSTOMER', 'SUPPLIER', 'BOTH'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "InvoiceKind" AS ENUM ('SALE', 'PURCHASE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIAL', 'PAID', 'VOID'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "TreasuryKind" AS ENUM ('BANK', 'CASH'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MovementType" AS ENUM ('RECEIPT', 'PAYMENT', 'TRANSFER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MovementStatus" AS ENUM ('DRAFT', 'POSTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PAID', 'CANCELED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "StatementStatus" AS ENUM ('UNMATCHED', 'MATCHED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User" ("email");
CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Session_tokenHash_key" ON "Session" ("tokenHash");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session" ("userId");
CREATE TABLE IF NOT EXISTS "Organization" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'IRR',
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Tehran',
  "isDemo" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_slug_key" ON "Organization" ("slug");
CREATE TABLE IF NOT EXISTS "Membership" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'VIEWER'
);
CREATE UNIQUE INDEX IF NOT EXISTS "Membership_userId_orgId_key" ON "Membership" ("userId", "orgId");
CREATE INDEX IF NOT EXISTS "Membership_orgId_role_idx" ON "Membership" ("orgId", "role");
CREATE TABLE IF NOT EXISTS "Branch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "Branch_orgId_name_key" ON "Branch" ("orgId", "name");
CREATE TABLE IF NOT EXISTS "Account" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "AccountType" NOT NULL,
  "parentId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Account_orgId_code_key" ON "Account" ("orgId", "code");
CREATE INDEX IF NOT EXISTS "Account_orgId_type_idx" ON "Account" ("orgId", "type");
CREATE TABLE IF NOT EXISTS "FiscalPeriod" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startsAt" DATE NOT NULL,
  "endsAt" DATE NOT NULL,
  "status" "PeriodStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "FiscalPeriod_orgId_startsAt_endsAt_idx" ON "FiscalPeriod" ("orgId", "startsAt", "endsAt");
CREATE TABLE IF NOT EXISTS "Journal" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "number" TEXT,
  "memo" TEXT NOT NULL,
  "bookedAt" DATE NOT NULL,
  "status" "JournalStatus" NOT NULL DEFAULT 'DRAFT',
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "sourceId" TEXT,
  "periodId" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "postedAt" TIMESTAMP(3),
  "reversalOfId" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "Journal_reversalOfId_key" ON "Journal" ("reversalOfId");
CREATE UNIQUE INDEX IF NOT EXISTS "Journal_orgId_number_key" ON "Journal" ("orgId", "number");
CREATE INDEX IF NOT EXISTS "Journal_orgId_bookedAt_idx" ON "Journal" ("orgId", "bookedAt");
CREATE INDEX IF NOT EXISTS "Journal_orgId_source_sourceId_idx" ON "Journal" ("orgId", "source", "sourceId");
CREATE TABLE IF NOT EXISTS "JournalLine" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "journalId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "debit" BIGINT NOT NULL DEFAULT 0,
  "credit" BIGINT NOT NULL DEFAULT 0,
  "description" TEXT,
  "centerId" TEXT,
  "projectId" TEXT
);
CREATE INDEX IF NOT EXISTS "JournalLine_accountId_idx" ON "JournalLine" ("accountId");
CREATE TABLE IF NOT EXISTS "Party" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "kind" "PartyKind" NOT NULL DEFAULT 'BOTH',
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "taxId" TEXT,
  "address" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Party_orgId_name_idx" ON "Party" ("orgId", "name");
CREATE TABLE IF NOT EXISTS "Invoice" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "number" TEXT,
  "partyId" TEXT NOT NULL,
  "kind" "InvoiceKind" NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "issuedAt" DATE NOT NULL,
  "dueAt" DATE,
  "memo" TEXT,
  "subtotal" BIGINT NOT NULL DEFAULT 0,
  "discount" BIGINT NOT NULL DEFAULT 0,
  "tax" BIGINT NOT NULL DEFAULT 0,
  "total" BIGINT NOT NULL DEFAULT 0,
  "paid" BIGINT NOT NULL DEFAULT 0,
  "journalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_journalId_key" ON "Invoice" ("journalId");
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_orgId_number_key" ON "Invoice" ("orgId", "number");
CREATE INDEX IF NOT EXISTS "Invoice_orgId_issuedAt_status_idx" ON "Invoice" ("orgId", "issuedAt", "status");
CREATE INDEX IF NOT EXISTS "Invoice_orgId_dueAt_idx" ON "Invoice" ("orgId", "dueAt");
CREATE TABLE IF NOT EXISTS "InvoiceLine" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "invoiceId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" BIGINT NOT NULL,
  "discount" BIGINT NOT NULL DEFAULT 0,
  "tax" BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS "TreasuryAccount" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "TreasuryKind" NOT NULL,
  "bankName" TEXT,
  "iban" TEXT,
  "accountId" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX IF NOT EXISTS "TreasuryAccount_orgId_name_key" ON "TreasuryAccount" ("orgId", "name");
CREATE TABLE IF NOT EXISTS "TreasuryMovement" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "kind" "MovementType" NOT NULL,
  "status" "MovementStatus" NOT NULL DEFAULT 'DRAFT',
  "sourceId" TEXT,
  "destinationId" TEXT,
  "partyId" TEXT,
  "invoiceId" TEXT,
  "categoryAccountId" TEXT,
  "amount" BIGINT NOT NULL,
  "occurredAt" DATE NOT NULL,
  "reference" TEXT,
  "memo" TEXT,
  "journalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "TreasuryMovement_journalId_key" ON "TreasuryMovement" ("journalId");
CREATE INDEX IF NOT EXISTS "TreasuryMovement_orgId_occurredAt_idx" ON "TreasuryMovement" ("orgId", "occurredAt");
CREATE TABLE IF NOT EXISTS "BankStatementLine" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "treasuryId" TEXT NOT NULL,
  "occurredAt" DATE NOT NULL,
  "amount" BIGINT NOT NULL,
  "reference" TEXT,
  "status" "StatementStatus" NOT NULL DEFAULT 'UNMATCHED',
  "movementId" TEXT
);
CREATE INDEX IF NOT EXISTS "BankStatementLine_orgId_treasuryId_status_idx" ON "BankStatementLine" ("orgId", "treasuryId", "status");
CREATE TABLE IF NOT EXISTS "Installment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "dueAt" DATE NOT NULL,
  "amount" BIGINT NOT NULL,
  "paid" BIGINT NOT NULL DEFAULT 0,
  "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
  "paidAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "Installment_orgId_dueAt_idx" ON "Installment" ("orgId", "dueAt");
CREATE TABLE IF NOT EXISTS "CostCenter" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "CostCenter_orgId_name_key" ON "CostCenter" ("orgId", "name");
CREATE TABLE IF NOT EXISTS "FinancialProject" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "FinancialProject_orgId_name_key" ON "FinancialProject" ("orgId", "name");
CREATE TABLE IF NOT EXISTS "Budget" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "centerId" TEXT,
  "startsAt" DATE NOT NULL,
  "endsAt" DATE NOT NULL,
  "limit" BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS "Budget_orgId_startsAt_endsAt_idx" ON "Budget" ("orgId", "startsAt", "endsAt");
CREATE TABLE IF NOT EXISTS "RecurringRule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "amount" BIGINT NOT NULL,
  "debitAccountId" TEXT NOT NULL,
  "creditAccountId" TEXT NOT NULL,
  "nextAt" DATE NOT NULL,
  "intervalMonths" INTEGER NOT NULL DEFAULT 1,
  "active" BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS "RecurringRule_orgId_nextAt_idx" ON "RecurringRule" ("orgId", "nextAt");
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "before" JSONB,
  "after" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AuditLog_orgId_occurredAt_idx" ON "AuditLog" ("orgId", "occurredAt");
CREATE TABLE IF NOT EXISTS "DocumentCounter" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "lastNumber" INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentCounter_orgId_prefix_key" ON "DocumentCounter" ("orgId", "prefix");
DO $$ BEGIN ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Membership" ADD CONSTRAINT "Membership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Branch" ADD CONSTRAINT "Branch_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Account" ADD CONSTRAINT "Account_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Account" ADD CONSTRAINT "Account_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "FiscalPeriod" ADD CONSTRAINT "FiscalPeriod_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Journal" ADD CONSTRAINT "Journal_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Journal" ADD CONSTRAINT "Journal_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "FiscalPeriod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Journal" ADD CONSTRAINT "Journal_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "Journal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "CostCenter" ("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "FinancialProject" ("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Party" ADD CONSTRAINT "Party_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "TreasuryAccount" ADD CONSTRAINT "TreasuryAccount_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "TreasuryAccount" ADD CONSTRAINT "TreasuryAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "TreasuryMovement" ADD CONSTRAINT "TreasuryMovement_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "TreasuryMovement" ADD CONSTRAINT "TreasuryMovement_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "TreasuryAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "TreasuryMovement" ADD CONSTRAINT "TreasuryMovement_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "TreasuryAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "TreasuryMovement" ADD CONSTRAINT "TreasuryMovement_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "TreasuryMovement" ADD CONSTRAINT "TreasuryMovement_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "TreasuryMovement" ADD CONSTRAINT "TreasuryMovement_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_treasuryId_fkey" FOREIGN KEY ("treasuryId") REFERENCES "TreasuryAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "TreasuryMovement" ("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Installment" ADD CONSTRAINT "Installment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "FinancialProject" ADD CONSTRAINT "FinancialProject_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Budget" ADD CONSTRAINT "Budget_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Budget" ADD CONSTRAINT "Budget_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Budget" ADD CONSTRAINT "Budget_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "CostCenter" ("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "DocumentCounter" ADD CONSTRAINT "DocumentCounter_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS "_hesabino_schema_info" ("version" TEXT PRIMARY KEY, "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
INSERT INTO "_hesabino_schema_info" ("version") VALUES ('20261107_initial_portable') ON CONFLICT DO NOTHING;

-- Append-only and integrity safeguards; no destructive table operations.
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
CREATE OR REPLACE FUNCTION public.hesabino_audit_append_only() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'Audit logs are append-only'; END;
$$ LANGUAGE plpgsql;
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
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='hesabino_journal_guard') THEN CREATE TRIGGER hesabino_journal_guard BEFORE INSERT OR UPDATE OR DELETE ON "Journal"
FOR EACH ROW EXECUTE FUNCTION public.hesabino_guard_journal(); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='hesabino_line_guard') THEN CREATE TRIGGER hesabino_line_guard BEFORE INSERT OR UPDATE OR DELETE ON "JournalLine"
FOR EACH ROW EXECUTE FUNCTION public.hesabino_guard_line(); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='hesabino_invoice_guard') THEN CREATE TRIGGER hesabino_invoice_guard BEFORE UPDATE OR DELETE ON "Invoice"
FOR EACH ROW EXECUTE FUNCTION public.hesabino_guard_invoice(); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='hesabino_movement_guard') THEN CREATE TRIGGER hesabino_movement_guard BEFORE UPDATE OR DELETE ON "TreasuryMovement"
FOR EACH ROW EXECUTE FUNCTION public.hesabino_guard_movement(); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='hesabino_audit_guard') THEN CREATE TRIGGER hesabino_audit_guard BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION public.hesabino_audit_append_only(); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='hesabino_invoice_line_guard') THEN CREATE TRIGGER hesabino_invoice_line_guard BEFORE INSERT OR UPDATE OR DELETE ON "InvoiceLine"
FOR EACH ROW EXECUTE FUNCTION public.hesabino_guard_invoice_line(); END IF; END $$;
