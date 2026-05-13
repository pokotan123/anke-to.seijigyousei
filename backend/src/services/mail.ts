import { Resend } from 'resend';
import { pool } from '../database/connection';
import { MailOutbox } from '../models/MailOutbox';
import { SurveyModel, type Survey } from '../models/Survey';

const resend = new Resend(process.env.RESEND_API_KEY);

const MAIL_FROM = process.env.MAIL_FROM || 'noreply@example.com';
const rawFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const FRONTEND_URL = rawFrontendUrl.includes(',')
  ? rawFrontendUrl.split(',').pop()!.trim()
  : rawFrontendUrl;
const MAIL_MAX_LINK_COUNT = Number(process.env.MAIL_MAX_LINK_COUNT || 5);
const MAIL_RESEND_PREFIX = process.env.MAIL_RESEND_PREFIX || '[再送] ';

interface SendVoteLinkParams {
  email: string;
  voterToken: string;
  surveyTitle: string;
  surveyDescription: string | null;
  endDate: Date | null;
  customBody?: string | null;
}

interface SendReminderParams {
  email: string;
  voterToken: string;
  surveyTitle: string;
  endDate: Date | null;
  customBody?: string | null;
}

interface MailResult {
  success: boolean;
  error?: string;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function formatEndDate(endDate: Date | null): string {
  if (!endDate) {
    return '未定';
  }
  return new Date(endDate).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildVoteUrl(voterToken: string): string {
  return `${FRONTEND_URL}/vote/auth/${voterToken}`;
}

function buildVoteLinkHtml(params: SendVoteLinkParams, voteUrl: string, endDateStr: string): string {
  const descriptionRow = params.surveyDescription
    ? `<tr><td style="padding: 8px; font-weight: bold;">説明</td><td style="padding: 8px;">${escapeHtml(params.surveyDescription)}</td></tr>`
    : '';

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>投票のご案内</h2>
      <p>以下のアンケートへの投票が可能になりました。</p>
      <table style="border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; font-weight: bold;">アンケート名</td><td style="padding: 8px;">${escapeHtml(params.surveyTitle)}</td></tr>
        ${descriptionRow}
        <tr><td style="padding: 8px; font-weight: bold;">投票期限</td><td style="padding: 8px;">${endDateStr}</td></tr>
      </table>
      <p>下記のリンクから投票してください（1回のみ有効）:</p>
      <p><a href="${voteUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">投票する</a></p>
      <p style="color: #666; font-size: 14px;">※このリンクはあなた専用です。他の方への転送はお控えください。</p>
      <p style="color: #666; font-size: 14px;">※1度投票すると、リンクは無効になります。</p>
    </div>
  `;
}

function buildReminderHtml(params: SendReminderParams, voteUrl: string, endDateStr: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>投票リマインド</h2>
      <p>まだ投票がお済みでないようです。</p>
      <table style="border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; font-weight: bold;">アンケート名</td><td style="padding: 8px;">${escapeHtml(params.surveyTitle)}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">投票期限</td><td style="padding: 8px;">${endDateStr}</td></tr>
      </table>
      <p>以下のリンクから投票してください:</p>
      <p><a href="${voteUrl}" style="display: inline-block; padding: 12px 24px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px;">今すぐ投票する</a></p>
    </div>
  `;
}

interface SendRegistrationConfirmationParams {
  email: string;
  surveyTitle: string;
  votingSurveyTitle: string;
  customBody?: string | null;
}

function buildRegistrationConfirmationHtml(params: SendRegistrationConfirmationParams): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>登録完了のお知らせ</h2>
      <p>${escapeHtml(params.email)} 様</p>
      <p>以下のアンケートへの登録が完了しました。</p>
      <table style="border-collapse: collapse; margin: 16px 0; width: 100%;">
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px; font-weight: bold; color: #475569;">登録アンケート</td>
          <td style="padding: 8px;">${escapeHtml(params.surveyTitle)}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px; font-weight: bold; color: #475569;">投票アンケート</td>
          <td style="padding: 8px;">${escapeHtml(params.votingSurveyTitle)}</td>
        </tr>
      </table>
      <p>投票リンクは後日メールでお届けします。しばらくお待ちください。</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">※このメールは自動送信です。心当たりがない場合は破棄してください。</p>
    </div>
  `;
}

interface TagValues {
  survey_title?: string;
  email?: string;
  end_date?: string;
  voting_survey_title?: string;
}

function replaceTemplateTags(text: string, tags: TagValues): string {
  return text
    .replace(/\{survey_title\}/g, tags.survey_title || '')
    .replace(/\{email\}/g, tags.email || '')
    .replace(/\{end_date\}/g, tags.end_date || '')
    .replace(/\{voting_survey_title\}/g, tags.voting_survey_title || '');
}

function buildCustomBodyHtml(body: string, tags: TagValues, actionUrl?: string, actionLabel?: string): string {
  const replaced = replaceTemplateTags(body, tags);
  const actionButton = actionUrl && actionLabel
    ? `<p><a href="${actionUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">${escapeHtml(actionLabel)}</a></p>`
    : '';

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      ${escapeHtml(replaced).replace(/\n/g, '<br />')}
      ${actionButton}
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">※このメールは自動送信です。</p>
    </div>
  `;
}

/** 複数リンク列挙の登録完了メール HTML */
function buildMultiLinkRegistrationHtml(params: {
  email: string;
  registrationTitle: string;
  links: Array<{ voting_survey_title: string; voter_token: string; end_date: Date | null }>;
}): string {
  const visible = params.links.slice(0, MAIL_MAX_LINK_COUNT);
  const overflow = params.links.length - visible.length;

  const linkRows = visible
    .map((l, i) => {
      const url = buildVoteUrl(l.voter_token);
      const endDateStr = formatEndDate(l.end_date);
      return `
        <li style="margin-bottom: 12px;">
          <div style="font-weight: bold;">${i + 1}. ${escapeHtml(l.voting_survey_title)}</div>
          <div style="color: #475569; font-size: 14px;">投票期限: ${endDateStr}</div>
          <a href="${url}" style="display: inline-block; margin-top: 4px; padding: 8px 16px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 4px;">投票する</a>
        </li>
      `;
    })
    .join('');

  const overflowMsg = overflow > 0
    ? `<p style="color: #64748b;">他 ${overflow} 件の投票アンケートがあります。詳細は管理画面でご確認ください。</p>`
    : '';

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>ご登録ありがとうございます</h2>
      <p>${escapeHtml(params.email)} 様</p>
      <p>「${escapeHtml(params.registrationTitle)}」へのご登録が完了しました。</p>
      <p>以下の投票アンケートにご回答ください（各リンクは1度のみ有効）:</p>
      <ul style="list-style: none; padding: 0;">${linkRows}</ul>
      ${overflowMsg}
      <p style="color: #94a3b8; font-size: 12px;">※迷惑メールフォルダに入る場合があります。</p>
    </div>
  `;
}

/** 後付け追加通知メール HTML */
function buildNewVotingNotificationHtml(params: {
  email: string;
  registrationTitle: string;
  votingTitle: string;
  voterToken: string;
  endDate: Date | null;
}): string {
  const url = buildVoteUrl(params.voterToken);
  const endDateStr = formatEndDate(params.endDate);
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>新しい投票アンケートのお知らせ</h2>
      <p>${escapeHtml(params.email)} 様</p>
      <p>以前「${escapeHtml(params.registrationTitle)}」にご登録いただいた皆様向けに、新しい投票アンケートが公開されました。</p>
      <table style="border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; font-weight: bold;">アンケート名</td><td style="padding: 8px;">${escapeHtml(params.votingTitle)}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">投票期限</td><td style="padding: 8px;">${endDateStr}</td></tr>
      </table>
      <p><a href="${url}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">投票する</a></p>
      <p style="color: #94a3b8; font-size: 12px;">※このリンクはあなた専用です。1度のみ有効です。</p>
    </div>
  `;
}

export class MailService {
  static async sendVoteLink(params: SendVoteLinkParams): Promise<MailResult> {
    const voteUrl = buildVoteUrl(params.voterToken);
    const endDateStr = formatEndDate(params.endDate);
    const html = params.customBody
      ? buildCustomBodyHtml(params.customBody, { survey_title: params.surveyTitle, email: params.email, end_date: endDateStr }, voteUrl, '投票する')
      : buildVoteLinkHtml(params, voteUrl, endDateStr);

    try {
      await resend.emails.send({
        from: MAIL_FROM,
        to: params.email,
        subject: `【${params.surveyTitle}】投票のご案内`,
        html,
      });
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'メール送信に失敗しました';
      return { success: false, error: message };
    }
  }

  static async sendReminder(params: SendReminderParams): Promise<MailResult> {
    const voteUrl = buildVoteUrl(params.voterToken);
    const endDateStr = formatEndDate(params.endDate);
    const html = params.customBody
      ? buildCustomBodyHtml(params.customBody, { survey_title: params.surveyTitle, email: params.email, end_date: endDateStr }, voteUrl, '今すぐ投票する')
      : buildReminderHtml(params, voteUrl, endDateStr);

    try {
      await resend.emails.send({
        from: MAIL_FROM,
        to: params.email,
        subject: `【リマインド】${params.surveyTitle} まだ投票されていません`,
        html,
      });
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'リマインドメール送信に失敗しました';
      return { success: false, error: message };
    }
  }

  static async sendRegistrationConfirmation(params: SendRegistrationConfirmationParams): Promise<MailResult> {
    const html = params.customBody
      ? buildCustomBodyHtml(params.customBody, { survey_title: params.surveyTitle, email: params.email, voting_survey_title: params.votingSurveyTitle })
      : buildRegistrationConfirmationHtml(params);

    try {
      await resend.emails.send({
        from: MAIL_FROM,
        to: params.email,
        subject: `【${params.surveyTitle}】登録完了のお知らせ`,
        html,
      });
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '登録完了メール送信に失敗しました';
      return { success: false, error: message };
    }
  }

  /**
   * 1対N: mail_outbox から該当の登録完了メール行を取り出し、複数リンクを列挙して送信
   */
  static async processOutboxRegistrationConfirmation(email: string, registrationSurvey: Survey): Promise<void> {
    const emailHash = MailOutbox.hashEmail(email);
    const idemKey = `regconf:${registrationSurvey.id}:${emailHash}`;
    const res = await pool.query(
      `SELECT * FROM mail_outbox WHERE idempotency_key = $1 AND status IN ('pending','failed') LIMIT 1`,
      [idemKey]
    );
    if (res.rows.length === 0) return;
    const row = res.rows[0];
    const payload = row.payload as {
      registration_survey_id: number;
      registration_survey_title: string;
      links: Array<{ voting_survey_id: number; voter_token: string }>;
    };

    // 投票アンケートのタイトル・期限を解決
    const enriched = await Promise.all(
      payload.links.map(async (l) => {
        const s = await SurveyModel.findById(l.voting_survey_id);
        return {
          voting_survey_title: s?.title || '投票アンケート',
          voter_token: l.voter_token,
          end_date: s?.end_date || null,
        };
      })
    );

    const html = buildMultiLinkRegistrationHtml({
      email,
      registrationTitle: payload.registration_survey_title,
      links: enriched,
    });

    const isResend = row.retry_count > 0;
    const subject = `${isResend ? MAIL_RESEND_PREFIX : ''}【ご登録ありがとうございます】${payload.registration_survey_title}`;

    try {
      await resend.emails.send({ from: MAIL_FROM, to: email, subject, html });
      await MailOutbox.markSent(row.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await MailOutbox.markFailed(row.id, msg);
    }
  }

  /**
   * 1対N 後付け通知: enqueue 済みの new_voting_notification 行を順次送信
   */
  static async processOutboxNewVotingNotifications(
    votingSurveyId: number,
    issued: Array<{ email: string; voter_token: string }>
  ): Promise<void> {
    const votingSurvey = await SurveyModel.findById(votingSurveyId);
    if (!votingSurvey) return;

    for (const it of issued) {
      // 該当 outbox 行を取得（最新の pending/failed）
      const res = await pool.query(
        `SELECT * FROM mail_outbox
         WHERE to_email = $1 AND mail_type = 'new_voting_notification'
           AND (payload->>'voting_survey_id')::int = $2
           AND status IN ('pending','failed')
         ORDER BY id DESC LIMIT 1`,
        [it.email, votingSurveyId]
      );
      if (res.rows.length === 0) continue;
      const row = res.rows[0];
      const payload = row.payload as {
        registration_survey_id: number;
        registration_survey_title: string;
        voting_survey_id: number;
        voting_survey_title: string;
        voter_token: string;
      };

      const html = buildNewVotingNotificationHtml({
        email: it.email,
        registrationTitle: payload.registration_survey_title,
        votingTitle: payload.voting_survey_title,
        voterToken: payload.voter_token,
        endDate: votingSurvey.end_date,
      });

      const isResend = row.retry_count > 0;
      const subject = `${isResend ? MAIL_RESEND_PREFIX : ''}【新しい投票アンケート】${payload.voting_survey_title}`;

      try {
        await resend.emails.send({ from: MAIL_FROM, to: it.email, subject, html });
        await MailOutbox.markSent(row.id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        await MailOutbox.markFailed(row.id, msg);
      }
    }
  }
}
