import { expect, test } from '@playwright/test';
import { QUESTIONS } from '@blaxaura/shared';

test.describe('accessibility and responsiveness', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('320px viewport keeps every control reachable and on screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /your style\. your aura\./i })).toBeVisible();

    const start = page.getByRole('button', { name: /start the style check/i });
    await start.scrollIntoViewIfNeeded();
    const box = await start.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(320);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    await start.click();
    await page.getByRole('textbox', { name: /first name or nickname/i }).fill('Nia');
    await page.getByRole('button', { name: /^continue$/i }).click();
    await expect(page.getByRole('heading', { name: QUESTIONS[0]!.prompt, exact: false })).toBeVisible();
    const optionOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(optionOverflow).toBeLessThanOrEqual(1);
  });

  test('reduced motion preference removes reveal animation but keeps the report', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.getByRole('button', { name: /start the style check/i }).click();
    await page.getByRole('textbox', { name: /first name or nickname/i }).fill('Tola');
    await page.getByRole('button', { name: /^continue$/i }).click();
    for (let index = 0; index < QUESTIONS.length; index += 1) {
      await page.getByRole('radio').first().click();
      await page.waitForTimeout(120);
    }
    await expect(page.getByRole('heading', { name: /what is working/i })).toBeVisible({ timeout: 20000 });
    const animation = await page.evaluate(() => {
      const element = document.querySelector('[data-card]');
      if (!element) return 0;
      return Number.parseFloat(getComputedStyle(element).animationDuration) || 0;
    });
    expect(animation).toBeLessThan(0.01);
  });

  test('keyboard-only completion of the quiz', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await page.getByRole('button', { name: /start the style check/i }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('textbox', { name: /first name or nickname/i }).fill('Kemi');
    await page.keyboard.press('Enter');

    for (let index = 0; index < QUESTIONS.length; index += 1) {
      const firstOption = page.getByRole('radio').first();
      await firstOption.focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(420);
    }
    await expect(page.getByRole('heading', { name: /what is working/i })).toBeVisible({ timeout: 20000 });
  });

  test('arrow keys move through the option radio group', async ({ page }) => {
    await page.goto('/quiz');
    await page.getByRole('textbox', { name: /first name or nickname/i }).fill('Sade');
    await page.getByRole('button', { name: /^continue$/i }).click();
    await page.getByRole('radio').first().focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('radio').nth(1)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('radio').first()).toBeFocused();
  });
});

test.describe('unauthenticated access', () => {
  test('the dashboard never renders host data without a session', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /host dashboard/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /overview/i })).toHaveCount(0);
    const response = await page.request.get('/api/admin/stats');
    expect(response.status()).toBe(401);
  });
});
