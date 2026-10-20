import { expect, type Page } from '@playwright/test';
import { QUESTIONS } from '@blaxaura/shared';

/** Answer every question with the given option index (default 0). */
export async function completeQuiz(page: Page, name = 'Ada', optionPicker: (questionId: string) => number = () => 0) {
  await page.goto('/');
  await page.getByRole('button', { name: /start the style check/i }).click();
  await page.getByRole('textbox', { name: /first name or nickname/i }).fill(name);
  await page.getByRole('button', { name: /^continue$/i }).click();

  for (const question of QUESTIONS) {
    await expect(page.getByRole('heading', { name: question.prompt, exact: false })).toBeVisible();
    const index = optionPicker(question.id);
    const options = page.getByRole('radio');
    await options.nth(index).click();
    await page.waitForTimeout(420); // let the answer animation advance the step
  }

  await expect(page.getByRole('heading', { level: 1 })).toContainText(/the |style report/i, { timeout: 30000 });
}

export async function signInToAdmin(page: Page, password = 'e2e-host-password') {
  await page.goto('/admin');
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole('button', { name: /unlock dashboard/i }).click();
  await expect(page.getByRole('tab', { name: /overview/i })).toBeVisible();
}
