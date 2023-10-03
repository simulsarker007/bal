if (!process.env.STRIPE_PRO_PLAN_PRICE_ID)
  throw new Error("Define STRIPE_PRO_PLAN_PRICE_ID env var.");

export const plans = {
  pro: process.env.STRIPE_PRO_PLAN_PRICE_ID,
};
