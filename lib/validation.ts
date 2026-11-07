import { ZodError } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : 'خطای ناشناخته';
  const status = message.includes('دسترسی') || message.includes('مجوز') ? 403 : message.includes('ورود') ? 401 : message.includes('یافت نشد') ? 404 : error instanceof ZodError ? 400 : 400;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'این مقدار قبلاً ثبت شده است' }, { status: 409 });
    if (error.code === 'P2034') return NextResponse.json({ error: 'تداخل همزمان؛ عملیات را تکرار کنید' }, { status: 409 });
  }
  return NextResponse.json({ error: error instanceof ZodError ? error.issues.map(x=>x.message).join('، ') : message }, { status });
}
export async function json(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== req.headers.get('host')) throw new Error('درخواست از مبدأ غیرمجاز');
  const body = await req.json();
  if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error('داده ارسالی نامعتبر است');
  return body;
}
export const ok = (value: unknown, status = 200) => NextResponse.json(value, { status });
