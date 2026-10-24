-- =====================================================================
-- P4 — Dashboards & Partage : tables analyses, dashboards et partages
-- Prérequis : tables users (P1) et datasets (P2) déjà créées.
-- Si P2 utilise des UUID pour datasets.id, remplacer INTEGER par UUID
-- dans analyses.dataset_id (et idem pour users.id côté P1).
-- =====================================================================

CREATE TABLE IF NOT EXISTS analyses (
  id           SERIAL PRIMARY KEY,
  owner_id     INTEGER      NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  dataset_id   INTEGER      NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  title        VARCHAR(150) NOT NULL,
  description  TEXT,
  -- { "query": {metrics, groupBy, timeBucket, filters, orderBy, limit},
  --   "chart": {type, x, y, options} }
  config       JSONB        NOT NULL DEFAULT '{}'::jsonb,
  visibility   VARCHAR(10)  NOT NULL DEFAULT 'private'
               CHECK (visibility IN ('private', 'shared')),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analyses_owner   ON analyses(owner_id);
CREATE INDEX IF NOT EXISTS idx_analyses_dataset ON analyses(dataset_id);

CREATE TABLE IF NOT EXISTS analysis_shares (
  analysis_id INTEGER     NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  user_id     INTEGER     NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (analysis_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_analysis_shares_user ON analysis_shares(user_id);

CREATE TABLE IF NOT EXISTS dashboards (
  id             SERIAL PRIMARY KEY,
  owner_id       INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          VARCHAR(150) NOT NULL,
  description    TEXT,
  -- [{ id, type: 'analysis'|'outliers', analysisId?, datasetId?, column?,
  --    method?, threshold?, title?, w: 1..4, h: 1..3 }]
  layout         JSONB        NOT NULL DEFAULT '[]'::jsonb,
  -- [{ id, label, field, type: 'select'|'range'|'date-range', datasetIds? }]
  global_filters JSONB        NOT NULL DEFAULT '[]'::jsonb,
  visibility     VARCHAR(10)  NOT NULL DEFAULT 'private'
                 CHECK (visibility IN ('private', 'shared', 'public')),
  public_token   VARCHAR(64)  UNIQUE,
  published_at   TIMESTAMPTZ,
  view_count     INTEGER      NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  -- un jeton public existe si et seulement si le dashboard est public
  CONSTRAINT dashboards_public_token_coherent
    CHECK ((visibility = 'public') = (public_token IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_dashboards_owner ON dashboards(owner_id);

CREATE TABLE IF NOT EXISTS dashboard_shares (
  dashboard_id INTEGER     NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  user_id      INTEGER     NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (dashboard_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_dashboard_shares_user ON dashboard_shares(user_id);

-- updated_at automatique
CREATE OR REPLACE FUNCTION p4_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_analyses_updated_at ON analyses;
CREATE TRIGGER trg_analyses_updated_at BEFORE UPDATE ON analyses
  FOR EACH ROW EXECUTE FUNCTION p4_touch_updated_at();

DROP TRIGGER IF EXISTS trg_dashboards_updated_at ON dashboards;
CREATE TRIGGER trg_dashboards_updated_at BEFORE UPDATE ON dashboards
  FOR EACH ROW WHEN (OLD.view_count IS NOT DISTINCT FROM NEW.view_count)
  EXECUTE FUNCTION p4_touch_updated_at();
