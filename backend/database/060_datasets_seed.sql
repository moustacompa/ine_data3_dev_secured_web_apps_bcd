-- Datasets de démonstration P2/P3. Exécuter après 050_demo_seed.sql.
-- Compte propriétaire : alice@example.com (mot de passe démo Password123!).
DO $$
DECLARE v_owner UUID; v_id INTEGER;
BEGIN
  SELECT id INTO v_owner FROM users WHERE email = 'alice@example.com';
  IF v_owner IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM datasets WHERE user_id = v_owner AND title = 'Qualité des données (démo)') THEN
    INSERT INTO datasets (user_id, title, description, category, source, original_filename, file_format, row_count, column_count, columns, profile)
    VALUES (v_owner, 'Qualité des données (démo)', 'Petit jeu avec valeurs manquantes pour illustrer le profilage P2.', 'Environnement', 'Seed pédagogique', 'qualite_demo.csv', 'csv', 12, 5,
      '[{"name":"date","type":"date"},{"name":"ville","type":"text"},{"name":"temperature","type":"number"},{"name":"humidite","type":"integer"},{"name":"alerte","type":"boolean"}]'::jsonb,
      '{"rowCount":12,"columnCount":5,"missingCells":8,"missingPercent":13.33,"qualityScore":86.67,"columns":[{"name":"date","type":"date","missing":0,"missingPercent":0,"unique":12},{"name":"ville","type":"text","missing":2,"missingPercent":16.67,"unique":5},{"name":"temperature","type":"number","missing":3,"missingPercent":25,"unique":8,"min":17.8,"max":25.1,"mean":21.05},{"name":"humidite","type":"integer","missing":3,"missingPercent":25,"unique":9,"min":33,"max":62,"mean":48.33},{"name":"alerte","type":"boolean","missing":0,"missingPercent":0,"unique":2}]}'::jsonb)
    RETURNING id INTO v_id;
    INSERT INTO dataset_rows (dataset_id, data) VALUES
      (v_id, '{"date":"2026-01-01","ville":"Rabat","temperature":18.4,"humidite":62,"alerte":false}'),
      (v_id, '{"date":"2026-01-02","ville":"Casablanca","temperature":19.1,"humidite":58,"alerte":false}'),
      (v_id, '{"date":"2026-01-03","ville":"Fès","temperature":null,"humidite":55,"alerte":false}'),
      (v_id, '{"date":"2026-01-04","ville":"Tanger","temperature":17.8,"humidite":null,"alerte":false}'),
      (v_id, '{"date":"2026-01-05","ville":"Marrakech","temperature":22.6,"humidite":38,"alerte":false}'),
      (v_id, '{"date":"2026-01-06","ville":"Rabat","temperature":23.2,"humidite":41,"alerte":true}'),
      (v_id, '{"date":"2026-01-07","ville":"Casablanca","temperature":null,"humidite":null,"alerte":true}'),
      (v_id, '{"date":"2026-01-08","ville":"Fès","temperature":21.4,"humidite":49,"alerte":false}'),
      (v_id, '{"date":"2026-01-09","ville":null,"temperature":20.8,"humidite":52,"alerte":false}'),
      (v_id, '{"date":"2026-01-10","ville":"Tanger","temperature":19.7,"humidite":null,"alerte":false}'),
      (v_id, '{"date":"2026-01-11","ville":"Marrakech","temperature":25.1,"humidite":33,"alerte":true}'),
      (v_id, '{"date":"2026-01-12","ville":null,"temperature":null,"humidite":47,"alerte":false}');
  END IF;
END $$;
