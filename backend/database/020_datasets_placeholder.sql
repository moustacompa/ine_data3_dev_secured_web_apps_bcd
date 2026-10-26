-- =============================================================================
-- P2 : datasets et lignes. Les noms/types id/user_id/title/data sont le contrat utilisé par P4.
-- =============================================================================
-- P4 (040_dashboards.sql) a des clés étrangères vers datasets(id) et lit les
-- lignes dans dataset_rows. Tant que P2 n'a pas livré son schéma, ces tables
-- minimales permettent de créer la base et de tester P4.
--
-- À SUPPRIMER (ou remplacer par le script de P2) quand P2 livre son module.
-- Si P2 nomme ses colonnes autrement, régler les variables d'environnement
-- P4_DATASET_OWNER_COL, P4_DATASET_TITLE_COL et P4_ROWS_DATA_COL (voir deps.js).
-- =============================================================================

CREATE TABLE IF NOT EXISTS datasets (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- propriétaire (UUID de P1)
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(120),
    source VARCHAR(500),
    original_filename VARCHAR(255),
    file_format VARCHAR(12) NOT NULL DEFAULT 'csv',
    row_count INTEGER NOT NULL DEFAULT 0 CHECK (row_count >= 0),
    column_count INTEGER NOT NULL DEFAULT 0 CHECK (column_count >= 0),
    columns JSONB NOT NULL DEFAULT '[]'::jsonb,
    profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE datasets ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS category VARCHAR(120);
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS source VARCHAR(500);
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS original_filename VARCHAR(255);
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS file_format VARCHAR(12) NOT NULL DEFAULT 'csv';
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS row_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS column_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS columns JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS profile JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_datasets_user_id ON datasets(user_id);
CREATE INDEX IF NOT EXISTS idx_datasets_created_at ON datasets(created_at DESC);

-- Une ligne du fichier importé = un objet JSONB { "colonne": "valeur", ... }
CREATE TABLE IF NOT EXISTS dataset_rows (
    id BIGSERIAL PRIMARY KEY,
    dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    data JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dataset_rows_dataset_id ON dataset_rows(dataset_id);
