import { expect, test } from '@playwright/test';
import { completeQuiz } from './helpers';

test.describe('participant flow', () => {
  test('complete quiz → report → 5 stars → decline phone → finish', async ({ page }) => {
    await completeQuiz(page, 'Ada');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/style-expression index/i).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /what is working/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /two things to try/i })).toBeVisible();
    await expect(page.getByText(/not an objective judgment of appearance/i)).toBeVisible();

    await page.getByRole('button', { name: /rate the experience/i }).click();
    await page.getByRole('radio', { name: /^5 stars/i }).click();
    await page.getByRole('button', { name: /^fun$/i }).click();
    await page.getByRole('button', { name: /send feedback/i }).click();

    await expect(page.getByRole('heading', { name: /want to keep in touch/i })).toBeVisible();
    await page.getByRole('button', { name: /no thanks — finish/i }).click();

    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible();
    await expect(page.getByText(/without leaving a number/i)).toBeVisible();
    await expect(page.getByText(/answers have been cleared/i)).toBeVisible();
  });

  test('voluntary consented phone is visible only in the host dashboard', async ({ page }) => {
    await completeQuiz(page, 'Bola');
    await page.getByRole('button', { name: /skip to sharing details/i }).click();

    await page.getByLabel(/name to save/i).fill('Bola');
    await page.getByLabel(/phone number/i).fill('0803 123 4567');
    await page.getByRole('checkbox').check();
    await expect(page.getByRole('button', { name: /save my number/i })).toBeEnabled();
    await page.getByRole('button', { name: /save my number/i }).click();

    await expect(page.getByRole('heading', { name: /saved on this device/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 15000 });

    await page.goto('/admin');
    await page.getByLabel(/^password$/i).fill('e2e-host-password');
    await page.getByRole('button', { name: /unlock dashboard/i }).click();
    await page.getByRole('tab', { name: /contacts/i }).click();
    await expect(page.getByText('Bola')).toBeVisible();
    await expect(page.getByText('+234 803 123 4567')).toBeVisible();
  });

  test('consent checkbox is never pre-checked and blocks saving', async ({ page }) => {
    await completeQuiz(page, 'Chi');
    await page.getByRole('button', { name: /skip to sharing details/i }).click();

    await expect(page.getByRole('checkbox')).not.toBeChecked();
    await page.getByLabel(/phone number/i).fill('0803 987 6543');
    await expect(page.getByRole('button', { name: /save my number/i })).toBeDisabled();

    await page.getByRole('checkbox').check();
    await expect(page.getByRole('button', { name: /save my number/i })).toBeEnabled();
  });

  test('skip feedback → skip phone → finish', async ({ page }) => {
    await completeQuiz(page, 'Dayo', () => 2);
    await page.getByRole('button', { name: /rate the experience/i }).click();
    await page.getByRole('button', { name: /skip — no feedback/i }).click();
    await page.getByRole('button', { name: /no thanks — finish/i }).click();
    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible();
  });

  test('Gemini outage: report still completes with the local fallback', async ({ page }) => {
    const reportRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().endsWith('/api/report')) reportRequests.push(request.url());
    });
    await completeQuiz(page, 'Emeka');
    expect(reportRequests.length).toBeGreaterThan(0);
    await expect(page.getByText(/written on this device without the ai writer/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /what is working/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /two things to try/i })).toBeVisible();
  });

  test('restart clears the previous participant completely', async ({ page }) => {
    await completeQuiz(page, 'Zara');
    await page.getByRole('button', { name: /skip to sharing details/i }).click();
    await page.getByRole('button', { name: /no thanks — finish/i }).click();
    await page.getByRole('button', { name: /start fresh for someone new/i }).click();

    await expect(page.getByRole('heading', { name: /your style\. your aura\./i })).toBeVisible();
    await page.getByRole('button', { name: /start the style check/i }).click();
    await expect(page.getByRole('textbox', { name: /first name or nickname/i })).toHaveValue('');

    // The previous report cannot be revisited after the reset.
    await page.goto('/reveal');
    await expect(page).toHaveURL(/\/quiz$/);
    await expect(page.getByText('Zara')).toHaveCount(0);
  });

  test('browser back and forward never resurrect another participant', async ({ page }) => {
    await completeQuiz(page, 'Femi');
    const reportUrl = page.url();
    await page.getByRole('button', { name: /rate the experience/i }).click();
    await page.goBack();
    await page.goForward();
    await page.goto('/');
    await page.getByRole('button', { name: /start the style check/i }).click();
    await expect(page.getByRole('textbox', { name: /first name or nickname/i })).toHaveValue('');
    await expect(page).not.toHaveURL(reportUrl);
  });
});
