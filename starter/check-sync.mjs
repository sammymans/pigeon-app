import assert from 'node:assert/strict';
import { ConvexClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';

const url = 'https://helpful-kudu-864.convex.cloud';
const read = makeFunctionReference('starterDemo:read');
const increment = makeFunctionReference('starterDemo:increment');
const a = new ConvexClient(url);
const b = new ConvexClient(url);
let stop = () => {};
let timer;
try {
  let notify;
  const updates = [];
  const changed = new Promise((resolve, reject) => {
    notify = resolve;
    timer = setTimeout(() => reject(new Error('Second client did not receive the update')), 15000);
  });
  let initial;
  const ready = new Promise((resolve) => { initial = resolve; });
  stop = b.onUpdate(read, {}, (value) => {
    updates.push(value);
    if (updates.length === 1) initial(value);
    else notify(value);
  });
  const before = await Promise.race([ready, changed]);
  const written = await a.mutation(increment, {});
  const observed = await changed;
  assert.equal(written, (before + 1) % 1000000);
  assert.equal(observed, written);
  console.log(`PASS: independent client B observed ${before} → ${observed} after client A incremented`);
} finally {
  clearTimeout(timer);
  stop();
  await a.close();
  await b.close();
}
