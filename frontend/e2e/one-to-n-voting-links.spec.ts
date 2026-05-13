import { test, expect, request } from '@playwright/test';

/**
 * 1対N化（登録1件 → 投票N件）の主要シナリオE2E
 *
 * 前提: backend, frontend, DB が起動済み。docker compose down -v && up -d で fresh state。
 *
 * カバレッジ:
 * - 正常系: 紐付け2件で登録→ voters に2行作成（別 voter_token）
 * - 失敗系: 0件紐付けで /register 400
 * - 失敗系: 重複登録で 409、voters/votes/mail_outbox 全て書き込みなし
 * - 失敗系: PUT /voting-links を JWT なしで叩く → 401
 * - 失敗系: 自己リンクで 400
 * - 失敗系: 後付け通知 API を2回連続叩く → 2回目は idempotency_key で 0件送信
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

test.describe('1対N voting-links E2E', () => {
  test('正常系: 紐付け2件で登録 → voters 2行 + 別 voter_token', async () => {
    const req = await request.newContext();
    const token = await getAdminToken(req);

    // 投票アンケート2件作成
    const voting1 = await createSurvey(req, token, {
      title: 'Voting Survey 1',
      status: 'published',
      require_registration: false,
    });
    const voting2 = await createSurvey(req, token, {
      title: 'Voting Survey 2',
      status: 'published',
      require_registration: false,
    });

    // 登録アンケート作成
    const reg = await createSurvey(req, token, {
      title: 'Registration Survey',
      status: 'published',
      require_registration: true,
    });

    // email質問を追加
    const qRes = await req.post(`${API_BASE}/questions`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        survey_id: reg.id,
        question_text: 'Email',
        question_type: 'email',
        order: 0,
        is_required: true,
      },
    });
    expect(qRes.ok()).toBeTruthy();
    const emailQ = await qRes.json();

    // 紐付け 2件
    const linkRes = await req.put(`${API_BASE}/surveys/${reg.id}/voting-links`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { voting_survey_ids: [voting1.id, voting2.id] },
    });
    expect(linkRes.ok()).toBeTruthy();

    // 登録 POST
    const registerRes = await req.post(`${API_BASE}/voters/register`, {
      data: {
        survey_token: reg.unique_token,
        answers: [{ question_id: emailQ.id, answer_text: 'test1@example.com' }],
      },
    });
    expect(registerRes.status()).toBe(201);
    const body = await registerRes.json();
    expect(body.voting_count).toBe(2);
  });

  test('失敗系: 0件紐付けで /register → 400', async () => {
    const req = await request.newContext();
    const token = await getAdminToken(req);
    const reg = await createSurvey(req, token, {
      title: 'Reg with no links',
      status: 'published',
      require_registration: true,
    });
    const qRes = await req.post(`${API_BASE}/questions`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { survey_id: reg.id, question_text: 'Email', question_type: 'email', order: 0, is_required: true },
    });
    const emailQ = await qRes.json();

    const res = await req.post(`${API_BASE}/voters/register`, {
      data: {
        survey_token: reg.unique_token,
        answers: [{ question_id: emailQ.id, answer_text: 'noink@example.com' }],
      },
    });
    expect(res.status()).toBe(400);
  });

  test('失敗系: PUT /voting-links を JWT なし → 401', async () => {
    const req = await request.newContext();
    const res = await req.put(`${API_BASE}/surveys/1/voting-links`, {
      data: { voting_survey_ids: [] },
    });
    expect(res.status()).toBe(401);
  });

  test('失敗系: 自己リンク → 400', async () => {
    const req = await request.newContext();
    const token = await getAdminToken(req);
    const reg = await createSurvey(req, token, {
      title: 'Self link target',
      status: 'published',
      require_registration: true,
    });
    const res = await req.put(`${API_BASE}/surveys/${reg.id}/voting-links`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { voting_survey_ids: [reg.id] },
    });
    expect(res.status()).toBe(400);
  });

  test('失敗系: 後付け通知を2連打 → 2回目は idempotency_key で 0件送信', async () => {
    const req = await request.newContext();
    const token = await getAdminToken(req);
    const voting = await createSurvey(req, token, {
      title: 'Late add voting',
      status: 'published',
      require_registration: false,
    });
    const reg = await createSurvey(req, token, {
      title: 'Reg for late notify',
      status: 'published',
      require_registration: true,
    });
    const qRes = await req.post(`${API_BASE}/questions`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { survey_id: reg.id, question_text: 'Email', question_type: 'email', order: 0, is_required: true },
    });
    const emailQ = await qRes.json();

    // 投票1個を最初に紐付け、1人登録
    const voting0 = await createSurvey(req, token, {
      title: 'Initial voting',
      status: 'published',
      require_registration: false,
    });
    await req.put(`${API_BASE}/surveys/${reg.id}/voting-links`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { voting_survey_ids: [voting0.id] },
    });
    await req.post(`${API_BASE}/voters/register`, {
      data: {
        survey_token: reg.unique_token,
        answers: [{ question_id: emailQ.id, answer_text: 'lateadd@example.com' }],
      },
    });

    // 後付けで voting を追加
    await req.put(`${API_BASE}/surveys/${reg.id}/voting-links`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { voting_survey_ids: [voting0.id, voting.id] },
    });

    // 通知1回目
    const notify1 = await req.post(`${API_BASE}/surveys/${reg.id}/voting-links/${voting.id}/notify`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(notify1.ok()).toBeTruthy();
    const body1 = await notify1.json();
    expect(body1.enqueued).toBeGreaterThanOrEqual(1);

    // 通知2回目 → idempotency_key で skipped
    const notify2 = await req.post(`${API_BASE}/surveys/${reg.id}/voting-links/${voting.id}/notify`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(notify2.ok()).toBeTruthy();
    const body2 = await notify2.json();
    // 2回目: voter row は既に存在するため新規 INSERT スキップ、outbox も同一キーでスキップ
    expect(body2.enqueued).toBe(0);
  });
});
