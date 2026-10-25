BEGIN;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS materials(id text PRIMARY KEY,owner text NOT NULL,deck_id text NOT NULL REFERENCES decks(id) ON DELETE CASCADE,title text NOT NULL,content text NOT NULL DEFAULT '',revision integer NOT NULL DEFAULT 0,created bigint NOT NULL,updated bigint NOT NULL);
CREATE TABLE IF NOT EXISTS material_versions(material_id text NOT NULL REFERENCES materials(id) ON DELETE CASCADE,revision integer NOT NULL,title text NOT NULL,content text NOT NULL,created bigint NOT NULL,PRIMARY KEY(material_id,revision));
CREATE INDEX IF NOT EXISTS materials_owner_deck ON materials(owner,deck_id,updated DESC);
CREATE TABLE IF NOT EXISTS material_files(id text PRIMARY KEY,owner text NOT NULL,deck_id text NOT NULL REFERENCES decks(id) ON DELETE CASCADE,name text NOT NULL,type text NOT NULL,bytes integer NOT NULL,status text NOT NULL DEFAULT 'uploading',sha256 text,created bigint NOT NULL);
CREATE TABLE IF NOT EXISTS material_file_chunks(file_id text NOT NULL REFERENCES material_files(id) ON DELETE CASCADE,part integer NOT NULL,bytes integer NOT NULL,sha256 text NOT NULL,data bytea NOT NULL,PRIMARY KEY(file_id,part));
CREATE INDEX IF NOT EXISTS material_files_owner_deck ON material_files(owner,deck_id,created DESC);
COMMIT;
