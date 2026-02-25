-- Migration: メール認証投票機能
-- Date: 2026-02-25

-- 投票者テーブル
CREATE TABLE IF NOT EXISTS voters (
    id SERIAL PRIMARY KEY,
    survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    voter_token VARCHAR(64) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'registered'
        CHECK (status IN ('registered', 'sent', 'voted', 'expired')),
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    link_sent_at TIMESTAMP,
    voted_at TIMESTAMP,
    reminder_sent_at TIMESTAMP,
    ip_address VARCHAR(45),
    UNIQUE(survey_id, email)
);

CREATE INDEX IF NOT EXISTS idx_voters_survey_id ON voters(survey_id);
CREATE INDEX IF NOT EXISTS idx_voters_email ON voters(email);
CREATE INDEX IF NOT EXISTS idx_voters_voter_token ON voters(voter_token);
CREATE INDEX IF NOT EXISTS idx_voters_status ON voters(status);

-- surveysテーブルにメール認証関連カラム追加
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='surveys' AND column_name='require_registration') THEN
        ALTER TABLE surveys ADD COLUMN require_registration BOOLEAN NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='surveys' AND column_name='registration_message') THEN
        ALTER TABLE surveys ADD COLUMN registration_message TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='surveys' AND column_name='registration_deadline') THEN
        ALTER TABLE surveys ADD COLUMN registration_deadline TIMESTAMP;
    END IF;
END
$$;

-- カスタム登録項目サポート
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='surveys' AND column_name='registration_fields') THEN
        ALTER TABLE surveys ADD COLUMN registration_fields JSONB DEFAULT '[]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='voters' AND column_name='registration_data') THEN
        ALTER TABLE voters ADD COLUMN registration_data JSONB DEFAULT '{}';
    END IF;
END
$$;
