import {
  stageLabels,
  researchStatusLabels,
  type OpportunityView,
} from "../lib/opportunity-lifecycle";
import { marketMoney } from "../lib/market-sizing";
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
  const market = revision.reportedMarket;
  if (market) {
    const latest = market.end.kind === "estimate" ? market.end : market.start;
    return (
      <div className="market-model">
        <p className="market-scope">
          {market.name} · {market.geography}
        </p>
        <div className="market-metrics">
          <div className="market-size-metric">
            <p className="market-metric-number">{marketMoney(latest.value)}</p>
            <span className="market-metric-label">{latest.year} estimate</span>
          </div>
          <div className="market-growth-metric">
            <p className="market-metric-number">
              {market.growth.value}
              {market.growth.unit === "multiple" ? "×" : "%"}
            </p>
            <span className="market-metric-label">
              {market.growth.kind === "forecast"
                ? "Annual growth forecast"
                : "Year-over-year growth"}
            </span>
            <span className="market-growth-period">{market.growth.period}</span>
          </div>
        </div>
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

export function OpportunityMarketSources({
  revision,
}: {
  revision: OpportunityView["accepted"];
}) {
  const model = revision.marketSizing;
  const claimSourceIds = revision.claims
    .filter((claim) => revision.content.marketSize.includes(claim.id))
    .flatMap((claim) => claim.evidenceIds);
  const sourceIds = new Set(
    revision.reportedMarket
      ? revision.reportedMarket.sourceIds
      : model
        ? [
            ...model.factors.flatMap((factor) => factor.sourceIds),
            ...model.growth.sourceIds,
          ]
        : claimSourceIds,
  );
  const sources = revision.evidence.filter((source) =>
    sourceIds.has(source.id),
  );
  if (!sources.length) return null;
  return (
    <section className="market-source-section" aria-label="Market sources">
      <h2>Market sources</h2>
      {revision.reportedMarket && (
        <p className="market-scope">{revision.reportedMarket.scopeNote}</p>
      )}
      <div className="market-sources">
        {sources.map((source) => (
          <div key={source.id}>
            <a
              href={source.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {source.title}
              {source.pdfPage ? ` · p. ${source.pdfPage}` : ""}
              <span aria-hidden="true"> ↗</span>
            </a>
            <blockquote>{source.excerpt}</blockquote>
            <small>
              {[
                source.publisher,
                source.publishedAt ? `Published ${source.publishedAt}` : null,
                source.retrievedAt ? `Accessed ${source.retrievedAt}` : null,
                source.locator,
              ]
                .filter(Boolean)
                .join(" · ")}
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}
