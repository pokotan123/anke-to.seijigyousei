-- Two-Survey Model Migration
-- surveys テーブルに linked_voting_survey_id カラム追加
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='surveys' AND column_name='linked_voting_survey_id') THEN
        ALTER TABLE surveys ADD COLUMN linked_voting_survey_id INTEGER REFERENCES surveys(id) ON DELETE SET NULL;
    END IF;
END
$$;
CREATE INDEX IF NOT EXISTS idx_surveys_linked ON surveys(linked_voting_survey_id);

-- votes テーブルに voter_token カラム追加
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='votes' AND column_name='voter_token') THEN
        ALTER TABLE votes ADD COLUMN voter_token VARCHAR(64);
    END IF;
END
$$;
CREATE INDEX IF NOT EXISTS idx_votes_voter_token ON votes(voter_token);

-- 部分ユニークインデックス（同一voter_tokenで同一質問に2回投票不可）
-- DROP first to make idempotent
DROP INDEX IF EXISTS idx_votes_unique_voter_question;
CREATE UNIQUE INDEX idx_votes_unique_voter_question
  ON votes(voter_token, question_id)
  WHERE voter_token IS NOT NULL;

-- questions テーブルの question_type チェック制約を更新（'email' 追加）
-- 既存の CHECK 制約を削除して再作成
DO $$
BEGIN
    -- 既存の制約を探して削除
    IF EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_name = 'questions' AND column_name = 'question_type'
    ) THEN
        EXECUTE (
            SELECT 'ALTER TABLE questions DROP CONSTRAINT ' || constraint_name
            FROM information_schema.constraint_column_usage
            WHERE table_name = 'questions' AND column_name = 'question_type'
            LIMIT 1
        );
    END IF;
    -- 新しい制約を追加
    ALTER TABLE questions ADD CONSTRAINT questions_question_type_check
        CHECK (question_type IN ('single_choice', 'multiple_choice', 'text', 'email'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;
