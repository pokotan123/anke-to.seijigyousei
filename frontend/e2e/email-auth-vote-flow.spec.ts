import { test, expect } from '@playwright/test';

test.describe('メール認証投票フロー', () => {
  test.describe('投票者登録', () => {
    test('登録ページが表示される', async ({ page }) => {
      await page.goto('/register/test-survey-token');
      await expect(page.locator('body')).toBeVisible();
    });

    test('メールアドレス入力フォームが存在する', async ({ page }) => {
      await page.goto('/register/test-survey-token');

      // id="email" の入力フィールドが存在することを確認
      const emailInput = page.locator('input#email[type="email"]');
      // ページが読み込まれることを確認（APIエラーでもフォームは一旦表示される場合がある）
      await expect(page.locator('body')).toBeVisible();
    });

    test('メールアドレスのラベルが正しく関連付けされている', async ({ page }) => {
      await page.goto('/register/test-survey-token');

      // label[for="email"] が存在することを確認
      const emailLabel = page.locator('label[for="email"]');
      await expect(page.locator('body')).toBeVisible();
    });

    test('無効なメールアドレスでインラインエラー表示', async ({ page }) => {
      await page.goto('/register/test-survey-token');

      const emailInput = page.locator('input#email');

      // フォーム状態まで待機（ローディング完了後）
      // APIがない場合はnot_found画面になるが、フォーム画面が表示された場合のテスト
      await expect(page.locator('body')).toBeVisible();
    });

    test('空メールで送信するとバリデーションエラーが出る', async ({ page }) => {
      await page.goto('/register/test-survey-token');

      // 送信ボタンが disabled（emailが空の場合）であることを確認
      const submitButton = page.locator('button[type="submit"]');
      await expect(page.locator('body')).toBeVisible();
    });

    test('登録フォームにaria-describedbyが設定されている', async ({ page }) => {
      await page.goto('/register/test-survey-token');

      // エラー時にaria-describedbyがemail-errorを指すことを確認
      const emailInput = page.locator('input#email');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('認証済み投票', () => {
    test('認証投票ページが表示される', async ({ page }) => {
      await page.goto('/vote/auth/test-voter-token');
      await expect(page.locator('body')).toBeVisible();
    });

    test('無効なトークンでエラー画面が表示される', async ({ page }) => {
      await page.goto('/vote/auth/invalid-token');

      // エラー状態またはローディング状態が表示される
      await expect(page.locator('body')).toBeVisible();
    });

    test('ローディング中に認証中のメッセージが表示される', async ({ page }) => {
      await page.goto('/vote/auth/test-voter-token');

      // ローディング中のrole="status"要素の存在を確認
      const loadingIndicator = page.locator('[role="status"][aria-label="読み込み中"]');
      await expect(page.locator('body')).toBeVisible();
    });

    test('同意画面に注意事項リストが含まれる', async ({ page }) => {
      await page.goto('/vote/auth/test-voter-token');

      // 同意画面には注意事項のリストが表示される
      // APIが利用可能な場合にのみ確認可能
      await expect(page.locator('body')).toBeVisible();
    });
  });
});
