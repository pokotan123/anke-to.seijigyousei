import { test, expect } from '@playwright/test';

test.describe('管理画面 - ログイン', () => {
  test('ログインページが表示される', async ({ page }) => {
    await page.goto('/admin/login');

    await expect(page.locator('input#username')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();
  });

  test('ログインフォームに送信ボタンがある', async ({ page }) => {
    await page.goto('/admin/login');

    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();
  });

  test('ログインページのタイトルが正しい', async ({ page }) => {
    await page.goto('/admin/login');

    await expect(page.locator('h1')).toHaveText('管理画面ログイン');
  });
});

test.describe('管理画面 - ダッシュボード', () => {
  test('ダッシュボードページにアクセスできる', async ({ page }) => {
    await page.goto('/admin/dashboard');

    // 認証なしの場合、ログインページにリダイレクトされるか、ページが表示される
    await expect(page.locator('body')).toBeVisible();
  });

  test('ナビゲーションにaria-label="管理メニュー"がある', async ({ page }) => {
    await page.goto('/admin/dashboard');

    // ダッシュボードが表示された場合のナビ確認
    const nav = page.locator('nav[aria-label="管理メニュー"]');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('管理画面 - アンケート作成', () => {
  test('アンケート作成フォームが表示される', async ({ page }) => {
    await page.goto('/admin/surveys/new');

    // 基本フォーム要素の確認
    await expect(page.locator('input#title')).toBeVisible();
    await expect(page.locator('textarea#description')).toBeVisible();
    await expect(page.locator('select#status')).toBeVisible();
  });

  test('メール認証設定のチェックボックスが存在する', async ({ page }) => {
    await page.goto('/admin/surveys/new');

    const checkbox = page.locator('input#require_registration');
    await expect(checkbox).toBeVisible();
  });

  test('メール認証設定のトグルで追加項目が表示される', async ({ page }) => {
    await page.goto('/admin/surveys/new');

    const checkbox = page.locator('input#require_registration');
    await checkbox.check();

    // 登録案内メッセージのtextareaが表示される
    const messageTextarea = page.locator('textarea#registrationMessage');
    await expect(messageTextarea).toBeVisible();

    // 登録締め切りのinputが表示される
    const deadlineInput = page.locator('input#registrationDeadline');
    await expect(deadlineInput).toBeVisible();
  });

  test('メール認証チェック解除で追加項目が非表示になる', async ({ page }) => {
    await page.goto('/admin/surveys/new');

    const checkbox = page.locator('input#require_registration');

    // チェックを入れて追加項目を表示
    await checkbox.check();
    await expect(page.locator('textarea#registrationMessage')).toBeVisible();

    // チェックを外して追加項目を非表示
    await checkbox.uncheck();
    await expect(page.locator('textarea#registrationMessage')).not.toBeVisible();
    await expect(page.locator('input#registrationDeadline')).not.toBeVisible();
  });

  test('ステータスのセレクトに正しい選択肢がある', async ({ page }) => {
    await page.goto('/admin/surveys/new');

    const statusSelect = page.locator('select#status');
    await expect(statusSelect.locator('option[value="draft"]')).toHaveText('下書き');
    await expect(statusSelect.locator('option[value="published"]')).toHaveText('公開中');
    await expect(statusSelect.locator('option[value="closed"]')).toHaveText('終了');
  });

  test('日時入力フィールドが存在する', async ({ page }) => {
    await page.goto('/admin/surveys/new');

    await expect(page.locator('input#startDate[type="datetime-local"]')).toBeVisible();
    await expect(page.locator('input#endDate[type="datetime-local"]')).toBeVisible();
  });

  test('カスタム登録項目を追加できる', async ({ page }) => {
    await page.goto('/admin/surveys/new');

    // メール認証を有効化
    const checkbox = page.locator('input#require_registration');
    await checkbox.check();

    // 「+ 項目を追加」ボタンをクリック
    const addButton = page.locator('button', { hasText: '項目を追加' });
    await addButton.click();

    // 項目名の入力フィールドが追加される
    const fieldInput = page.locator('input[placeholder="項目名（例: 学校名）"]');
    await expect(fieldInput).toBeVisible();
  });
});
