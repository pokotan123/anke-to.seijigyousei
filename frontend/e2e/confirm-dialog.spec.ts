import { test, expect, request } from '@playwright/test';

/**
 * カスタム確認ダイアログ (ConfirmDialog) の E2E テスト
 *
 * 背景:
 *   - ブラウザの window.confirm() は「このページにダイアログを表示しない」設定や
 *     拡張機能で抑止されると、無音で false を返す。
 *   - その結果、削除/複製/再発行ボタンが無反応になるバグが発生していた。
 *   - 全 confirm() を独自 ConfirmDialog (DOM ベース) に置き換えて再発防止。
 *
 * カバレッジ:
 *   - 質問削除: 確認モーダルが表示され、OK で実際に削除される
 *   - 質問削除: 確認モーダルでキャンセルすると質問が残る
 *   - 選択肢削除: 確認モーダルが表示され、OK で実際に削除される
 *   - 回帰防止: window.confirm を無効化(=>false)しても、独自モーダルが表示されて削除可能
 *   - ダッシュボードの複製ボタンでも独自モーダルが表示される
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3001/api/v1';

async function getAdminToken(req: any): Promise<string> {
  const res = await req.post(`${API_BASE}/auth/login`, {
    data: { username: 'admin', password: 'admin123' },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.token;
}

async function createSurvey(req: any, token: string, payload: Record<string, any>) {
  const res = await req.post(`${API_BASE}/surveys`, {
    headers: { Authorization: `Bearer ${token}` },
    data: payload,
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

async function createQuestion(req: any, token: string, payload: Record<string, any>) {
  const res = await req.post(`${API_BASE}/questions`, {
    headers: { Authorization: `Bearer ${token}` },
    data: payload,
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

async function createOption(req: any, token: string, questionId: number, payload: Record<string, any>) {
  const res = await req.post(`${API_BASE}/questions/${questionId}/options`, {
    headers: { Authorization: `Bearer ${token}` },
    data: payload,
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

async function deleteSurvey(req: any, token: string, id: number) {
  await req.delete(`${API_BASE}/surveys/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function loginAsAdmin(page: any) {
  await page.goto('/admin/login');
  await page.getByLabel('ユーザー名').fill('admin');
  await page.getByLabel('パスワード').fill('admin123');
  await page.getByRole('button', { name: 'ログイン' }).click();
  await page.waitForURL('**/admin/dashboard');
}

test.describe('カスタム確認ダイアログ', () => {
  let surveyId: number;
  let questionId: number;
  let adminToken: string;

  test.beforeEach(async () => {
    const ctx = await request.newContext();
    adminToken = await getAdminToken(ctx);
    const survey = await createSurvey(ctx, adminToken, {
      title: `E2E確認ダイアログテスト ${Date.now()}`,
      description: 'ConfirmDialog 用',
      status: 'draft',
    });
    surveyId = survey.id;
    const question = await createQuestion(ctx, adminToken, {
      survey_id: surveyId,
      question_text: '削除対象の質問',
      question_type: 'single_choice',
      order: 0,
      is_required: false,
    });
    questionId = question.id;
    await createOption(ctx, adminToken, questionId, { option_text: '選択肢A', order: 0 });
    await createOption(ctx, adminToken, questionId, { option_text: '選択肢B', order: 1 });
    await ctx.dispose();
  });

  test.afterEach(async () => {
    const ctx = await request.newContext();
    try {
      await deleteSurvey(ctx, adminToken, surveyId);
    } catch {
      // ignore — テスト中に既に削除されたケース
    }
    await ctx.dispose();
  });

  test('質問削除: 独自モーダルが表示され OK で削除される', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/admin/surveys/${surveyId}`);
    await expect(page.getByRole('heading', { name: '削除対象の質問', exact: false })).toBeVisible();

    // 質問本体の削除ボタンをクリック
    await page.getByRole('button', { name: '削除' }).first().click();

    // 独自モーダルが表示される（DOM ベースなのでブラウザ抑止の影響を受けない）
    const dialog = page.getByTestId('confirm-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('この質問を削除しますか？');

    // OK で削除実行
    await dialog.getByTestId('confirm-dialog-ok').click();

    // ネイティブ alert は handle 必要 — 削除完了 alert を捕まえる
    page.once('dialog', (d) => d.accept());

    // 質問が消えるのを待つ
    await expect(page.getByRole('heading', { name: '削除対象の質問', exact: false })).toHaveCount(0);
  });

  test('質問削除: キャンセルで質問が残る', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/admin/surveys/${surveyId}`);
    await expect(page.getByRole('heading', { name: '削除対象の質問', exact: false })).toBeVisible();

    await page.getByRole('button', { name: '削除' }).first().click();
    const dialog = page.getByTestId('confirm-dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByTestId('confirm-dialog-cancel').click();
    await expect(dialog).toHaveCount(0);

    // 質問は残ったまま
    await expect(page.getByRole('heading', { name: '削除対象の質問', exact: false })).toBeVisible();
  });

  test('回帰防止: window.confirm を無効化しても独自モーダルで削除できる', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/admin/surveys/${surveyId}`);
    await expect(page.getByRole('heading', { name: '削除対象の質問', exact: false })).toBeVisible();

    // ユーザー環境を再現: window.confirm/alert を無効化
    await page.evaluate(() => {
      (window as any).confirm = () => false;
      (window as any).alert = () => {};
    });

    // 質問本体の削除ボタン → 独自モーダルが出るはず
    await page.getByRole('button', { name: '削除' }).first().click();
    const dialog = page.getByTestId('confirm-dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByTestId('confirm-dialog-ok').click();

    // 質問は実際に削除される
    await expect(page.getByRole('heading', { name: '削除対象の質問', exact: false })).toHaveCount(0);
  });

  test('選択肢削除: 独自モーダルが表示され OK で削除される', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/admin/surveys/${surveyId}`);
    await expect(page.getByText('選択肢A')).toBeVisible();

    // 選択肢A の削除ボタン（質問の削除ボタン1個 + 選択肢2個分 = 3個目以降が選択肢の削除）
    const deleteButtons = page.getByRole('button', { name: '削除' });
    // 0=質問削除, 1=選択肢A削除, 2=選択肢B削除
    await deleteButtons.nth(1).click();

    const dialog = page.getByTestId('confirm-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('この選択肢を削除しますか？');

    page.once('dialog', (d) => d.accept());
    await dialog.getByTestId('confirm-dialog-ok').click();

    await expect(page.getByText('選択肢A')).toHaveCount(0);
    // 選択肢B は残る
    await expect(page.getByText('選択肢B')).toBeVisible();
  });

  test('ダッシュボード複製: 独自モーダルが表示される', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForURL('**/admin/dashboard');

    // 作成したアンケートは draft なので 投票アンケートタブにある
    // 該当アンケートカード内の「複製」ボタンをクリック
    const card = page.locator('a', { hasText: 'E2E確認ダイアログテスト' }).first();
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: '複製' }).click();

    const dialog = page.getByTestId('confirm-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('複製しますか');

    // キャンセル — 複製実行はしない（cleanup責任を軽くする）
    await dialog.getByTestId('confirm-dialog-cancel').click();
    await expect(dialog).toHaveCount(0);
  });
});
