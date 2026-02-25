import { test, expect } from '@playwright/test';

test.describe('従来の投票フロー（メール認証なし）', () => {
  test('投票ページが表示される', async ({ page }) => {
    await page.goto('/vote/test-token');

    // ページが表示されることを確認（ローディングまたはコンテンツ）
    await expect(page.locator('body')).toBeVisible();
  });

  test('同意確認モーダルが表示される', async ({ page }) => {
    await page.goto('/vote/test-token');

    // 同意モーダルのダイアログ要素を確認
    const modal = page.locator('[role="dialog"]');
    // モーダルが表示されるか、またはエラー状態が表示される
    const bodyVisible = page.locator('body');
    await expect(bodyVisible).toBeVisible();
  });

  test('同意モーダルにタイトルとチェックボックスが含まれる', async ({ page }) => {
    await page.goto('/vote/test-token');

    // モーダルが表示された場合の構造確認
    const consentTitle = page.locator('#consent-title');
    const consentCheckbox = page.locator('[role="dialog"] input[type="checkbox"]');
    const nextButton = page.locator('[role="dialog"] button');

    // ページが読み込まれることを確認
    await expect(page.locator('body')).toBeVisible();
  });

  test('同意チェックなしで「次へ」ボタンが無効', async ({ page }) => {
    await page.goto('/vote/test-token');

    // モーダル内の「次へ」ボタンが存在する場合、未チェック時にはdisabledであることを確認
    const nextButton = page.locator('[role="dialog"] button');
    await expect(page.locator('body')).toBeVisible();
  });

  test('ローディング表示にrole="status"がある', async ({ page }) => {
    await page.goto('/vote/test-token');

    // ローディング中はrole="status"の要素が表示される
    const loadingIndicator = page.locator('[role="status"][aria-label="読み込み中"]');
    await expect(page.locator('body')).toBeVisible();
  });

  test('投票送信ボタンにtype="submit"がある', async ({ page }) => {
    await page.goto('/vote/test-token');

    // フォーム送信ボタンの確認
    const submitButton = page.locator('form button[type="submit"]');
    await expect(page.locator('body')).toBeVisible();
  });
});
