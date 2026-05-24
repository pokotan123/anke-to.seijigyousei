import { test, expect, request } from '@playwright/test';

/**
 * 質問・選択肢の並び替え（昇格/降格ボタン）の E2E テスト
 *
 * 回帰防止対象のバグ:
 *   選択肢を編集画面の「+追加」で足すと order が 0 固定で作られ、
 *   全選択肢が同じ order 値になっていた。当時の並び替えは「隣接2件の
 *   order を swap」する方式だったため、0↔0 となり順序が変わらず、
 *   昇格/降格ボタンが「全然反応しない」状態だった。
 *
 * 修正方針（再採番方式）:
 *   移動時に並べ替えた配列の全件へ order を 1..N で振り直す。
 *   order が重複・欠落していても、操作のたびに連番へ自己修復される。
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3001/api/v1';

async function getAdminToken(req: any): Promise<string> {
  const res = await req.post(`${API_BASE}/auth/login`, {
    data: { username: 'admin', password: 'admin123' },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).token;
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

async function createOption(
  req: any,
  token: string,
  questionId: number,
  payload: Record<string, any>
) {
  const res = await req.post(`${API_BASE}/questions/${questionId}/options`, {
    headers: { Authorization: `Bearer ${token}` },
    data: payload,
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

async function getSurveyDetail(req: any, token: string, surveyId: number) {
  const res = await req.get(`${API_BASE}/surveys/${surveyId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

async function loginAsAdmin(page: any) {
  await page.goto('/admin/login');
  await page.locator('input#username').fill('admin');
  await page.locator('input#password').fill('admin123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/admin/dashboard');
}

test.describe('選択肢の並び替え', () => {
  test('order が全件 0 でも、上移動ボタンで順序が入れ替わり 1..N に再採番される', async ({
    page,
  }) => {
    const req = await request.newContext();
    const token = await getAdminToken(req);

    const survey = await createSurvey(req, token, {
      title: '選択肢並び替えテスト',
      status: 'draft',
      require_registration: false,
    });
    const question = await createQuestion(req, token, {
      survey_id: survey.id,
      question_text: '選択肢並び替え対象の質問',
      question_type: 'single_choice',
      order: 1,
      is_required: false,
    });
    // バグ状態を再現: order を全件 0 で作成
    await createOption(req, token, question.id, { option_text: '選択肢A', order: 0 });
    await createOption(req, token, question.id, { option_text: '選択肢B', order: 0 });
    await createOption(req, token, question.id, { option_text: '選択肢C', order: 0 });

    await loginAsAdmin(page);
    await page.goto(`/admin/surveys/${survey.id}`);

    const optionItems = page
      .locator('li')
      .filter({ has: page.locator('button[aria-label="選択肢を上に移動"]') });

    // 初期順は挿入順 A, B, C（order 同値 + tie-breaker id ASC で安定）
    await expect(optionItems.nth(0)).toContainText('選択肢A');
    await expect(optionItems.nth(1)).toContainText('選択肢B');
    await expect(optionItems.nth(2)).toContainText('選択肢C');

    // 「選択肢B」を上に移動
    await optionItems.nth(1).locator('button[aria-label="選択肢を上に移動"]').click();

    // 表示順が B, A, C に変わる
    await expect(optionItems.nth(0)).toContainText('選択肢B');
    await expect(optionItems.nth(1)).toContainText('選択肢A');
    await expect(optionItems.nth(2)).toContainText('選択肢C');

    // API でも order が 1,2,3 の連番に再採番されている
    const detail = await getSurveyDetail(req, token, survey.id);
    const options = detail.questions[0].options;
    expect(options.map((o: any) => o.option_text)).toEqual(['選択肢B', '選択肢A', '選択肢C']);
    expect(options.map((o: any) => o.order)).toEqual([1, 2, 3]);
  });

  test('端の選択肢の移動ボタンは無効（範囲外では再採番しない）', async ({ page }) => {
    const req = await request.newContext();
    const token = await getAdminToken(req);

    const survey = await createSurvey(req, token, {
      title: '選択肢並び替え端テスト',
      status: 'draft',
      require_registration: false,
    });
    const question = await createQuestion(req, token, {
      survey_id: survey.id,
      question_text: '端の選択肢の質問',
      question_type: 'single_choice',
      order: 1,
      is_required: false,
    });
    await createOption(req, token, question.id, { option_text: '先頭の選択肢', order: 1 });
    await createOption(req, token, question.id, { option_text: '末尾の選択肢', order: 2 });

    await loginAsAdmin(page);
    await page.goto(`/admin/surveys/${survey.id}`);

    const optionItems = page
      .locator('li')
      .filter({ has: page.locator('button[aria-label="選択肢を上に移動"]') });

    // 先頭の「上に移動」と末尾の「下に移動」は disabled
    await expect(
      optionItems.nth(0).locator('button[aria-label="選択肢を上に移動"]')
    ).toBeDisabled();
    await expect(
      optionItems.nth(1).locator('button[aria-label="選択肢を下に移動"]')
    ).toBeDisabled();
  });
});

test.describe('質問の並び替え', () => {
  test('order が全件 0 でも、下移動ボタンで順序が入れ替わり 1..N に再採番される', async ({
    page,
  }) => {
    const req = await request.newContext();
    const token = await getAdminToken(req);

    const survey = await createSurvey(req, token, {
      title: '質問並び替えテスト',
      status: 'draft',
      require_registration: false,
    });
    // バグ状態を再現: order を全件 0 で作成
    for (const text of ['質問アルファ', '質問ベータ', '質問ガンマ']) {
      await createQuestion(req, token, {
        survey_id: survey.id,
        question_text: text,
        question_type: 'text',
        order: 0,
        is_required: false,
      });
    }

    await loginAsAdmin(page);
    await page.goto(`/admin/surveys/${survey.id}`);

    // 先頭質問（質問アルファ）の「下に移動」をクリック
    await page.locator('button[aria-label="質問を下に移動"]').first().click();

    // 順序が ベータ, アルファ, ガンマ に変わるまで待つ
    await expect
      .poll(async () => {
        const detail = await getSurveyDetail(req, token, survey.id);
        return detail.questions.map((q: any) => q.question_text);
      })
      .toEqual(['質問ベータ', '質問アルファ', '質問ガンマ']);

    // order が 1..N の連番に再採番されている
    const detail = await getSurveyDetail(req, token, survey.id);
    expect(detail.questions.map((q: any) => q.order)).toEqual([1, 2, 3]);
  });
});
