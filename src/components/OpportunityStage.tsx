import {
  stageLabels,
  researchStatusLabels,
  type OpportunityView,
} from "../lib/opportunity-lifecycle";
import { marketRangeLabel, factorValue } from "../lib/market-sizing";
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
  const model = revision.marketSizing;
  if (model) {
    const sourceIds = new Set([
      ...model.factors.flatMap((f) => f.sourceIds),
      ...model.growth.sourceIds,
    ]);
    const sources = revision.evidence.filter((e) => sourceIds.has(e.id));
    return (
      <div className="market-model">
        <p className="market-value">{marketRangeLabel(model)}</p>
        <p className="market-category">
          Conditional estimate · {model.geography}
        </p>
        <p className="market-scope">{model.scope}</p>
        <p className="market-growth">{model.growth.text}</p>
        <details className="market-method">
          <summary>Calculation, assumptions & sources</summary>
          <div className="market-method-content">
            <p>
              {model.basis === "annualized-equipment-spend"
                ? "Equipment purchases spread over an assumed replacement cycle."
                : "Annual spending for the defined segment."}{" "}
              Scenario, not measured demand or a sales forecast. Confidence:{" "}
              {model.confidence}.
            </p>
            <ol className="market-inputs">
              {model.factors.map((f, index) => (
                <li key={f.label}>
                  <strong>
                    {index === 0 ? "" : f.operation === "divide" ? "÷ " : "× "}
                    {factorValue(f)}
                  </strong>
                  <span>
                    {f.label} ·{" "}
                    {f.basis === "reported" ? "Reported input" : "Assumption"}
                  </span>
                  <p>{f.reason}</p>
                </li>
              ))}
            </ol>
            <p>
              <strong>Growth: </strong>
              {model.growth.kind === "forecast" ? "Forecast" : "Observed"}{" "}
              {model.growth.measure}, {model.growth.period}.{" "}
              {model.growth.limitation}
            </p>
            <ul>
              {model.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <p>
              <strong>To narrow the range: </strong>
              {model.nextEvidence}
            </p>
            <div className="market-references">
              {sources.map((s) => (
                <a
                  key={s.id}
                  href={s.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {s.title}
                  {s.pdfPage ? ` · p. ${s.pdfPage}` : ""}
                </a>
              ))}
            </div>
            <p className="market-date">
              Inputs: {model.period}. Checked {model.asOf}.
            </p>
          </div>
        </details>
      </div>
    );
  }
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
