import { Express, Router } from 'express';

export function mountDashboards(app: Express, prefix?: string): void;
export const analysesRouter: Router;
export const dashboardsRouter: Router;
export const outliersRouter: Router;
export const publicRouter: Router;

declare const _default: {
  mountDashboards: typeof mountDashboards;
  analysesRouter: typeof analysesRouter;
  dashboardsRouter: typeof dashboardsRouter;
  outliersRouter: typeof outliersRouter;
  publicRouter: typeof publicRouter;
};

export default _default;

