'use strict';

const analyses = require('./analyses.service');
const dashboards = require('./dashboards.service');
const shares = require('./shares.service');
const deps = require('./deps');
const { detectOutliers, METHODS } = require('./outliers');
const { httpError } = require('./errors');
const {
  parseId, validateAnalysis, validateDashboard, validateShareTarget, validateOutlierRequest,
} = require('./validate');
// [FUSION P1/P4] :userId est un UUID chez P1 : parseId (entiers uniquement) renvoyait 404
const { parseUserId } = require('./p1-compat');

const filterValuesFrom = (body) =>
  body && typeof body.filters === 'object' && !Array.isArray(body.filters) ? body.filters : {};

// ------------------------------- Analyses ------------------------------
const analysesCtrl = {
  list: async (req, res) => res.json(await analyses.list(req.user, req.query)),
  get: async (req, res) => res.json(await analyses.get(req.user, parseId(req.params.id))),
  create: async (req, res) => res.status(201).json(await analyses.create(req.user, validateAnalysis(req.body))),
  update: async (req, res) =>
    res.json(await analyses.update(req.user, parseId(req.params.id), validateAnalysis(req.body, { partial: true }))),
  remove: async (req, res) => { await analyses.remove(req.user, parseId(req.params.id)); res.status(204).end(); },
  run: async (req, res) => {
    const extra = Array.isArray(req.body?.filters) ? req.body.filters : [];
    res.json(await analyses.run(req.user, parseId(req.params.id), extra));
  },
  listShares: async (req, res) => {
    const row = await analyses.getEditable(req.user, parseId(req.params.id));
    res.json({ shares: await shares.listShares('analysis', row.id), visibility: row.visibility });
  },
  addShare: async (req, res) => {
    const target = validateShareTarget(req.body);
    const row = await analyses.getEditable(req.user, parseId(req.params.id));
    res.status(201).json(await shares.addShare('analysis', row, req.user, target));
  },
  removeShare: async (req, res) => {
    const row = await analyses.getEditable(req.user, parseId(req.params.id));
    res.json(await shares.removeShare('analysis', row, req.user, parseUserId(req.params.userId)));
  },
};

// ------------------------------ Dashboards -----------------------------
const dashboardsCtrl = {
  list: async (req, res) => res.json(await dashboards.list(req.user, req.query)),
  get: async (req, res) => res.json(await dashboards.get(req.user, parseId(req.params.id))),
  create: async (req, res) => res.status(201).json(await dashboards.create(req.user, validateDashboard(req.body))),
  update: async (req, res) =>
    res.json(await dashboards.update(req.user, parseId(req.params.id), validateDashboard(req.body, { partial: true }))),
  remove: async (req, res) => { await dashboards.remove(req.user, parseId(req.params.id)); res.status(204).end(); },
  render: async (req, res) => {
    const row = await dashboards.getReadable(req.user, parseId(req.params.id));
    res.json(await dashboards.render(row, filterValuesFrom(req.body)));
  },
  filterOptions: async (req, res) => {
    const row = await dashboards.getReadable(req.user, parseId(req.params.id));
    res.json(await dashboards.filterOptions(row, req.params.filterId));
  },
  regenerateToken: async (req, res) => res.json(await dashboards.regenerateToken(req.user, parseId(req.params.id))),
  listShares: async (req, res) => {
    const row = await dashboards.getEditable(req.user, parseId(req.params.id));
    res.json({ shares: await shares.listShares('dashboard', row.id), visibility: row.visibility });
  },
  addShare: async (req, res) => {
    const target = validateShareTarget(req.body);
    const row = await dashboards.getEditable(req.user, parseId(req.params.id));
    res.status(201).json(await shares.addShare('dashboard', row, req.user, target));
  },
  removeShare: async (req, res) => {
    const row = await dashboards.getEditable(req.user, parseId(req.params.id));
    res.json(await shares.removeShare('dashboard', row, req.user, parseUserId(req.params.userId)));
  },
  stats: async (req, res) => res.json(await dashboards.stats()),
};

// -------------------------- Route publique (jeton) ---------------------
const publicCtrl = {
  get: async (req, res) => {
    const row = await dashboards.getByToken(req.params.token, { countView: true });
    res.set('Cache-Control', 'no-store');
    res.json(dashboards.presentPublic(row));
  },
  render: async (req, res) => {
    const row = await dashboards.getByToken(req.params.token);
    res.json(await dashboards.render(row, filterValuesFrom(req.body)));
  },
  filterOptions: async (req, res) => {
    const row = await dashboards.getByToken(req.params.token);
    res.json(await dashboards.filterOptions(row, req.params.filterId));
  },
};

// ----------------------- Valeurs aberrantes (avancé) -------------------
const outliersCtrl = {
  methods: async (req, res) =>
    res.json(Object.entries(METHODS).map(([id, m]) => ({ id, label: m.label, defaultThreshold: m.defaultThreshold }))),
  datasets: async (req, res) => res.json(await deps.listReadableDatasets(req.user)),
  columns: async (req, res) => {
    const datasetId = parseId(req.params.datasetId);
    if (!(await deps.canReadDataset(req.user, datasetId))) throw httpError(404, 'Dataset introuvable.');
    res.json(await deps.listColumns(datasetId));
  },
  detect: async (req, res) => {
    const input = validateOutlierRequest(req.body);
    if (!(await deps.canReadDataset(req.user, input.datasetId))) throw httpError(404, 'Dataset introuvable.');
    const points = await deps.fetchColumnValues(input.datasetId, input.column, input.filters);
    deps.logActivity(req.user.id, 'outliers.detect', { datasetId: input.datasetId, column: input.column });
    res.json({ datasetId: input.datasetId, column: input.column, ...detectOutliers(points, input) });
  },
};

module.exports = { analysesCtrl, dashboardsCtrl, publicCtrl, outliersCtrl };
