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
    question_type VARCHAR(20) NOT NULL CHECK (question_type IN ('single_choice', 'multiple_choice', 'text')),
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

