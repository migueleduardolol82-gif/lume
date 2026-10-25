BEGIN;
CREATE TABLE IF NOT EXISTS message_references(message_id text PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,references_data jsonb NOT NULL DEFAULT '[]');
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='references_data') THEN
  EXECUTE 'INSERT INTO message_references(message_id,references_data) SELECT id,references_data FROM messages WHERE references_data <> ''[]''::jsonb ON CONFLICT(message_id) DO NOTHING';
  ALTER TABLE messages DROP COLUMN references_data;
 END IF;
END $$;
COMMIT;
