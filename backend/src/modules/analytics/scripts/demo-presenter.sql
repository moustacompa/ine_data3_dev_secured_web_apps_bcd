-- =============================================================================
-- [P3] Compte de présentation local « Hafsa Benabou » (base de DÉVELOPPEMENT)
-- =============================================================================
-- Ajoute un compte analyste et lui donne sa propre copie du dataset de démo
-- « Ventes 2026 (démo) ». Script additif et idempotent :
--   - ne modifie aucun compte existant (Alice, Bob, Admin restent inchangés) ;
--   - ne crée aucune table ; ne modifie que sa propre copie (métadonnées P2 vides) ;
--   - relancé, il ne fait rien de plus.
-- Prérequis : schema.sql, 020 (schéma P2), 040 et 050_demo_seed.sql déjà appliqués (pgcrypto).
--
-- Exécution (conteneur Docker de développement) :
--   docker exec -i dev_postgres_db psql -U dev_user -d platform_db \
--     < backend/src/modules/analytics/scripts/demo-presenter.sql
-- Connexion : hafsa.benabou@example.com / Password123!
-- Retour arrière : DELETE FROM users WHERE email = 'hafsa.benabou@example.com';
--   (la copie du dataset et les analyses du compte sont supprimées en cascade)
--
-- NE PAS exécuter sur une base de production.
-- =============================================================================

INSERT INTO users (email, password_hash, first_name, last_name, role)
VALUES ('hafsa.benabou@example.com', crypt('Password123!', gen_salt('bf', 10)), 'Hafsa', 'Benabou', 'analyst')
ON CONFLICT (email) DO NOTHING;

DO $$
DECLARE
  v_user UUID;
  v_source INTEGER;
  v_copy INTEGER;
BEGIN
  SELECT id INTO v_user FROM users WHERE email = 'hafsa.benabou@example.com';
  SELECT d.id INTO v_source FROM datasets d JOIN users u ON u.id = d.user_id
   WHERE u.email = 'alice@example.com' AND d.title = 'Ventes 2026 (démo)' LIMIT 1;

  IF v_source IS NULL THEN
    RAISE NOTICE 'Dataset de démo introuvable : appliquez d''abord 050_demo_seed.sql.';
  ELSIF NOT EXISTS (SELECT 1 FROM datasets WHERE user_id = v_user AND title = 'Ventes 2026 (démo)') THEN
    INSERT INTO datasets (user_id, title) VALUES (v_user, 'Ventes 2026 (démo)') RETURNING id INTO v_copy;
    INSERT INTO dataset_rows (dataset_id, data) SELECT v_copy, data FROM dataset_rows WHERE dataset_id = v_source ORDER BY id;
  END IF;

  -- Métadonnées P2 (schéma 020 livré par P2) : la copie reprend celles du dataset source
  IF v_source IS NOT NULL AND EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'datasets' AND column_name = 'columns'
  ) THEN
    UPDATE datasets c SET
      description = s.description, category = s.category, source = s.source, file_format = s.file_format,
      row_count = (SELECT COUNT(*) FROM dataset_rows r WHERE r.dataset_id = c.id),
      column_count = s.column_count, columns = s.columns, profile = s.profile
    FROM datasets s
    WHERE s.id = v_source AND c.user_id = v_user AND c.title = 'Ventes 2026 (démo)' AND c.columns = '[]'::jsonb;
  END IF;
END $$;
