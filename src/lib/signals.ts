import type { OpportunityRevision } from "./opportunity-lifecycle";
import type { Insight, SignalBrief } from "./contracts";

/** Older collected signals remain readable until a researched brief is added. */
export function getSignalBrief(
  insight: Insight,
  revision?: OpportunityRevision,
): SignalBrief {
  const brief = insight.brief ?? {
    whatItIs: insight.opportunity,
    problem: insight.problem,
    breakthroughs: [{ text: insight.evidence, sourceIds: insight.sourceIds }],
    marketOpportunity: insight.gap,
    buyer: "Buyer to validate",
    marketStatus: "hypothesis",
    marketEvidence: [],
    risks: [insight.counterpoint],
    nextQuestions: [insight.nextQuestion],
  };
  if (!revision) return brief;
  const text = (id: string) =>
    revision.claims.find((claim) => claim.id === id)?.text ?? "Not established";
  return {
    ...brief,
    whatItIs: text(revision.content.what),
    problem: text(revision.content.problem),
    marketOpportunity: text(revision.content.opportunity),
    targetCustomers: revision.content.customers.map((customer) =>
      text(customer.claimId),
    ),
    buyer:
      revision.content.customers
        .map((customer) => text(customer.claimId))
        .join("; ") || "Buyer to validate",
    applications: revision.content.applications.map(text),
    marketSize: undefined,
    marketEvidence: [],
  };
}
