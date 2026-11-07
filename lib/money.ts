/** All stored money is integer IRR; never use JavaScript floating-point for ledger arithmetic. */
export const MAX_RIAL = 9223372036854775807n;
export function toRials(input: unknown): bigint {
  if (typeof input !== 'string' && typeof input !== 'number' && typeof input !== 'bigint') throw new Error('مبلغ نامعتبر است');
  const normalized = String(input).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)).replace(/[,\s،]/g, '').trim();
  if (!/^-?\d+$/.test(normalized)) throw new Error('مبلغ باید عدد صحیح ریالی باشد');
  const result = BigInt(normalized);
  if (result > MAX_RIAL || result < -MAX_RIAL - 1n) throw new Error('مبلغ خارج از محدوده ذخیره‌سازی حسابداری است');
  return result;
}
export function positive(input: unknown): bigint {
  const n = toRials(input); if (n <= 0n) throw new Error('مبلغ باید بزرگ‌تر از صفر باشد'); return n;
}
export function assertBalanced(lines: { debit: bigint; credit: bigint }[]) {
  if (lines.length < 2) throw new Error('سند باید حداقل دو ردیف داشته باشد');
  let debit = 0n, credit = 0n;
  for (const l of lines) {
    if (l.debit < 0n || l.credit < 0n || (l.debit > 0n && l.credit > 0n) || (l.debit === 0n && l.credit === 0n)) throw new Error('ردیف بدهکار/بستانکار نامعتبر است');
    debit += l.debit; credit += l.credit;
  }
  if (debit !== credit) throw new Error('جمع بدهکار و بستانکار سند برابر نیست');
  if (debit === 0n) throw new Error('سند بدون مبلغ قابل ثبت نیست');
  return { debit, credit };
}
export function asJson<T>(input: T): T { return JSON.parse(JSON.stringify(input, (_key, value) => typeof value === 'bigint' ? value.toString() : value)); }
export function formatMoney(input: string | number | bigint, toman = false) {
  const value = BigInt(input); const whole = toman ? value / 10n : value;
  const frac = toman && value % 10n !== 0n ? '.۱' : '';
  return new Intl.NumberFormat('fa-IR').format(whole) + frac;
}
export function toIsoDate(value: unknown, field = 'تاریخ'): Date {
  const d = new Date(String(value));
  if (!Number.isFinite(d.valueOf())) throw new Error(`${field} نامعتبر است`);
  return d;
}
