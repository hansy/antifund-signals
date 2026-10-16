import { z } from "zod";

const text = z.string().min(1);
const marketObservation = z
  .object({
    value: z.number().finite().positive(),
    year: z.number().int().min(1900).max(2100),
    kind: z.enum(["estimate", "forecast"]),
  })
  .strict();

// Publisher estimates of a named market; never an assumed share of its revenue.
export const reportedMarketSchema = z
  .object({
    name: text,
    geography: text,
    currency: z.literal("USD"),
    start: marketObservation,
    end: marketObservation,
    growth: z
      .object({
        value: z.number().finite(),
        unit: z.enum(["percent", "multiple"]),
        kind: z.enum(["historical", "forecast"]),
        period: text,
      })
      .strict(),
    sourceIds: z.array(text).min(1),
    scopeNote: text,
  })
  .strict()
  .refine(
    (m) => m.end.year > m.start.year,
    "Market years must be chronological",
  );
export type ReportedMarket = z.infer<typeof reportedMarketSchema>;
export function marketMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}
export function reportedMarketLabel(m: ReportedMarket) {
  return `${marketMoney(m.start.value)} (${m.start.year}) → ${marketMoney(m.end.value)} (${m.end.year}${m.end.kind === "forecast" ? " forecast" : ""})`;
}
export const marketFactorSchema = z
  .object({
    label: text,
    low: z.number().finite().nonnegative(),
    high: z.number().finite().nonnegative(),
    unit: text,
    operation: z.enum(["multiply", "divide"]),
    basis: z.enum(["reported", "assumption"]),
    sourceIds: z.array(text),
    reason: text,
  })
  .strict();

// This is a conditional spending model, never a measured TAM or revenue forecast.
// Arithmetic and source membership are checked separately from semantic inspection.
export const marketSizingSchema = z
  .object({
    asOf: z.iso.date(),
    scope: text,
    geography: text,
    period: text,
    currency: z.literal("USD"),
    basis: z.enum(["annual-software-spend", "annualized-equipment-spend"]),
    factors: z.array(marketFactorSchema).min(2),
    growth: z
      .object({
        text,
        kind: z.enum(["observed", "forecast"]),
        measure: z.enum(["spending", "units", "workforce", "population"]),
        period: text,
        sourceIds: z.array(text).min(1),
        limitation: text,
      })
      .strict(),
    limitations: z.array(text).min(1),
    confidence: z.enum(["low", "moderate", "high"]),
    nextEvidence: text,
  })
  .strict();
export type MarketSizing = z.infer<typeof marketSizingSchema>;

export function marketRange(model: MarketSizing) {
  let low = 1,
    high = 1;
  for (const f of model.factors) {
    if (f.low > f.high || (f.operation === "divide" && f.low <= 0))
      throw Error("Invalid market factor range");
    low = f.operation === "divide" ? low / f.high : low * f.low;
    high = f.operation === "divide" ? high / f.low : high * f.high;
  }
  if (!Number.isFinite(low) || !Number.isFinite(high))
    throw Error("Invalid market result");
  return { low, high };
}

export function marketIssues(model: MarketSizing, sourceIds: Set<string>) {
  const issues: string[] = [];
  try {
    marketRange(model);
  } catch {
    issues.push("Invalid market arithmetic");
  }
  if (!model.factors.some((f) => f.basis === "reported" && f.sourceIds.length))
    issues.push("Market model needs a sourced denominator or spend input");
  for (const f of model.factors) {
    if (f.basis === "reported" && !f.sourceIds.length)
      issues.push("Reported input needs a source");
    if (f.sourceIds.some((id) => !sourceIds.has(id)))
      issues.push("Unknown market input source");
  }
  if (model.growth.sourceIds.some((id) => !sourceIds.has(id)))
    issues.push("Unknown growth source");
  return issues;
}

export function marketRangeLabel(model: MarketSizing) {
  const { low, high } = marketRange(model);
  const usd = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumSignificantDigits: 2,
  });
  return `${usd.format(low)}–${usd.format(high)} / year`;
}

export function factorValue(f: MarketSizing["factors"][number]) {
  if (f.unit === "share") {
    const pct = new Intl.NumberFormat("en-US", {
      style: "percent",
      maximumFractionDigits: 1,
    });
    return `${pct.format(f.low)}${f.low === f.high ? "" : `–${pct.format(f.high)}`}`;
  }
  const n = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
  return `${n.format(f.low)}${f.low === f.high ? "" : `–${n.format(f.high)}`} ${f.unit}`;
}
