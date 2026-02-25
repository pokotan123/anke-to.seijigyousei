-- Custom Email Templates Migration
-- surveys テーブルにカスタムメールテンプレート用カラムを追加

-- 投票リンクメール本文
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='surveys' AND column_name='vote_mail_body') THEN
        ALTER TABLE surveys ADD COLUMN vote_mail_body TEXT;
    END IF;
END
$$;

-- リマインダーメール本文
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='surveys' AND column_name='reminder_mail_body') THEN
        ALTER TABLE surveys ADD COLUMN reminder_mail_body TEXT;
    END IF;
END
$$;

-- 登録確認メール本文
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='surveys' AND column_name='registration_mail_body') THEN
        ALTER TABLE surveys ADD COLUMN registration_mail_body TEXT;
    END IF;
END
$$;
