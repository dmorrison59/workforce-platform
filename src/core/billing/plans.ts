export type PlanId = "starter" | "growth" | "pro";

export const PLANS: Record<
  PlanId,
  { name: string; monthly: number; maxEmployees: number | null; priceId: string; blurb: string }
> = {
  starter: {
    name: "Starter",
    monthly: 49,
    maxEmployees: 10,
    priceId: "price_1UAWSNGXrBuu9qZEvVUT4BMr",
    blurb: "Up to 10 employees",
  },
  growth: {
    name: "Growth",
    monthly: 99,
    maxEmployees: 25,
    priceId: "price_1UAWT7GXrBuu9qZEDpZSsWgY",
    blurb: "Up to 25 employees",
  },
  pro: {
    name: "Pro",
    monthly: 179,
    maxEmployees: null,
    priceId: "price_1UAWTfGXrBuu9qZETOA4MLFZ",
    blurb: "Unlimited employees",
  },
};

export const PLAN_BY_PRICE_ID = Object.fromEntries(
  Object.entries(PLANS).map(([id, p]) => [p.priceId, id]),
) as Record<string, PlanId>;