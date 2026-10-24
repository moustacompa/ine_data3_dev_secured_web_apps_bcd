-- =============================================================================
-- [FUSION P1/P4] DONNÉES DE DÉMONSTRATION (soutenance P4)
-- =============================================================================
-- En attendant l'inscription (P1) et l'import CSV (P2) :
--   - 3 comptes, mot de passe commun : Password123!
--       alice@example.com  (analyst)  propriétaire du dataset et des dashboards
--       bob@example.com    (analyst)  utilisateur invité lors de la démo de partage
--       admin@example.com  (admin)
--   - 1 dataset « Ventes 2026 (démo) » de 204 lignes, dont 4 montants aberrants
--     (pour le widget de détection des valeurs aberrantes).
--
-- Mots de passe hachés en bcrypt par pgcrypto (crypt + gen_salt('bf')) :
-- format $2a$ compatible avec la librairie bcrypt que P1 utilisera au login.
--
-- Relançable : les comptes et le dataset existants ne sont pas dupliqués.
-- NE PAS exécuter en production.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES
  ('alice@example.com', crypt('Password123!', gen_salt('bf', 10)), 'Alice', 'Durand', 'analyst'),
  ('bob@example.com',   crypt('Password123!', gen_salt('bf', 10)), 'Bob',   'Martin', 'analyst'),
  ('admin@example.com', crypt('Password123!', gen_salt('bf', 10)), 'Admin', 'Plateforme', 'admin')
ON CONFLICT (email) DO NOTHING;

DO $$
DECLARE
  v_owner UUID;
  v_ds    INTEGER;
BEGIN
  SELECT id INTO v_owner FROM users WHERE email = 'alice@example.com';

  IF NOT EXISTS (SELECT 1 FROM datasets WHERE user_id = v_owner AND title = 'Ventes 2026 (démo)') THEN
    INSERT INTO datasets (user_id, title) VALUES (v_owner, 'Ventes 2026 (démo)') RETURNING id INTO v_ds;

    -- 200 ventes « normales » (valeurs déterministes, montants entre ~80 et ~170)
    INSERT INTO dataset_rows (dataset_id, data)
    SELECT v_ds, jsonb_build_object(
             'date',     to_char(DATE '2026-01-01' + (g * 7 % 270), 'YYYY-MM-DD'),
             'region',   (ARRAY['Nord', 'Sud', 'Est', 'Ouest'])[1 + g % 4],
             'produit',  (ARRAY['Ordinateur', 'Écran', 'Clavier'])[1 + (g / 4) % 3],
             'quantite', 1 + (g * 7) % 9,
             'montant',  round((80 + (g * 37) % 60 + (g % 4) * 10 + (g % 7) * 0.35)::numeric, 2))
      FROM generate_series(1, 200) AS g;

    -- 4 valeurs aberrantes
    INSERT INTO dataset_rows (dataset_id, data) VALUES
      (v_ds, '{"date":"2026-03-14","region":"Nord","produit":"Ordinateur","quantite":40,"montant":9800}'),
      (v_ds, '{"date":"2026-05-02","region":"Sud","produit":"Écran","quantite":25,"montant":4200}'),
      (v_ds, '{"date":"2026-07-21","region":"Est","produit":"Clavier","quantite":1,"montant":2}'),
      (v_ds, '{"date":"2026-09-09","region":"Ouest","produit":"Ordinateur","quantite":30,"montant":6150}');
  END IF;

  -- Analyses d'Alice (la page Analyse de P3 n'existe pas encore) : briques des dashboards de démo
  SELECT id INTO v_ds FROM datasets WHERE user_id = v_owner AND title = 'Ventes 2026 (démo)';
  IF NOT EXISTS (SELECT 1 FROM analyses WHERE owner_id = v_owner AND dataset_id = v_ds) THEN
    INSERT INTO analyses (owner_id, dataset_id, title, description, config) VALUES
      (v_owner, v_ds, 'CA par région', 'Somme des montants par région',
       '{"query":{"metrics":[{"op":"sum","field":"montant","alias":"ca"}],"groupBy":["region"],"orderBy":{"field":"ca","dir":"desc"}},
         "chart":{"type":"bar","x":"region","y":["ca"]}}'),
      (v_owner, v_ds, 'CA mensuel', 'Évolution du chiffre d''affaires',
       '{"query":{"metrics":[{"op":"sum","field":"montant","alias":"ca"}],"timeBucket":{"field":"date","granularity":"month","alias":"mois"}},
         "chart":{"type":"line","x":"mois","y":["ca"]}}'),
      (v_owner, v_ds, 'Ventes par produit', 'Nombre de ventes par produit',
       '{"query":{"metrics":[{"op":"count","alias":"ventes"}],"groupBy":["produit"]},
         "chart":{"type":"pie","x":"produit","y":["ventes"]}}'),
      (v_owner, v_ds, 'Chiffre d''affaires total', NULL,
       '{"query":{"metrics":[{"op":"sum","field":"montant","alias":"total"}]},
         "chart":{"type":"kpi","y":["total"]}}');
  END IF;
END $$;
