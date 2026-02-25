import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const MAIL_FROM = process.env.MAIL_FROM || 'noreply@example.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

interface SendVoteLinkParams {
  email: string;
  voterToken: string;
  surveyTitle: string;
  surveyDescription: string | null;
  endDate: Date | null;
}

interface SendReminderParams {
  email: string;
  voterToken: string;
  surveyTitle: string;
  endDate: Date | null;
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

export class MailService {
  static async sendVoteLink(params: SendVoteLinkParams): Promise<MailResult> {
    const voteUrl = buildVoteUrl(params.voterToken);
    const endDateStr = formatEndDate(params.endDate);
    const html = buildVoteLinkHtml(params, voteUrl, endDateStr);

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
    const html = buildReminderHtml(params, voteUrl, endDateStr);

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
}
