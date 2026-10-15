import {
  stageLabels,
  researchStatusLabels,
  type OpportunityView,
} from "../lib/opportunity-lifecycle";
const compactStatus = {
  queued: "Queued",
  running: "In progress",
  pausing: "Pausing",
  paused: "Paused",
  "checking-sources": "Checking evidence",
  "awaiting-inspection": "Awaiting review",
  failed: "Needs attention",
  completed: null,
  cancelled: null,
} satisfies Record<
  NonNullable<OpportunityView["research"]>["status"],
  string | null
>;

const descriptions = {
  "first-impressions": "Commercial case is a hypothesis.",
  researching: "Research and evidence review are not yet complete.",
  exploring: "Evidence inspected. Further diligence is still needed.",
};
export function StageBadge({
  stage,
  research,
  verdict,
}: {
  verdict?: OpportunityView["verdict"];
  stage?: OpportunityView["stage"];
  research?: OpportunityView["research"];
}) {
  if (verdict === "not-interested")
    return (
      <span
        className="signal-stage stage-not-interested"
        title="Marked as not interesting."
        aria-label="Not interesting"
      >
        Not interesting
      </span>
    );
  if (!stage) return null;
  // Exploring describes accepted evidence, even during follow-up work.
  // Historical completion/cancellation adds no extra label to the list.
  const status =
    stage !== "exploring" && research && !research.cancelRequested
      ? compactStatus[research.status]
      : null;
  const label = status
    ? `${stageLabels[stage]} · ${status}`
    : stageLabels[stage];
  const description = research
    ? `${descriptions[stage]} ${researchStatusLabels[research.status]}.`
    : descriptions[stage];
  return (
    <span
      className={`signal-stage stage-${stage}`}
      title={description}
      aria-label={`${label}. ${description}`}
    >
      {label}
    </span>
  );
}
export function OpportunityStage({
  opportunity,
}: {
  opportunity: OpportunityView;
}) {
  return (
    <div className="opportunity-stage" aria-label="Signal stage">
      <StageBadge
        stage={opportunity.stage}
        research={opportunity.research}
        verdict={opportunity.verdict}
      />
    </div>
  );
}

export function OpportunityMarket({
  revision,
}: {
  revision: OpportunityView["accepted"];
}) {
  const claims = revision.claims.filter((claim) =>
    revision.content.marketSize.includes(claim.id),
  );
  return claims.length ? (
    <div>
      {claims.map((claim) => (
        <p className="market-scope" key={claim.id}>
          <span className="claim-kind">
            {claim.kind === "estimate"
              ? "Estimate"
              : claim.kind === "reported"
                ? "Reported"
                : claim.kind === "hypothesis"
                  ? "Hypothesis"
                  : "Interpretation"}{" "}
            ·{" "}
          </span>
          {claim.text}
        </p>
      ))}
    </div>
  ) : (
    <p className="market-scope">No sourced estimate yet.</p>
  );
}
