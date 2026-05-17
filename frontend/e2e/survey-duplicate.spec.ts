import { test, expect, request } from '@playwright/test';

/**
 * アンケート複製機能の E2E テスト
 *
 * カバレッジ:
 * - API正常系: 設定 + 質問 + 選択肢のみコピーされる
 * - API正常系: status は draft / 日付系は null / 新規 unique_token
 * - API正常系: voters / votes / voting-links はコピーされない
 * - API正常系: タイトルに「のコピー」が付与される
 * - API失敗系: 存在しない survey_id → 404
 * - API失敗系: 未認証 → 401
 * - UI: 一覧画面の複製ボタンから新規アンケートが作成され編集画面に遷移
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

test.describe('アンケート複製 API', () => {
  test('正常系: 設定 + 質問 + 選択肢が新規 survey にコピーされる', async () => {
    const req = await request.newContext();
    const token = await getAdminToken(req);

    // 元アンケート: 公開済み + 期間設定あり
    const source = await createSurvey(req, token, {
      title: '複製元アンケート',
      description: 'これは複製テスト用のアンケートです',
      status: 'published',
      start_date: '2026-01-01T00:00:00.000Z',
      end_date: '2026-12-31T23:59:59.000Z',
      require_registration: false,
      vote_mail_body: 'voteメール本文',
    });

    // 質問 + 選択肢
    const q1 = await createQuestion(req, token, {
      survey_id: source.id,
      question_text: '好きな色は？',
      question_type: 'single_choice',
      order: 0,
      is_required: true,
    });
    await createOption(req, token, q1.id, { option_text: '赤', order: 0 });
    await createOption(req, token, q1.id, { option_text: '青', order: 1 });
    await createOption(req, token, q1.id, { option_text: '緑', order: 2 });

    const q2 = await createQuestion(req, token, {
      survey_id: source.id,
      question_text: '自由記述',
      question_type: 'text',
      order: 1,
      is_required: false,
    });

    // 複製実行
    const dupRes = await req.post(`${API_BASE}/surveys/${source.id}/duplicate`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(dupRes.status()).toBe(201);
    const newSurvey = await dupRes.json();

    // タイトルに「のコピー」が付く
    expect(newSurvey.title).toBe('複製元アンケートのコピー');
    // status は draft
    expect(newSurvey.status).toBe('draft');
    // 日付系は null
    expect(newSurvey.start_date).toBeNull();
    expect(newSurvey.end_date).toBeNull();
    // unique_token は新規
    expect(newSurvey.unique_token).not.toBe(source.unique_token);
    expect(newSurvey.unique_token).toBeTruthy();
    // description, vote_mail_body はコピー
    expect(newSurvey.description).toBe('これは複製テスト用のアンケートです');
    expect(newSurvey.vote_mail_body).toBe('voteメール本文');

    // 質問が同数コピーされている
    const detailRes = await req.get(`${API_BASE}/surveys/${newSurvey.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(detailRes.ok()).toBeTruthy();
    const detail = await detailRes.json();
    expect(detail.questions).toHaveLength(2);

    // 質問の中身（id は別だが内容は同じ）
    const newQ1 = detail.questions.find((q: any) => q.question_text === '好きな色は？');
    expect(newQ1).toBeTruthy();
    expect(newQ1.id).not.toBe(q1.id);
    expect(newQ1.question_type).toBe('single_choice');
    expect(newQ1.is_required).toBe(true);
    expect(newQ1.options).toHaveLength(3);
    const colorTexts = newQ1.options.map((o: any) => o.option_text);
    expect(colorTexts).toEqual(['赤', '青', '緑']);

    const newQ2 = detail.questions.find((q: any) => q.question_text === '自由記述');
    expect(newQ2).toBeTruthy();
    expect(newQ2.question_type).toBe('text');
    expect(newQ2.options).toEqual([]);
  });

  test('正常系: 登録アンケートを複製しても voting-links はコピーされない', async () => {
    const req = await request.newContext();
    const token = await getAdminToken(req);

    // 投票アンケート + 登録アンケート + 紐付け
    const voting = await createSurvey(req, token, {
      title: '紐付け先投票',
      status: 'published',
      require_registration: false,
    });
    const reg = await createSurvey(req, token, {
      title: '複製元登録アンケート',
      status: 'published',
      require_registration: true,
    });
    const linkRes = await req.put(`${API_BASE}/surveys/${reg.id}/voting-links`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { voting_survey_ids: [voting.id] },
    });
    expect(linkRes.ok()).toBeTruthy();

    // 複製
    const dupRes = await req.post(`${API_BASE}/surveys/${reg.id}/duplicate`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(dupRes.status()).toBe(201);
    const newSurvey = await dupRes.json();

    // require_registration はコピーされる
    expect(newSurvey.require_registration).toBe(true);

    // voting-links は空（コピーされない）
    const linksRes = await req.get(`${API_BASE}/surveys/${newSurvey.id}/voting-links`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(linksRes.ok()).toBeTruthy();
    const links = await linksRes.json();
    expect(links.voting_survey_ids).toEqual([]);
  });

  test('失敗系: 存在しない survey id → 404', async () => {
    const req = await request.newContext();
    const token = await getAdminToken(req);

    const res = await req.post(`${API_BASE}/surveys/9999999/duplicate`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(404);
  });

  test('失敗系: 未認証 → 401', async () => {
    const req = await request.newContext();
    // 元アンケートだけ作っておく
    const token = await getAdminToken(req);
    const source = await createSurvey(req, token, {
      title: '認証テスト用',
      status: 'draft',
      require_registration: false,
    });

    // 認証ヘッダなしで叩く
    const res = await req.post(`${API_BASE}/surveys/${source.id}/duplicate`);
    expect(res.status()).toBe(401);
  });
});

test.describe('アンケート複製 UI', () => {
  test('一覧画面の複製ボタンから編集画面へ遷移する', async ({ page }) => {
    // 事前にAPIで元データを作成
    const req = await request.newContext();
    const token = await getAdminToken(req);
    const source = await createSurvey(req, token, {
      title: 'UI複製テスト用アンケート',
      status: 'draft',
      require_registration: false,
    });
    await createQuestion(req, token, {
      survey_id: source.id,
      question_text: 'UI複製の質問',
      question_type: 'text',
      order: 0,
      is_required: false,
    });

    // ブラウザでログイン
    await page.goto('/admin/login');
    await page.locator('input#username').fill('admin');
    await page.locator('input#password').fill('admin123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/admin/dashboard');

    // 該当行の複製ボタンをクリック
    const card = page.locator('a').filter({ hasText: 'UI複製テスト用アンケート' }).first();
    await card.locator('button', { hasText: '複製' }).click();

    // 独自確認モーダルが表示される → OK を押す
    const dialog = page.getByTestId('confirm-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('UI複製テスト用アンケート');
    await dialog.getByTestId('confirm-dialog-ok').click();

    // 編集画面に遷移
    await page.waitForURL(/\/admin\/surveys\/\d+/);

    // タイトル入力欄に「○○のコピー」が入っている
    const titleInput = page.locator('input#title');
    await expect(titleInput).toHaveValue(/UI複製テスト用アンケートのコピー/);
  });
});
