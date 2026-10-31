BEGIN;
CREATE TABLE IF NOT EXISTS learning_sessions (
 id text PRIMARY KEY, owner text NOT NULL, deck_id text NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('lesson','chat')), title text NOT NULL,
 payload jsonb NOT NULL, revision integer NOT NULL DEFAULT 0,
 created bigint NOT NULL, updated bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS learning_owner_updated ON learning_sessions(owner,updated DESC);
CREATE TABLE IF NOT EXISTS material_file_pages (
 file_id text NOT NULL REFERENCES material_files(id) ON DELETE CASCADE,
 page integer NOT NULL CHECK (page>0), content text NOT NULL, sha256 text NOT NULL,
 PRIMARY KEY(file_id,page)
);
COMMIT;
