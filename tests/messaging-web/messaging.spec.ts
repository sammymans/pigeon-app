import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';

const consent = (page: Page) => page.getByRole('checkbox', { name: 'I understand this letter can be intercepted and read' });
const fly = (page: Page, bird = 'Mochi') => page.getByRole('button', { name: `Let ${bird} fly`, exact: true });
async function compose(page: Page, query = '') {
  await page.goto(`/${query}`);
  await page.getByRole('button', { name: 'Send a pigeon', exact: true }).click();
  await page.getByRole('button', { name: 'Send with Mochi', exact: true }).click();
}
async function recipient(page: Page, handle = 'avery') {
  await page.getByRole('button', { name: 'Choose a recipient', exact: true }).click();
  await page.getByRole('radio', { name: new RegExp(`Write to @${handle}`) }).click();
}
async function ready(page: Page) {
  await recipient(page);
  await page.getByRole('textbox', { name: 'Your letter' }).fill('Meet me for coffee when this finally lands?');
  await consent(page).click();
}
async function shot(page: Page, name: string) {
  const directory = process.env.MESSAGING_RENDER_DIR ?? 'test-results/messaging-renders';
  await mkdir(directory, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(directory, `${name}.png`) });
}

test('renders and completes flock → postcard → persistent in-flight → My flights', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Send a pigeon', exact: true }).click();
  await expect(page.getByText('3 ready · 5 slots')).toBeVisible();
  await page.getByRole('radio', { name: 'Pip, Ready', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Pip, Ready', exact: true })).toHaveAttribute('aria-checked', 'true');
  await shot(page, '01-flock-fixture');
  await page.getByRole('button', { name: 'Send with Pip', exact: true }).click();
  await ready(page);
  await expect(fly(page, 'Pip')).toBeEnabled();
  await shot(page, '02-compose-fixture');
  await fly(page, 'Pip').click();
  await expect(page.getByRole('heading', { name: 'Pip’s on the way.' })).toBeVisible();
  await expect(page.getByText('To avery · London')).toBeVisible();
  await expect(page.getByText('Your postbox', { exact: true })).toHaveCount(0);
  await shot(page, '03-in-flight-fixture');
  await page.getByRole('button', { name: 'Back to my flights', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'My flights' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'View selected flight' })).toContainText('Pip');
  const calls = await page.evaluate(() => (window as any).messagingFixture.state.calls);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({ pigeonId: 'fixture-bird-1', recipientId: 'fixture-friend', openAcknowledged: true });
});

test('validates empty/oversized text, changes/removes recipients, resets consent, and preserves a closed draft', async ({ page }) => {
  await compose(page);
  await expect(fly(page)).toBeDisabled();
  await recipient(page);
  await consent(page).click();
  await expect(fly(page)).toBeDisabled();
  await page.getByRole('textbox', { name: 'Your letter' }).fill('x'.repeat(281));
  await consent(page).click();
  await expect(fly(page)).toBeDisabled();
  await page.getByRole('textbox', { name: 'Your letter' }).fill('Keep this draft');
  await consent(page).click();
  await page.getByRole('button', { name: 'Remove recipient' }).click();
  await expect(fly(page)).toBeDisabled();
  await expect(consent(page)).not.toBeChecked();
  await recipient(page, 'jules');
  await expect(page.getByText('New York → Paris')).toBeVisible();
  await page.getByRole('button', { name: 'Change recipient' }).click();
  await page.getByRole('button', { name: 'Back to your letter' }).click();
  await page.getByRole('button', { name: 'Back to my flights' }).click();
  await page.getByRole('button', { name: 'Continue your letter' }).click();
  await page.getByRole('button', { name: 'Send with Mochi' }).click();
  await expect(page.getByRole('textbox', { name: 'Your letter' })).toHaveValue('Keep this draft');
  await expect(page.getByText('New York → Paris')).toBeVisible();
  expect(await page.evaluate(() => (window as any).messagingFixture.state.calls.length)).toBe(0);
});

test('blocks a pigeon that becomes unavailable and lets the draft move to a ready bird', async ({ page }) => {
  await compose(page);
  await ready(page);
  await page.evaluate(() => (window as any).messagingFixture.unavailable('fixture-bird-0'));
  await expect(fly(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Choose another pigeon' }).click();
  await expect(page.getByRole('button', { name: 'Send with Mochi' })).toBeDisabled();
  await page.getByRole('radio', { name: 'Pip, Ready' }).click();
  await page.getByRole('button', { name: 'Send with Pip' }).click();
  await expect(page.getByRole('textbox', { name: 'Your letter' })).toHaveValue('Meet me for coffee when this finally lands?');
  await expect(consent(page)).not.toBeChecked();
});

test('prevents double dispatch while the request is in flight', async ({ page }) => {
  await compose(page, '?delay=manual');
  await ready(page);
  await fly(page).dblclick({ force: true });
  await expect(page.getByRole('button', { name: 'Confirming your flight…' })).toBeDisabled();
  await expect(page.getByRole('textbox', { name: 'Your letter' })).not.toBeEditable();
  expect(await page.evaluate(() => (window as any).messagingFixture.state.calls.length)).toBe(1);
  await page.evaluate(() => (window as any).messagingFixture.release());
  await expect(page.getByRole('heading', { name: 'Mochi’s on the way.' })).toBeVisible();
});

test('recovers an ambiguous response across reload using the same immutable request', async ({ page }) => {
  await compose(page, '?failure=ambiguous');
  await ready(page);
  await fly(page).click();
  await expect(page.getByRole('button', { name: 'Retry the same letter' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Your letter' })).not.toBeEditable();
  await page.reload();
  await page.getByRole('button', { name: 'Resolve saved send' }).click();
  await page.getByRole('button', { name: 'Retry the same letter' }).click();
  await expect(page.getByRole('heading', { name: 'Mochi’s on the way.' })).toBeVisible();
  const fixture = await page.evaluate(() => (window as any).messagingFixture.state);
  expect(fixture.calls).toHaveLength(2);
  expect(fixture.calls[0]).toEqual(fixture.calls[1]);
  expect(Object.keys(fixture.requests)).toHaveLength(1);
});

test('makes a definitively rejected first send editable and requires fresh consent', async ({ page }) => {
  await compose(page, '?failure=rejected');
  await ready(page);
  await fly(page).click();
  await expect(page.getByText(/No flight was created. Your text is kept/)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Your letter' })).toBeEditable();
  await expect(consent(page)).not.toBeChecked();
  await consent(page).click();
  await fly(page).click();
  await expect(page.getByRole('heading', { name: 'Mochi’s on the way.' })).toBeVisible();
});

test('sends the anonymity choice without appending a visible signature to the body', async ({ page }) => {
  await compose(page);
  await ready(page);
  await page.getByRole('switch', { name: 'Send anonymously' }).click();
  await expect(page.getByText('— Anonymous', { exact: true })).toBeVisible();
  await expect(consent(page)).not.toBeChecked();
  await consent(page).click();
  await fly(page).click();
  await expect(page.getByRole('heading', { name: 'Mochi’s on the way.' })).toBeVisible();
  const input = await page.evaluate(() => (window as any).messagingFixture.state.calls[0]);
  expect(input.anonymous).toBe(true);
  expect(input.body).toBe('Meet me for coffee when this finally lands?');
});

test('requires an explicit sender city and refuses an unconfigured recipient', async ({ page }) => {
  await compose(page, '?noCity=1');
  await expect(page.getByRole('button', { name: 'Use this departure city' })).toBeDisabled();
  await page.getByRole('radio', { name: 'Depart from New York' }).click();
  await page.getByRole('button', { name: 'Use this departure city' }).click();
  await recipient(page, 'no_city_yet');
  await expect(page.getByText(/hasn’t chosen a city yet/)).toBeVisible();
  await page.getByRole('textbox', { name: 'Your letter' }).fill('Waiting for your city');
  await consent(page).click();
  await expect(fly(page)).toBeDisabled();
});

test('World → postbox shows the real list and detail → back returns to My flights', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'World', exact: true }).click();
  await page.getByRole('button', { name: 'Open your postbox' }).click();
  await expect(page.getByRole('tab', { name: 'Incoming', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Sent', exact: true }).click();
  await page.getByRole('button', { name: /Letter to @avery/ }).first().click();
  await page.getByRole('button', { name: 'Back to my flights' }).click();
  await expect(page.getByRole('tab', { name: 'My flights' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Incoming' })).toHaveCount(0);
});

test('external flight entry wins over initial compose, consumes once and preserves saved drafts', async ({ page }) => {
  await page.goto('/?initialCompose=1');
  await expect(page.getByRole('heading', { name: 'Send a pigeon' })).toBeVisible();
  await expect(page.getByText('With Mochi')).toBeVisible();
  await page.getByRole('textbox', { name: 'Your letter' }).fill('A saved draft');
  await page.evaluate(() => (window as any).messagingFixture.openFlight('fixture-flight-2'));
  await expect(page.getByText('Your letter', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to my flights' }).click();
  await page.evaluate(() => (window as any).messagingFixture.openFlight('fixture-flight-2'));
  await expect(page.getByText('Your letter', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).messagingFixture.handled)).toBe(2);
  await page.getByRole('button', { name: 'Back to my flights' }).click();
  await page.getByRole('button', { name: 'Continue your letter' }).click();
  await page.getByRole('button', { name: 'Send with Mochi' }).click();
  await expect(page.getByRole('textbox', { name: 'Your letter' })).toHaveValue('A saved draft');
});

test('external detail entry preserves uncertain sends and rejects an unavailable flight', async ({ page }) => {
  await compose(page, '?failure=ambiguous');
  await ready(page);
  await fly(page).click();
  await expect(page.getByRole('button', { name: 'Retry the same letter' })).toBeVisible();
  await page.evaluate(() => (window as any).messagingFixture.openFlight('not-authorized'));
  await expect(page.getByText(/No private contents have been loaded/)).toBeVisible();
  await page.getByRole('button', { name: 'Back to my flights' }).click();
  await page.getByRole('button', { name: 'Resolve saved send' }).click();
  await page.getByRole('button', { name: 'Retry the same letter' }).click();
  await expect(page.getByRole('heading', { name: 'Mochi’s on the way.' })).toBeVisible();
});

test('recipient content stays locked and profile-keyed remount drops old navigation and drafts', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'My flights' })).toBeVisible();
  await page.evaluate(() => { const fixture = (window as any).messagingFixture; fixture.state.flights[0].role = 'recipient'; fixture.state.flights[0].body = 'DO NOT RENDER BEFORE DELIVERY'; fixture.refresh(); fixture.openFlight('fixture-flight-2'); });
  await expect(page.getByText('Still on the wing.')).toBeVisible();
  await expect(page.getByText('DO NOT RENDER BEFORE DELIVERY')).toHaveCount(0);
  await page.evaluate(() => (window as any).messagingFixture.switchAccount());
  await expect(page.getByRole('tab', { name: 'My flights' })).toBeVisible();
  await expect(page.getByText('Still on the wing.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Resolve saved send' })).toHaveCount(0);
});

test('small-device content remains scrollable with reachable send and close controls', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await compose(page);
  await ready(page);
  await fly(page).scrollIntoViewIfNeeded();
  await expect(fly(page)).toBeInViewport();
  await shot(page, '04-small-device-fixture');
  await fly(page).click();
  await page.getByRole('button', { name: 'Back to my flights' }).click();
  await expect(page.getByRole('tab', { name: 'My flights' })).toBeVisible();
});

test('recovers a draft-load failure from the reachable flock without overwriting it', async ({ page }) => {
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem;
    let fail = true;
    Storage.prototype.getItem = function (key) {
      if (key.startsWith('pigeon:first-letter:') && fail) { fail = false; throw new Error('Fixture storage read failure'); }
      return get.call(this, key);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Send a pigeon', exact: true }).click();
  await expect(page.getByText(/Your saved draft could not be loaded/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send with Mochi' })).toBeDisabled();
  await page.getByRole('button', { name: 'Retry loading draft' }).click();
  await page.getByRole('button', { name: 'Send with Mochi' }).click();
  await expect(page.getByRole('textbox', { name: 'Your letter' })).toBeEditable();
  expect(await page.evaluate(() => (window as any).messagingFixture.state.calls.length)).toBe(0);
});

test('finishes failed local cleanup without launching the acknowledged letter again', async ({ page }) => {
  await compose(page);
  await ready(page);
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    let fail = true;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('pigeon:first-letter:') && !JSON.parse(value).body && fail) { fail = false; throw new Error('Fixture cleanup failure'); }
      return set.call(this, key, value);
    };
  });
  await fly(page).click();
  await expect(page.getByRole('button', { name: 'Finish local cleanup' })).toBeVisible();
  await page.getByRole('button', { name: 'Finish local cleanup' }).click();
  await expect(page.getByRole('heading', { name: 'Mochi’s on the way.' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).messagingFixture.state.calls.length)).toBe(1);
});

test('defers external flight entry until an active dispatch finishes', async ({ page }) => {
  await compose(page, '?delay=manual');
  await ready(page);
  await fly(page).click();
  await page.evaluate(() => (window as any).messagingFixture.openFlight('fixture-flight-2'));
  await expect(page.getByRole('button', { name: 'Confirming your flight…' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).messagingFixture.handled)).toBe(0);
  await page.evaluate(() => (window as any).messagingFixture.release());
  await expect(page.getByText('Your letter', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).messagingFixture.handled)).toBe(1);
});

test('grows the postcard body instead of hiding longer multiline drafts', async ({ page }) => {
  await compose(page);
  const input = page.getByRole('textbox', { name: 'Your letter' });
  await input.fill('A line of this letter.\n'.repeat(10));
  await expect.poll(async () => (await input.boundingBox())!.height).toBeGreaterThan(200);
  await input.fill('Short');
  await expect.poll(async () => (await input.boundingBox())!.height).toBeLessThan(100);
  await fly(page).scrollIntoViewIfNeeded();
  await expect(fly(page)).toBeInViewport();
});

test('keeps the draft while disconnected and only enables sending after reconnect', async ({ page }) => {
  await compose(page);
  await ready(page);
  await page.evaluate(() => (window as any).messagingFixture.disconnect());
  await expect(fly(page)).toBeDisabled();
  await expect(page.getByText(/Reconnect before sending/)).toBeVisible();
  await page.evaluate(() => (window as any).messagingFixture.reconnect());
  await expect(fly(page)).toBeEnabled();
  await expect(page.getByRole('textbox', { name: 'Your letter' })).toHaveValue('Meet me for coffee when this finally lands?');
});

test('opens only server-authorized caught text without promising return custody', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'My flights' })).toBeVisible();
  await page.evaluate(() => { const fixture = (window as any).messagingFixture; Object.assign(fixture.state.flights[0], { role: 'catcher', state: 'intercepted', visibility: 'open', body: 'AUTHORIZED CAUGHT TEXT' }); fixture.refresh(); fixture.openFlight('fixture-flight-2'); });
  await expect(page.getByText('AUTHORIZED CAUGHT TEXT', { exact: true })).toBeVisible();
  await expect(page.getByText('CAUGHT · OPENED FOR YOU')).toBeVisible();
  await expect(page.getByRole('button', { name: /Caught letters|Open caught letter|send.*home|return/i })).toHaveCount(0);
  await page.evaluate(() => { const fixture = (window as any).messagingFixture; fixture.state.flights[0].role = 'recipient'; fixture.refresh(); });
  await expect(page.getByText('AUTHORIZED CAUGHT TEXT', { exact: true })).toHaveCount(0);
});
