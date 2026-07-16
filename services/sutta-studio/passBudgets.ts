/** Completion-token budgets shared by production and benchmark pass runners. */

export const SUTTA_STUDIO_TOKEN_BUDGETS = {
  skeleton: 4000,
  anatomist: 8000,
  lexicographer: 8000,
  weaver: 4000,
  typesetter: 3000,
  morphology: 3000,
  phaseView: 4000,
} as const;

export type SuttaStudioBudgetName = keyof typeof SUTTA_STUDIO_TOKEN_BUDGETS;
