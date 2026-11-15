import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { makeFunctionReference } from 'convex/server';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');
const read = makeFunctionReference<'query', Record<string, never>, number>('starterDemo:read');
const increment = makeFunctionReference<'mutation', Record<string, never>, number>('starterDemo:increment');

test('increments a bounded singleton without exposing other tables', async () => {
  const t = convexTest(schema, modules);
  expect(await t.query(read, {})).toBe(0);
  expect(await t.mutation(increment, {})).toBe(1);
  expect(await t.mutation(increment, {})).toBe(2);
  expect(await t.query(read, {})).toBe(2);
  await t.run(async (ctx) => {
    const rows = await ctx.db.query('starterDemo').take(2);
    expect(rows).toHaveLength(1);
    await ctx.db.patch('starterDemo', rows[0]._id, { value: 999999 });
  });
  expect(await t.mutation(increment, {})).toBe(0);
});
