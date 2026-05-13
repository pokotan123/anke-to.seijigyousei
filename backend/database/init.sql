-- データベース初期化スクリプト
-- このファイルはDockerコンテナ起動時に自動実行されます

-- 拡張機能の有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 管理者テーブル
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
);

CREATE INDEX idx_admins_username ON admins(username);
CREATE INDEX idx_admins_email ON admins(email);

-- アンケートテーブル
CREATE TABLE IF NOT EXISTS surveys (
    id SERIAL PRIMARY KEY,
    unique_token VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES admins(id) ON DELETE RESTRICT
);

CREATE INDEX idx_surveys_unique_token ON surveys(unique_token);
CREATE INDEX idx_surveys_status ON surveys(status);
CREATE INDEX idx_surveys_start_date ON surveys(start_date);
CREATE INDEX idx_surveys_end_date ON surveys(end_date);
CREATE INDEX idx_surveys_created_by ON surveys(created_by);

-- 質問テーブル
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) NOT NULL CHECK (question_type IN ('single_choice', 'multiple_choice', 'text', 'email')),
    "order" INTEGER NOT NULL DEFAULT 0,
    is_required BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_questions_survey_id ON questions(survey_id);
CREATE INDEX idx_questions_order ON questions("order");

-- 選択肢テーブル
CREATE TABLE IF NOT EXISTS options (
    id SERIAL PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    option_text VARCHAR(500) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_options_question_id ON options(question_id);
CREATE INDEX idx_options_order ON options("order");

-- 投票テーブル
CREATE TABLE IF NOT EXISTS votes (
    id SERIAL PRIMARY KEY,
    survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    option_id INTEGER REFERENCES options(id) ON DELETE CASCADE,
    answer_text TEXT,
    session_id VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_votes_survey_id ON votes(survey_id);
CREATE INDEX idx_votes_question_id ON votes(question_id);
CREATE INDEX idx_votes_option_id ON votes(option_id);
CREATE INDEX idx_votes_session_id ON votes(session_id);
CREATE INDEX idx_votes_ip_address ON votes(ip_address);
CREATE INDEX idx_votes_voted_at ON votes(voted_at);

-- 複合インデックス（集計クエリ高速化）
CREATE INDEX idx_votes_survey_question_option ON votes(survey_id, question_id, option_id);
CREATE INDEX idx_votes_survey_session ON votes(survey_id, session_id);

-- 更新日時を自動更新する関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 更新日時自動更新のトリガー
CREATE TRIGGER update_admins_updated_at BEFORE UPDATE ON admins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_surveys_updated_at BEFORE UPDATE ON surveys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 初期管理者アカウント（パスワード: admin123）
-- 本番環境では必ず変更してください
INSERT INTO admins (username, password_hash, email, role)
VALUES ('admin', '$2b$10$rOzJqZqZqZqZqZqZqZqZqOZqZqZqZqZqZqZqZqZqZqZqZqZqZqZq', 'admin@example.com', 'admin')
ON CONFLICT (username) DO NOTHING;

-- ==============================
-- メール認証投票機能 追加テーブル
-- ==============================

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

-- 1対N モデル: junction table survey_voting_links
-- （旧 linked_voting_survey_id は廃止。本番リセットOK前提でスキーマ刷新）
CREATE TABLE IF NOT EXISTS survey_voting_links (
    registration_survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    voting_survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (registration_survey_id, voting_survey_id),
    CHECK (registration_survey_id <> voting_survey_id)
);
CREATE INDEX IF NOT EXISTS idx_svl_reg ON survey_voting_links(registration_survey_id);
CREATE INDEX IF NOT EXISTS idx_svl_vote ON survey_voting_links(voting_survey_id);

-- voters に registration_survey_id 追加（登録元の追跡）
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='voters' AND column_name='registration_survey_id') THEN
        ALTER TABLE voters ADD COLUMN registration_survey_id INTEGER REFERENCES surveys(id) ON DELETE SET NULL;
    END IF;
END
$$;
CREATE INDEX IF NOT EXISTS idx_voters_reg ON voters(registration_survey_id);

-- メール送信 outbox（冪等性キー・再試行管理）
CREATE TABLE IF NOT EXISTS mail_outbox (
    id SERIAL PRIMARY KEY,
    idempotency_key VARCHAR(160) UNIQUE NOT NULL,
    mail_type VARCHAR(40) NOT NULL,
    to_email VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','dead')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    last_attempt_at TIMESTAMP,
    next_attempt_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,
    failed_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_mail_outbox_status ON mail_outbox(status);
CREATE INDEX IF NOT EXISTS idx_mail_outbox_next_attempt ON mail_outbox(next_attempt_at) WHERE status IN ('pending','failed');

-- Two-Survey Model: votes.voter_token
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='votes' AND column_name='voter_token') THEN
        ALTER TABLE votes ADD COLUMN voter_token VARCHAR(64);
    END IF;
END
$$;
CREATE INDEX IF NOT EXISTS idx_votes_voter_token ON votes(voter_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_unique_voter_question
  ON votes(voter_token, question_id)
  WHERE voter_token IS NOT NULL;

-- カスタムメールテンプレート
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='surveys' AND column_name='vote_mail_body') THEN
        ALTER TABLE surveys ADD COLUMN vote_mail_body TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='surveys' AND column_name='reminder_mail_body') THEN
        ALTER TABLE surveys ADD COLUMN reminder_mail_body TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='surveys' AND column_name='registration_mail_body') THEN
        ALTER TABLE surveys ADD COLUMN registration_mail_body TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='surveys' AND column_name='registration_start_date') THEN
        ALTER TABLE surveys ADD COLUMN registration_start_date TIMESTAMP;
    END IF;
END
$$;
