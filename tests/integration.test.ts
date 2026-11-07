import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { prisma } from '../lib/prisma';
import { provisionOrganization } from '../lib/accounts';
import { addInvoice, addMovement, closePeriod, issueInvoice, postJournal, postMovement, reverseJournal, saveDraftJournal } from '../lib/ledger';
import { financialReport } from '../lib/reports';

// Run only against the disposable PostgreSQL database provided by CI.
test('PostgreSQL integration: balanced entries, immutable postings, reversals, tenancy and settlement', async () => {
  assert.match(process.env.DATABASE_URL || '', /hesabino_test/, 'integration tests require a disposable hesabino_test database');
  const user = await prisma.user.create({ data: { email: `integration-${randomUUID()}@example.invalid`, name: 'آزمون', passwordHash: 'test-only' } });
  const org = await provisionOrganization(user.id, 'شرکت آزمایشی یکپارچه‌سازی');
  const accounts = await prisma.account.findMany({ where: { orgId: org.id } });
  const account = (code: string) => {
    const item = accounts.find(a => a.code === code);
    assert.ok(item, `default account ${code} must be provisioned`);
    return item.id;
  };
  const date = new Date().toISOString().slice(0, 10);

  const draft = await saveDraftJournal({
    orgId: org.id, actorId: user.id, bookedAt: date, memo: 'سرمایه اولیه',
    lines: [{ accountId: account('1102'), debit: '1000000', credit: '0' }, { accountId: account('3100'), debit: '0', credit: '1000000' }]
  });
  assert.equal(draft.status, 'DRAFT');
  const posted = await postJournal(org.id, user.id, draft.id);
  assert.match(posted.number, /^JV-/);
  await assert.rejects(prisma.journal.update({ where: { id: draft.id }, data: { memo: 'برخلاف سند قطعی' } }), /immutable/i);
  await assert.rejects(prisma.journalLine.deleteMany({ where: { journalId: draft.id } }), /cannot be changed/i);

  const reversed = await reverseJournal(org.id, user.id, draft.id);
  const updatedOriginal = await prisma.journal.findUniqueOrThrow({ where: { id: draft.id } });
  const reversal = await prisma.journal.findUniqueOrThrow({ where: { id: reversed.id }, include: { lines: true } });
  assert.equal(updatedOriginal.status, 'REVERSED');
  assert.equal(reversal.status, 'POSTED');
  assert.equal(reversal.reversalOfId, draft.id);
  assert.equal(reversal.lines.reduce((sum, l) => sum + l.debit - l.credit, 0n), 0n);

  const secondOrg = await provisionOrganization(user.id, 'شرکت دوم');
  const foreign = await prisma.account.findFirstOrThrow({ where: { orgId: secondOrg.id } });
  await assert.rejects(saveDraftJournal({
    orgId: org.id, actorId: user.id, bookedAt: date, memo: 'بین شرکتی نامعتبر',
    lines: [{ accountId: foreign.id, debit: '100', credit: '0' }, { accountId: account('3100'), debit: '0', credit: '100' }]
  }), /معتبر نیست/);

  const party = await prisma.party.create({ data: { orgId: org.id, name: 'مشتری آزمایشی', kind: 'CUSTOMER' } });
  const draftInvoice = await addInvoice({
    orgId: org.id, actorId: user.id, kind: 'SALE', partyId: party.id, issuedAt: date,
    lines: [{ description: 'خدمات آزمایشی', quantity: 1, unitPrice: '1000000', tax: '0', discount: '0' }]
  });
  const issued = await issueInvoice(org.id, user.id, draftInvoice.id);
  assert.match(issued.number, /^SI-/);
  const treasury = await prisma.treasuryAccount.create({ data: { orgId: org.id, name: 'بانک آزمایشی', kind: 'BANK', accountId: account('1102') } });
  const receipt = await addMovement({
    orgId: org.id, actorId: user.id, kind: 'RECEIPT', amount: '400000', occurredAt: date,
    destinationId: treasury.id, invoiceId: draftInvoice.id, partyId: party.id
  });
  await postMovement(org.id, user.id, receipt.id);
  const partlyPaid = await prisma.invoice.findUniqueOrThrow({ where: { id: draftInvoice.id } });
  assert.equal(partlyPaid.status, 'PARTIAL');
  assert.equal(partlyPaid.paid, 400000n);
  const remainder = await addMovement({
    orgId: org.id, actorId: user.id, kind: 'RECEIPT', amount: '600000', occurredAt: date,
    destinationId: treasury.id, invoiceId: draftInvoice.id, partyId: party.id
  });
  await postMovement(org.id, user.id, remainder.id);
  const fullyPaid = await prisma.invoice.findUniqueOrThrow({ where: { id: draftInvoice.id } });
  assert.equal(fullyPaid.status, 'PAID');
  assert.equal(fullyPaid.paid, fullyPaid.total);
  await assert.rejects(prisma.invoiceLine.updateMany({ where: { invoiceId: draftInvoice.id }, data: { description: 'ویرایش غیرمجاز' } }), /immutable/i);

  const report = await financialReport(org.id, 'trial') as { totalDebit: bigint; totalCredit: bigint };
  assert.equal(report.totalDebit, report.totalCredit, 'debits equal credits across all posted journals');
  assert.ok(report.totalDebit > 0n);
  const period = await prisma.fiscalPeriod.findFirstOrThrow({ where: { orgId: org.id } });
  await closePeriod(org.id, user.id, period.id);
  await assert.rejects(saveDraftJournal({
    orgId: org.id, actorId: user.id, bookedAt: date, memo: 'دوره بسته',
    lines: [{ accountId: account('1102'), debit: '100', credit: '0' }, { accountId: account('3100'), debit: '0', credit: '100' }]
  }), /دوره مالی باز/);
  await prisma.$disconnect();
});