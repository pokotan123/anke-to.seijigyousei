import { test, expect, request } from '@playwright/test';

/**
 * 登録アンケート編集画面のステータス変更UIに関する回帰防止テスト
 *
 * 背景:
 * - 以前は `{!isRegistrationSurvey && (...)}` で登録アンケート編集画面に
 *   ステータス変更プルダウンが表示されず、新規作成時 draft → 編集画面で publish できないUX問題があった。
 * - 修正後は登録アンケート編集画面にもステータスUIが表示され、保存→ダッシュボードに反映される。
 *
 * カバレッジ:
 * - UI: 登録アンケート編集画面にステータスselectが表示される
 * - UI: 登録アンケート用の日程設定（登録開始日時/登録締切日時）が表示される
 * - UI: 投票用の日程設定（投票開始日時/投票終了日時）は登録アンケート編集画面では非表示
 * - UI: ステータスを draft → published に変更して保存→ダッシュボードに公開中表示される
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

test.describe('登録アンケート編集画面のステータスUI', () => {
  test('登録アンケート編集画面にステータスselectと登録用日時が表示される', async ({ page }) => {
    const req = await request.newContext();
    const token = await getAdminToken(req);
    const reg = await createSurvey(req, token, {
      title: `ステータスUI回帰テスト_${Date.now()}`,
      status: 'draft',
      require_registration: true,
    });

    await page.goto('/admin/login');
    await page.locator('input#username').fill('admin');
    await page.locator('input#password').fill('admin123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/admin/dashboard');

    await page.goto(`/admin/surveys/${reg.id}`);
    await expect(page.locator('h1', { hasText: '登録アンケート編集' })).toBeVisible();

    // ステータスselectが見える（回帰防止の本丸）
    const statusSelect = page.locator('select#status');
    await expect(statusSelect).toBeVisible();
    await expect(statusSelect).toHaveValue('draft');

    // 登録アンケート用の日時UIが表示される
    await expect(page.locator('input#registrationStartDate')).toBeVisible();
    await expect(page.locator('input#registrationDeadline')).toBeVisible();

    // 投票アンケート用の日時UIは非表示
    await expect(page.locator('input#startDate')).toHaveCount(0);
    await expect(page.locator('input#endDate')).toHaveCount(0);
  });

  test('ステータスを draft → published に変更→保存→ダッシュボードで公開中表示', async ({ page }) => {
    const req = await request.newContext();
    const token = await getAdminToken(req);
    const uniqueTitle = `ステータス変更フローテスト_${Date.now()}`;
    const reg = await createSurvey(req, token, {
      title: uniqueTitle,
      status: 'draft',
      require_registration: true,
    });

    await page.goto('/admin/login');
    await page.locator('input#username').fill('admin');
    await page.locator('input#password').fill('admin123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/admin/dashboard');

    await page.goto(`/admin/surveys/${reg.id}`);
    await expect(page.locator('select#status')).toHaveValue('draft');

    // alert を自動承認（保存時の「保存しました」用）
    page.on('dialog', (d) => d.accept());

    // published に変更
    await page.locator('select#status').selectOption('published');

    // 保存
    await page.locator('button', { hasText: '保存' }).first().click();

    // 再読み込みしても published のまま
    await page.reload();
    await expect(page.locator('select#status')).toHaveValue('published');

    // ダッシュボードに戻る
    await page.goto('/admin/dashboard');
    // 登録アンケートタブに切り替え
    await page.locator('button', { hasText: '登録アンケート' }).first().click();

    // 該当カードに「公開中」チップが表示されている
    const card = page.locator('a').filter({ hasText: uniqueTitle }).first();
    await expect(card).toBeVisible();
    await expect(card).toContainText('公開中');
  });
});
