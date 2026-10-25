BEGIN;
ALTER TABLE decks ADD COLUMN IF NOT EXISTS parent_id text REFERENCES decks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS decks_owner_parent ON decks(owner,parent_id);
COMMIT;
