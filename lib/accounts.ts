import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
export const SEED_ACCOUNTS = [
 ['1100','موجودی نقد و بانک','ASSET'],['1101','صندوق','ASSET'],['1102','بانک','ASSET'],['1200','حساب‌های دریافتنی','ASSET'],['1300','مالیات بر ارزش افزوده دریافتنی','ASSET'],
 ['2100','حساب‌های پرداختنی','LIABILITY'],['2200','مالیات بر ارزش افزوده پرداختنی','LIABILITY'],
 ['3100','سرمایه','EQUITY'],['3200','سود و زیان انباشته','EQUITY'],
 ['4100','فروش و درآمد خدمات','REVENUE'],['5100','خرید و هزینه خدمات','EXPENSE'],['5200','هزینه‌های عمومی','EXPENSE']
] as const;
export async function provisionOrganization(userId: string, name: string) {
  if (!name || name.length > 100) throw new Error('نام سازمان نامعتبر است');
  return prisma.$transaction(async tx => {
    const slug = `org-${crypto.randomUUID().slice(0, 12)}`;
    const org = await tx.organization.create({ data: { name, slug, ownerId: userId } });
    await tx.membership.create({ data: { userId, orgId: org.id, role: 'OWNER' } });
    await tx.branch.create({ data: { orgId: org.id, name: 'دفتر مرکزی' } });
    await tx.account.createMany({ data: SEED_ACCOUNTS.map(([code, name, type]) => ({ orgId: org.id, code, name, type })) });
    const now = new Date(), year = now.getUTCFullYear();
    await tx.fiscalPeriod.create({ data: { orgId: org.id, name: `دوره مالی ${year}`, startsAt: new Date(Date.UTC(year, 0, 1)), endsAt: new Date(Date.UTC(year, 11, 31)) } });
    await tx.auditLog.create({ data: { orgId: org.id, actorId: userId, action: 'CREATE', entity: 'Organization', entityId: org.id, after: { name } } });
    return org;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
