// Génère le dossier Postman « Dashboards » (P4). Lancer : node build-collection.js
const fs = require('fs');
const path = require('path');

const json = (body) => ({ mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } });
const url = (p) => ({ raw: `{{baseUrl}}${p}`, host: ['{{baseUrl}}'], path: p.split('?')[0].split('/').filter(Boolean),
  ...(p.includes('?') ? { query: p.split('?')[1].split('&').map((kv) => { const [key, value] = kv.split('='); return { key, value }; }) } : {}) });
const tests = (...lines) => [{ listen: 'test', script: { type: 'text/javascript', exec: lines } }];
const status = (code) => `pm.test('Statut ${code}', () => pm.response.to.have.status(${code}));`;
const req = (name, method, p, { body, desc, test = [], noauth = false } = {}) => ({
  name,
  event: tests(...test),
  request: { method, header: body ? [{ key: 'Content-Type', value: 'application/json' }] : [], url: url(p),
    ...(body ? { body: json(body) } : {}), ...(desc ? { description: desc } : {}), ...(noauth ? { auth: { type: 'noauth' } } : {}) },
});

const analyses = {
  name: 'Analyses',
  item: [
    req('Créer une analyse (CA par région)', 'POST', '/analyses', {
      desc: 'Enregistre une analyse. `config.query` suit le contrat du moteur de requêtes (P3), `config.chart` le type de graphique.',
      body: { title: 'CA par région', description: 'Somme des montants par région', datasetId: '{{datasetId}}',
        config: { query: { metrics: [{ op: 'sum', field: 'montant', alias: 'ca' }, { op: 'count' }], groupBy: ['region'], orderBy: { field: 'ca', dir: 'desc' }, limit: 20 },
          chart: { type: 'bar', x: 'region', y: ['ca'] } } },
      test: [status(201), "pm.collectionVariables.set('analysisId', pm.response.json().id);"] }),
    req('Créer une analyse (série temporelle)', 'POST', '/analyses', {
      body: { title: 'CA mensuel', datasetId: '{{datasetId}}',
        config: { query: { metrics: [{ op: 'sum', field: 'montant', alias: 'ca' }], timeBucket: { field: 'date', granularity: 'month', alias: 'mois' } },
          chart: { type: 'line', x: 'mois', y: ['ca'] } } },
      test: [status(201), "pm.collectionVariables.set('analysisId2', pm.response.json().id);"] }),
    req('Créer une analyse invalide (400)', 'POST', '/analyses', {
      body: { title: '', datasetId: 'abc', config: { query: { metrics: [{ op: 'sum' }] } } },
      test: [status(400), "pm.test('Erreurs détaillées', () => pm.expect(pm.response.json().details.length).to.be.above(0));"] }),
    req('Lister mes analyses', 'GET', '/analyses?scope=mine&q=&limit=20', { test: [status(200)] }),
    req('Lister les analyses partagées avec moi', 'GET', '/analyses?scope=shared', { test: [status(200)] }),
    req('Détail d’une analyse', 'GET', '/analyses/{{analysisId}}', { test: [status(200)] }),
    req('Modifier une analyse', 'PUT', '/analyses/{{analysisId}}', { body: { title: 'CA par région (2024)' }, test: [status(200)] }),
    req('Exécuter une analyse', 'POST', '/analyses/{{analysisId}}/run', {
      body: { filters: [{ field: 'region', op: 'in', value: ['Nord', 'Sud'] }] },
      test: [status(200), "pm.test('Lignes renvoyées', () => pm.expect(pm.response.json().rows).to.be.an('array'));"] }),
  ],
};

const dashboards = {
  name: 'Dashboards',
  item: [
    req('Créer un dashboard', 'POST', '/dashboards', {
      body: { title: 'Pilotage ventes', description: 'CA par région et par mois',
        layout: [
          { id: 'w1', type: 'analysis', analysisId: '{{analysisId}}', w: 2, h: 2 },
          { id: 'w2', type: 'analysis', analysisId: '{{analysisId2}}', w: 2, h: 2 },
          { id: 'w3', type: 'outliers', datasetId: '{{datasetId}}', column: 'montant', method: 'iqr', w: 4, h: 3 }],
        globalFilters: [
          { id: 'reg', label: 'Région', field: 'region', type: 'select' },
          { id: 'per', label: 'Période', field: 'date', type: 'date-range' }] },
      test: [status(201), "pm.collectionVariables.set('dashboardId', pm.response.json().id);"] }),
    req('Lister mes dashboards', 'GET', '/dashboards?scope=mine', { test: [status(200)] }),
    req('Lister les dashboards partagés avec moi', 'GET', '/dashboards?scope=shared', { test: [status(200)] }),
    req('Détail d’un dashboard', 'GET', '/dashboards/{{dashboardId}}', { test: [status(200)] }),
    req('Modifier la mise en page', 'PUT', '/dashboards/{{dashboardId}}', {
      body: { layout: [{ id: 'w1', type: 'analysis', analysisId: '{{analysisId}}', w: 4, h: 1 }, { id: 'w2', type: 'analysis', analysisId: '{{analysisId2}}', w: 2, h: 2 }, { id: 'w3', type: 'outliers', datasetId: '{{datasetId}}', column: 'montant', w: 2, h: 3 }] },
      test: [status(200)] }),
    req('Calculer le dashboard (sans filtre)', 'POST', '/dashboards/{{dashboardId}}/render', {
      body: { filters: {} },
      test: [status(200), "pm.test('Tous les widgets calculés', () => pm.response.json().widgets.forEach((w) => pm.expect(w.status).to.eql('ok')));"] }),
    req('Calculer le dashboard (filtres globaux)', 'POST', '/dashboards/{{dashboardId}}/render', {
      desc: 'Les valeurs sont indexées par identifiant de filtre global : select → liste, date-range → {from, to}, range → {min, max}.',
      body: { filters: { reg: ['Nord'], per: { from: '2024-01-01', to: '2024-06-30' } } }, test: [status(200)] }),
    req('Valeurs d’un filtre « select »', 'GET', '/dashboards/{{dashboardId}}/filters/reg/options', { test: [status(200)] }),
  ],
};

const sharing = {
  name: 'Partage et publication',
  item: [
    req('Partager l’analyse par e-mail', 'POST', '/analyses/{{analysisId}}/shares', { body: { email: '{{shareEmail}}' },
      test: [status(201), "const s = pm.response.json().shares; if (s.length) pm.collectionVariables.set('shareUserId', s[0].id);"] }),
    req('Lister les partages de l’analyse', 'GET', '/analyses/{{analysisId}}/shares', { test: [status(200)] }),
    req('Partager le dashboard par e-mail', 'POST', '/dashboards/{{dashboardId}}/shares', { body: { email: '{{shareEmail}}' }, test: [status(201)] }),
    req('Partager avec un e-mail inconnu (404)', 'POST', '/dashboards/{{dashboardId}}/shares', { body: { email: 'personne@inconnu.test' }, test: [status(404)] }),
    req('Rendre le dashboard public', 'PUT', '/dashboards/{{dashboardId}}', { body: { visibility: 'public' },
      test: [status(200), "pm.collectionVariables.set('publicToken', pm.response.json().publicToken);", "pm.test('Jeton généré', () => pm.expect(pm.response.json().publicToken).to.be.a('string'));"] }),
    req('Retirer le partage de l’analyse', 'DELETE', '/analyses/{{analysisId}}/shares/{{shareUserId}}', { test: [status(200)] }),
  ],
};

const pub = {
  name: 'Vue publique (sans authentification)',
  item: [
    req('Dashboard public', 'GET', '/public/dashboards/{{publicToken}}', { noauth: true,
      test: [status(200), "pm.test('Aucune donnée personnelle', () => { const j = pm.response.json(); pm.expect(j.owner).to.be.undefined; pm.expect(j.publicToken).to.be.undefined; });"] }),
    req('Calculer le dashboard public', 'POST', '/public/dashboards/{{publicToken}}/render', { noauth: true, body: { filters: { reg: ['Sud'] } }, test: [status(200)] }),
    req('Valeurs d’un filtre (public)', 'GET', '/public/dashboards/{{publicToken}}/filters/reg/options', { noauth: true, test: [status(200)] }),
    req('Régénérer le lien public', 'POST', '/dashboards/{{dashboardId}}/public-token', {
      test: [status(200), "pm.collectionVariables.set('oldPublicToken', pm.collectionVariables.get('publicToken'));", "pm.collectionVariables.set('publicToken', pm.response.json().publicToken);"] }),
    req('Ancien lien révoqué (404)', 'GET', '/public/dashboards/{{oldPublicToken}}', { noauth: true, test: [status(404)] }),
    req('Repasser le dashboard en privé', 'PUT', '/dashboards/{{dashboardId}}', { body: { visibility: 'private' },
      test: [status(200), "pm.test('Jeton supprimé', () => pm.expect(pm.response.json().publicToken).to.be.null);"] }),
    req('Lien après passage en privé (404)', 'GET', '/public/dashboards/{{publicToken}}', { noauth: true, test: [status(404)] }),
  ],
};

const outliers = {
  name: 'Valeurs aberrantes (fonctionnalité avancée)',
  item: [
    req('Méthodes disponibles', 'GET', '/outliers/methods', { test: [status(200)] }),
    req('Datasets accessibles', 'GET', '/outliers/datasets', { test: [status(200)] }),
    req('Colonnes d’un dataset', 'GET', '/outliers/datasets/{{datasetId}}/columns', { test: [status(200)] }),
    req('Détecter (IQR)', 'POST', '/outliers', { body: { datasetId: '{{datasetId}}', column: 'montant', method: 'iqr' },
      test: [status(200), "pm.test('Résultat complet', () => { const j = pm.response.json(); pm.expect(j).to.have.keys('datasetId','column','method','methodLabel','threshold','n','outlierCount','outlierRate','stats','bounds','outliers','truncated','bins','overflow','warning'); });"] }),
    req('Détecter (MAD, seuil 3)', 'POST', '/outliers', { body: { datasetId: '{{datasetId}}', column: 'montant', method: 'mad', threshold: 3 }, test: [status(200)] }),
    req('Détecter avec filtre', 'POST', '/outliers', { body: { datasetId: '{{datasetId}}', column: 'montant', method: 'zscore', filters: [{ field: 'region', op: 'eq', value: 'Nord' }] }, test: [status(200)] }),
  ],
};

const admin = {
  name: 'Administration',
  item: [
    req('Statistiques dashboards (admin)', 'GET', '/dashboards/stats', { desc: 'Nécessite un jeton administrateur ({{adminToken}}).', test: [status(200)] }),
    req('Tous les dashboards (admin)', 'GET', '/dashboards?scope=all', { test: [status(200)] }),
  ].map((r) => ({ ...r, request: { ...r.request, auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{adminToken}}', type: 'string' }] } } })),
};

const cleanup = {
  name: 'Nettoyage',
  item: [
    req('Supprimer le dashboard', 'DELETE', '/dashboards/{{dashboardId}}', { test: [status(204)] }),
    req('Supprimer les analyses', 'DELETE', '/analyses/{{analysisId}}', { test: [status(204)] }),
    req('Supprimer la 2e analyse', 'DELETE', '/analyses/{{analysisId2}}', { test: [status(204)] }),
    req('Dashboard supprimé (404)', 'GET', '/dashboards/{{dashboardId}}', { test: [status(404)] }),
  ],
};

const collection = {
  info: {
    name: 'Dashboards (P4)',
    description: 'Analyses sauvegardées, dashboards, partage, vue publique et détection des valeurs aberrantes. À exécuter dans l’ordre après le login (P1) qui renseigne {{token}}.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:4000/api' },
    { key: 'token', value: '' },
    { key: 'adminToken', value: '' },
    { key: 'datasetId', value: '1' },
    { key: 'shareEmail', value: 'bob@example.com' },
    ...['analysisId', 'analysisId2', 'dashboardId', 'publicToken', 'oldPublicToken', 'shareUserId'].map((key) => ({ key, value: '' })),
  ],
  item: [{ name: 'Dashboards', description: 'Dossier P4', item: [analyses, dashboards, sharing, pub, outliers, admin, cleanup] }],
};

const out = path.join(__dirname, 'dashboards.postman_collection.json');
fs.writeFileSync(out, `${JSON.stringify(collection, null, 2)}\n`);
console.log('Écrit :', out);
