-- Migration 004: 登録アンケート→投票アンケート 1対N化
-- 本番リセットOK前提だが、既存環境向けに idempotent 移行 SQL を提供

-- 1. 旧 linked_voting_survey_id を廃止
DROP INDEX IF EXISTS idx_surveys_linked;
ALTER TABLE surveys DROP COLUMN IF EXISTS linked_voting_survey_id;

-- 2. junction table 新設
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

-- 3. voters に registration_survey_id 追加
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='voters' AND column_name='registration_survey_id') THEN
        ALTER TABLE voters ADD COLUMN registration_survey_id INTEGER REFERENCES surveys(id) ON DELETE SET NULL;
    END IF;
END
$$;
CREATE INDEX IF NOT EXISTS idx_voters_reg ON voters(registration_survey_id);

-- 4. mail_outbox 新設
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
