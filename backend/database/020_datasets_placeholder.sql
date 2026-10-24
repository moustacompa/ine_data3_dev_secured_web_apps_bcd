-- =============================================================================
-- [FUSION P1/P4] TABLES PROVISOIRES DU MODULE P2 (DATASETS)
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_datasets_user_id ON datasets(user_id);

-- Une ligne du fichier importé = un objet JSONB { "colonne": "valeur", ... }
CREATE TABLE IF NOT EXISTS dataset_rows (
    id BIGSERIAL PRIMARY KEY,
    dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    data JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dataset_rows_dataset_id ON dataset_rows(dataset_id);
