CREATE TABLE IF NOT EXISTS decks (id text PRIMARY KEY, owner text NOT NULL, title text NOT NULL, description text NOT NULL DEFAULT '', color text NOT NULL DEFAULT 'violet', source text NOT NULL DEFAULT '', created bigint NOT NULL);
CREATE TABLE IF NOT EXISTS cards (id text PRIMARY KEY, owner text NOT NULL, deck_id text NOT NULL REFERENCES decks(id) ON DELETE CASCADE, front text NOT NULL, back text NOT NULL, due bigint NOT NULL, interval integer NOT NULL DEFAULT 0, repetitions integer NOT NULL DEFAULT 0, revision integer NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS reviews (id text PRIMARY KEY, owner text NOT NULL, card_id text NOT NULL, deck_id text NOT NULL REFERENCES decks(id) ON DELETE CASCADE, rating text NOT NULL, created bigint NOT NULL);
CREATE TABLE IF NOT EXISTS messages (id text PRIMARY KEY, owner text NOT NULL, deck_id text NOT NULL REFERENCES decks(id) ON DELETE CASCADE, role text NOT NULL, content text NOT NULL, created bigint NOT NULL);
CREATE INDEX IF NOT EXISTS decks_owner ON decks(owner,created DESC);
CREATE INDEX IF NOT EXISTS cards_owner_deck ON cards(owner,deck_id);
CREATE INDEX IF NOT EXISTS cards_owner_due ON cards(owner,due);
CREATE INDEX IF NOT EXISTS reviews_owner_created ON reviews(owner,created DESC);
CREATE INDEX IF NOT EXISTS messages_owner_deck_created ON messages(owner,deck_id,created);
