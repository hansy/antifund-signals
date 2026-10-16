import type { OpportunityView } from "./opportunity-lifecycle";
export const signalFilters = [
  "All",
  "Lead",
  "Researching",
  "Exploring",
  "Not Interested",
  "Supporting research",
  "Projects",
] as const;
export type SignalFilter = (typeof signalFilters)[number];
export function signalCategory(
  opportunity?: Pick<OpportunityView, "stage" | "verdict">,
): Exclude<SignalFilter, "All" | "Supporting research" | "Projects"> {
  if (opportunity?.verdict === "not-interested") return "Not Interested";
  if (opportunity?.stage === "exploring") return "Exploring";
  if (opportunity?.stage === "researching") return "Researching";
  return "Lead";
}
