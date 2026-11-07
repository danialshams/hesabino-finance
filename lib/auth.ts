import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { Role } from '@prisma/client';

const COOKIE = 'hesabino_session';
export function hashPassword(password: string) {
  if (password.length < 10 || password.length > 200) throw new Error('رمز عبور باید حداقل ۱۰ حرف باشد');
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password: string, digest: string) {
  const [salt, hash] = digest.split(':');
  if (!salt || !hash || hash.length !== 128) return false;
  const guess = scryptSync(password, salt, 64);
  return timingSafeEqual(guess, Buffer.from(hash, 'hex'));
}
export async function startSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  await prisma.session.create({ data: { userId, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 14 * 24 * 3600_000) } });
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 14 * 24 * 3600 });
}
export async function endSession() {
  const store = await cookies(); const token = store.get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: createHash('sha256').update(token).digest('hex') } });
  store.delete(COOKIE);
}
export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { tokenHash: createHash('sha256').update(token).digest('hex') }, include: { user: { select: { id: true, email: true, name: true } } } });
  return session && session.expiresAt > new Date() ? session.user : null;
}
export async function requireUser() {
  const user = await currentUser(); if (!user) throw new Error('برای ادامه باید ورود کنید'); return user;
}
export async function requireMember(orgId: string, roles?: Role[]) {
  const user = await requireUser();
  const membership = await prisma.membership.findUnique({ where: { userId_orgId: { userId: user.id, orgId } } });
  if (!membership || (roles && !roles.includes(membership.role))) throw new Error('مجوز دسترسی به این سازمان یا عملیات وجود ندارد');
  return { user, membership };
}
export const WRITE_ROLES: Role[] = ['OWNER','ADMIN','ACCOUNTANT','FINANCE_MANAGER'];
export const ADMIN_ROLES: Role[] = ['OWNER','ADMIN'];
