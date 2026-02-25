import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const MAIL_FROM = process.env.MAIL_FROM || 'noreply@example.com';
const rawFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const FRONTEND_URL = rawFrontendUrl.includes(',')
  ? rawFrontendUrl.split(',').pop()!.trim()
  : rawFrontendUrl;

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
}
