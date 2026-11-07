import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRials, positive, assertBalanced, asJson, formatMoney, toIsoDate } from '../lib/money.ts';

test('amounts parse exactly in Persian, Arabic and Latin digits', () => {
  assert.equal(toRials('۱٬۲۳۴'.replace('٬', ',')), 1234n);
  assert.equal(toRials('١٢٣٤'), 1234n);
  assert.equal(toRials('9,223,372,036,854,775,807'), 9223372036854775807n);
  assert.equal(toRials('-135'), -135n);
});
test('amounts outside PostgreSQL signed BIGINT are rejected',()=>{assert.throws(()=>toRials('9223372036854775808'));assert.throws(()=>toRials('-9223372036854775809'))});
test('money parser rejects fractional or exponential values', () => {
  for(const value of ['0.1', '1e6', '۵.۵', '', 'NaN', 'abc']) assert.throws(() => toRials(value));
  assert.throws(() => positive('0'));
  assert.throws(() => positive('-1'));
});
test('double entry ledger permits balanced entries only', () => {
  const result = assertBalanced([{debit:250000n,credit:0n},{debit:0n,credit:200000n},{debit:0n,credit:50000n}]);
  assert.deepEqual(result,{debit:250000n,credit:250000n});
  assert.throws(() => assertBalanced([{debit:100n,credit:0n},{debit:0n,credit:99n}]),/برابر نیست/);
});
test('both debit and credit in one line, all-zero lines and negative values are disallowed',()=>{
  for(const wrong of [[{debit:1n,credit:1n},{debit:0n,credit:1n}], [{debit:0n,credit:0n},{debit:1n,credit:1n}], [{debit:-10n,credit:0n},{debit:0n,credit:-10n}]])assert.throws(()=>assertBalanced(wrong));
});
test('audit JSON converts bigint exactly',()=>{
  const result=asJson({total:9007199254740993196n,nested:[{value:15n}]});
  assert.deepEqual(result,{total:'9007199254740993196',nested:[{value:'15'}]});
});
test('localization shows Persian formatted currency',()=>{
  assert.match(formatMoney(1200n),/۱٬۲۰۰/);
  assert.match(formatMoney(1200n,true),/۱۲۰/);
});
test('invalid date rejected',()=>{
  assert.throws(()=>toIsoDate('not-a-date'));
  assert.ok(toIsoDate('2026-11-07') instanceof Date);
});
