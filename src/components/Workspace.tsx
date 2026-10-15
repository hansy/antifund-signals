import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "./ui/dropdown-menu";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import {
  signalFilters,
  signalCategory,
  type SignalFilter,
} from "../lib/signal-filter";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetClose,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { WorkspaceSkeleton } from "./WorkspaceSkeleton";
import { useOpportunityStages } from "../lib/use-opportunity-stages";
import {
  OpportunityStage,
  StageBadge,
  OpportunityMarket,
} from "./OpportunityStage";
import { OpportunityFeedback } from "./OpportunityFeedback";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useCorpus } from "../lib/client";
import { getSignalBrief } from "../lib/signals";
import { groupResearchTeams } from "../lib/teams";
import { Portrait, TeamView } from "./TeamView";
import type { Corpus, Insight, Project, Source } from "../lib/contracts";

type Selection = {
  signal: string | null;
  source: string | null;
  project: string | null;
  team: string | null;
};
const emptySelection: Selection = {
  signal: null,
  source: null,
  project: null,
  team: null,
};
function readSelection(): Selection {
  const params = new URLSearchParams(window.location.search);
  return {
    signal: params.get("signal"),
    source: params.get("source"),
    project: params.get("project"),
    team: params.get("team"),
  };
}
function selectionUrl(selection: Selection) {
  const params = new URLSearchParams();
  if (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("actor") === "test"
  )
    params.set("actor", "test");
  if (selection.signal) params.set("signal", selection.signal);
  if (selection.source) params.set("source", selection.source);
  if (selection.project) params.set("project", selection.project);
  if (selection.team) params.set("team", selection.team);
  return params.size ? `/?${params}` : "/";
}
function Arrow({
  back = false,
  external = false,
}: {
  back?: boolean;
  external?: boolean;
}) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={
          external
            ? "M6 18 18 6M6 6h12v12"
            : back
              ? "M20 12H5m6-6-6 6 6 6"
              : "M4 12h15m-6-6 6 6-6 6"
        }
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function clean(value: string) {
  return value.replace(/^(?:Reported|Our interpretation):\s*/, "");
}
function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
}
function BriefSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="brief-section" id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
function CollectionInfo({ corpus }: { corpus: Corpus }) {
  return (
    <details className="collection-info">
      <summary aria-label="About this collection">
        <span aria-hidden="true">i</span>
      </summary>
      <div className="info-popover">
        <p>{corpus.meta.coverageNote}</p>
        <p>
          Demo feedback is shared. Interest saves a preference; research is off.
        </p>
        <p>Updated {formatDate(corpus.meta.collectedAt)}.</p>
      </div>
    </details>
  );
}
function SignalFilters({
  value,
  onChange,
}: {
  value: SignalFilter;
  onChange: (value: SignalFilter) => void;
}) {
  return (
    <div className="signal-filter-control">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="signal-filter-trigger"
            aria-label={`Filter signals: ${value}`}
          >
            {value}
            <ChevronDownIcon width={14} height={14} aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          collisionPadding={12}
          aria-label="Filter signals by state"
        >
          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(next) => {
              const filter = signalFilters.find((item) => item === next);
              if (filter) onChange(filter);
            }}
          >
            {signalFilters.map((filter) => (
              <DropdownMenuRadioItem key={filter} value={filter}>
                {filter}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
export function Workspace() {
  const { data: corpus, isLoading, error } = useCorpus();
  const stages = useOpportunityStages();
  const [signalFilter, setSignalFilter] = useState<SignalFilter>("All");
  const [selection, setSelection] = useState<Selection>(emptySelection);
  const [ready, setReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerTrigger = useRef<HTMLButtonElement | null>(null);
  const focusAfterDrawer = useRef(false);
  function closeDrawer() {
    setDrawerOpen(false);
  }
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 960px)");
    const changed = () => {
      if (desktop.matches) setDrawerOpen(false);
    };
    desktop.addEventListener("change", changed);
    return () => desktop.removeEventListener("change", changed);
  }, []);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasNavigated = useRef(false);
  function select(next: Selection) {
    hasNavigated.current = true;
    setSelection(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  useEffect(() => {
    setSelection(readSelection());
    setReady(true);
    const update = () => select(readSelection());
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener("popstate", update);
    };
  }, []);
  useEffect(() => {
    if (hasNavigated.current)
      headingRef.current?.focus({ preventScroll: true });
  }, [selection]);
  function navigate(event: MouseEvent<HTMLAnchorElement>, next: Selection) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    if (selectionUrl(next) === selectionUrl(selection)) return;
    window.history.pushState(null, "", selectionUrl(next));
    select(next);
  }
  function internalLink(next: Selection) {
    return {
      href: selectionUrl(next),
      onClick: (event: MouseEvent<HTMLAnchorElement>) => navigate(event, next),
    };
  }
  const insight = selection.signal
    ? corpus?.insights.find((item) => item.id === selection.signal)
    : corpus?.insights[0];
  const source =
    insight &&
    corpus?.sources.find(
      (item) =>
        item.id === selection.source && insight.sourceIds.includes(item.id),
    );
  const project =
    insight &&
    corpus?.projects.find(
      (item) =>
        item.id === selection.project &&
        insight.projectIds.includes(item.id) &&
        item.evidence.some((evidence) => evidence.sourceId === source?.id),
    );
  const opportunity = stages.data?.opportunities.find(
    (o) => o.id === insight?.id,
  );
  const brief = insight ? getSignalBrief(insight, opportunity?.accepted) : null;
  const relatedProjects =
    corpus?.projects.filter((item) => insight?.projectIds.includes(item.id)) ??
    [];
  const researchTeams = groupResearchTeams(relatedProjects);
  const team = researchTeams.find((item) =>
    item.projects.some((project) => project.id === selection.team),
  );
  const signalSelection = {
    signal: insight?.id ?? null,
    source: null,
    project: null,
    team: null,
  };
  const unknownSelection =
    ready &&
    corpus &&
    ((selection.signal && !insight) ||
      (selection.source && !source) ||
      (selection.project && !project) ||
      (selection.team && (!team || selection.source || selection.project)));
  function sourceLink(sourceId: string, projectId?: string) {
    return internalLink({
      signal: insight?.id ?? null,
      source: sourceId,
      project: projectId ?? null,
      team: null,
    });
  }
  const visibleSignals = (corpus?.insights ?? []).filter(
    (item) =>
      signalFilter === "All" ||
      signalCategory(
        stages.data?.opportunities.find((o) => o.id === item.id),
      ) === signalFilter,
  );
  const filterControl = (
    <SignalFilters value={signalFilter} onChange={setSignalFilter} />
  );
  const emptyFilter =
    visibleSignals.length === 0 && (corpus?.insights.length ?? 0) > 0 ? (
      <p className="signal-filter-empty" role="status">
        No signals in {signalFilter.toLowerCase()}.
      </p>
    ) : null;
  const loading = isLoading || !ready;
  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <div className="app is-expanded signal-workspace">
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        {corpus && !loading && !error && (
          <nav
            id="signals"
            tabIndex={-1}
            className="signals"
            aria-label="Signals"
          >
            <div className="rail-tools">
              <a
                className="antifund-brand"
                {...internalLink(emptySelection)}
                aria-label="Anti Fund home"
              >
                <span className="antifund-wordmark">Anti Fund</span>
              </a>
            </div>
            {filterControl}
            <div className="signal-list">
              {visibleSignals.map((item) => (
                <a
                  key={item.id}
                  {...internalLink({
                    signal: item.id,
                    source: null,
                    project: null,
                    team: null,
                  })}
                  className={`signal-card ${item.id === insight?.id ? "is-active" : ""}`}
                  aria-current={item.id === insight?.id ? "page" : undefined}
                >
                  <div className="signal-copy">
                    <h2>{item.title}</h2>
                    <StageBadge
                      verdict={
                        stages.data?.opportunities.find((o) => o.id === item.id)
                          ?.verdict
                      }
                      research={
                        stages.data?.opportunities.find((o) => o.id === item.id)
                          ?.research
                      }
                      stage={
                        stages.data?.opportunities.find((o) => o.id === item.id)
                          ?.stage
                      }
                    />
                    <p>{item.summary}</p>
                  </div>
                  <span className="signal-arrow">
                    <Arrow />
                  </span>
                </a>
              ))}
            </div>
            {emptyFilter}
            {corpus.insights.length === 0 && (
              <p className="state-message">No signals collected yet.</p>
            )}
            <CollectionInfo corpus={corpus} />
          </nav>
        )}
        {corpus && !loading && !error && (
          <div className="mobile-signal-picker">
            <a
              className="antifund-brand"
              {...internalLink(emptySelection)}
              aria-label="Anti Fund home"
            >
              <span className="antifund-wordmark">Anti Fund</span>
            </a>
            <SheetTrigger asChild>
              <button
                className="mobile-signals-trigger"
                type="button"
                aria-haspopup="dialog"
                aria-expanded={drawerOpen}
                onClick={(event) => {
                  drawerTrigger.current = event.currentTarget;
                  focusAfterDrawer.current = false;
                }}
              >
                <Bars3Icon width={20} height={20} aria-hidden="true" />
                Signals
              </button>
            </SheetTrigger>
          </div>
        )}
        {corpus && !loading && !error && (
          <SheetContent
            side="left"
            className="mobile-signal-drawer"
            showCloseButton={false}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (focusAfterDrawer.current)
                headingRef.current?.focus({ preventScroll: true });
              else drawerTrigger.current?.focus();
              focusAfterDrawer.current = false;
            }}
          >
            <SheetHeader className="signal-drawer-header">
              <SheetTitle>Signals</SheetTitle>
              <SheetDescription className="sr-only">
                Choose a signal to review.
              </SheetDescription>
              <SheetClose asChild>
                <button type="button" autoFocus aria-label="Close signals">
                  <XMarkIcon width={22} height={22} aria-hidden="true" />
                </button>
              </SheetClose>
            </SheetHeader>
            {filterControl}
            <nav aria-label="Mobile signals" className="signal-drawer-list">
              {visibleSignals.map((item) => (
                <a
                  key={item.id}
                  href={selectionUrl({ ...emptySelection, signal: item.id })}
                  aria-current={item.id === insight?.id ? "page" : undefined}
                  onClick={(event) => {
                    navigate(event, { ...emptySelection, signal: item.id });
                    if (event.defaultPrevented) {
                      focusAfterDrawer.current = true;
                      closeDrawer();
                    }
                  }}
                >
                  <span>{item.title}</span>
                  <StageBadge
                    verdict={
                      stages.data?.opportunities.find((o) => o.id === item.id)
                        ?.verdict
                    }
                    research={
                      stages.data?.opportunities.find((o) => o.id === item.id)
                        ?.research
                    }
                    stage={
                      stages.data?.opportunities.find((o) => o.id === item.id)
                        ?.stage
                    }
                  />
                </a>
              ))}
            </nav>
            {emptyFilter}
          </SheetContent>
        )}
        <main id="content" className="content-space">
          {loading ? (
            <WorkspaceSkeleton />
          ) : error ? (
            <div className="state-message" role="alert">
              <h1>Research could not load</h1>
              <p>
                {error instanceof Error ? error.message : "Please try again."}
              </p>
              <button onClick={() => window.location.reload()}>
                Try again <Arrow />
              </button>
            </div>
          ) : unknownSelection ? (
            <div className="state-message">
              <h1 ref={headingRef} tabIndex={-1}>
                This research is unavailable
              </h1>
              <a {...internalLink(emptySelection)}>
                Signals <Arrow />
              </a>
            </div>
          ) : corpus && insight && brief ? (
            <>
              <nav className="mobile-navigation" aria-label="Breadcrumb">
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className="mobile-signals-trigger breadcrumb-signals"
                    onClick={(event) => {
                      drawerTrigger.current = event.currentTarget;
                      focusAfterDrawer.current = false;
                    }}
                    aria-haspopup="dialog"
                    aria-expanded={drawerOpen}
                  >
                    Signals
                  </button>
                </SheetTrigger>
                <span aria-hidden="true">/</span>
                {source || team ? (
                  <>
                    <a {...internalLink(signalSelection)}>{insight.title}</a>
                    <span aria-hidden="true">/</span>
                    <span aria-current="page">{team ? "Team" : "Source"}</span>
                  </>
                ) : (
                  <span aria-current="page">{insight.title}</span>
                )}
              </nav>
              {team ? (
                <div className="report team-report" key={`team-${team.id}`}>
                  <a
                    className="source-return"
                    {...internalLink(signalSelection)}
                    aria-label={`Return to ${insight.title}`}
                  >
                    <Arrow back />
                    <span>{insight.title}</span>
                  </a>
                  <TeamView team={team} headingRef={headingRef} />
                </div>
              ) : source ? (
                <div
                  className="report source-report"
                  key={`${insight.id}-${source.id}-${project?.id ?? ""}`}
                >
                  <a
                    className="source-return"
                    {...internalLink(signalSelection)}
                    aria-label={`Return to ${insight.title}`}
                  >
                    <Arrow back />
                    <span>{insight.title}</span>
                  </a>
                  <SourceView
                    source={source}
                    project={project}
                    corpus={corpus}
                    insight={insight}
                    headingRef={headingRef}
                  />
                </div>
              ) : (
                <article className="report" key={insight.id}>
                  {opportunity && (
                    <OpportunityStage opportunity={opportunity} />
                  )}
                  {insight.id.startsWith("synthesis-") && !opportunity && (
                    <p className="stage-load" role="status">
                      {stages.isError ? "Stage unavailable." : "Loading stage…"}
                      {stages.isError && (
                        <button onClick={() => void stages.refetch()}>
                          Retry
                        </button>
                      )}
                    </p>
                  )}
                  <div className="brief-header">
                    <h1 ref={headingRef} tabIndex={-1}>
                      {opportunity?.accepted.title ?? insight.title}
                    </h1>
                    <p className="brief-summary">{brief.whatItIs}</p>
                  </div>
                  <div className="brief-body">
                    <div className="commercial-overview">
                      <div className="market-fit">
                        <section>
                          <h2>Potential customers</h2>
                          <ul className="customer-list">
                            {(brief.targetCustomers?.length
                              ? brief.targetCustomers
                              : [brief.buyer]
                            ).map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </section>
                        <section>
                          <h2>Potential applications</h2>
                          {brief.applications?.length ? (
                            <ul className="application-list">
                              {brief.applications.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          ) : (
                            <p>Applications need validation with customers.</p>
                          )}
                        </section>
                      </div>
                      <section className="market-size">
                        <h2>Market size</h2>
                        {opportunity ? (
                          <OpportunityMarket revision={opportunity.accepted} />
                        ) : brief.marketSize ? (
                          <>
                            <p className="market-value">
                              {brief.marketSize.value}
                            </p>
                            <p className="market-category">
                              {brief.marketSize.market} ·{" "}
                              {brief.marketSize.year}
                            </p>
                            <p className="market-scope">
                              {brief.marketSize.context}
                            </p>
                            <div className="market-references">
                              {brief.marketSize.sourceUrls.map((url) => {
                                const evidence = brief.marketEvidence.find(
                                  (e) => e.url === url,
                                );
                                return (
                                  <a
                                    key={url}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {evidence?.title.split(" · ")[0] ??
                                      "Source"}
                                    <Arrow external />
                                  </a>
                                );
                              })}
                            </div>
                          </>
                        ) : (
                          <p className="market-scope">
                            No sourced estimate yet.
                          </p>
                        )}
                      </section>
                    </div>
                    <BriefSection id="opportunity" title="The opportunity">
                      <p>{brief.marketOpportunity}</p>
                    </BriefSection>
                    <BriefSection id="problem" title="The problem">
                      <p>{brief.problem}</p>
                    </BriefSection>
                    <BriefSection id="teams" title="Projects & teams">
                      <div className="research-list">
                        {researchTeams.map((team) => {
                          const schoolNames = [
                            ...new Set(
                              team.projects.map(
                                (item) =>
                                  corpus.schools.find(
                                    (school) => school.id === item.schoolId,
                                  )?.shortName,
                              ),
                            ),
                          ]
                            .filter(Boolean)
                            .join(" · ");
                          const years = team.projects.map((item) => item.year);
                          const firstYear = Math.min(...years);
                          const lastYear = Math.max(...years);
                          const yearLabel =
                            firstYear === lastYear
                              ? `${firstYear}`
                              : `${firstYear}–${lastYear}`;
                          const peopleLabel =
                            team.members
                              .slice(0, 2)
                              .map(({ person }) => person.name)
                              .join(", ") +
                            (team.members.length > 2
                              ? ` +${team.members.length - 2}`
                              : "");
                          return (
                            <article className="research-card" key={team.id}>
                              <div className="team-research">
                                {team.projects.map((item) => {
                                  const evidence = item.evidence.filter(
                                    (e, index, all) =>
                                      all.findIndex(
                                        (other) =>
                                          other.sourceId === e.sourceId,
                                      ) === index,
                                  );
                                  const primary = evidence[0];
                                  return (
                                    <div
                                      className="research-item"
                                      key={item.id}
                                    >
                                      {primary ? (
                                        <a
                                          className="research-project-link"
                                          {...sourceLink(
                                            primary.sourceId,
                                            item.id,
                                          )}
                                        >
                                          <h3 className="research-title">
                                            {item.title}
                                            {primary.page && (
                                              <span className="research-page">
                                                p. {primary.page}
                                              </span>
                                            )}
                                          </h3>
                                          <p>{item.summary}</p>
                                        </a>
                                      ) : (
                                        <div className="research-project-link">
                                          <h3 className="research-title">
                                            {item.title}
                                          </h3>
                                          <p>{item.summary}</p>
                                        </div>
                                      )}
                                      {evidence.slice(1).map((entry) => (
                                        <a
                                          className="research-secondary"
                                          key={entry.sourceId}
                                          {...sourceLink(
                                            entry.sourceId,
                                            item.id,
                                          )}
                                        >
                                          {corpus.sources.find(
                                            (source) =>
                                              source.id === entry.sourceId,
                                          )?.title ?? item.title}
                                          {entry.page && (
                                            <span className="research-page">
                                              p. {entry.page}
                                            </span>
                                          )}
                                        </a>
                                      ))}
                                    </div>
                                  );
                                })}
                              </div>
                              {team.members.length > 0 ? (
                                <a
                                  className="research-team"
                                  {...internalLink({
                                    signal: insight.id,
                                    source: null,
                                    project: null,
                                    team: team.id,
                                  })}
                                  aria-label={`View team: ${peopleLabel || "Contributors not listed"}, ${schoolNames}, ${yearLabel}${insight.id.startsWith("synthesis-") ? " event listing" : ""}`}
                                >
                                  <div
                                    className="team-preview"
                                    aria-hidden="true"
                                  >
                                    {team.members
                                      .slice(0, 4)
                                      .map(({ key, person }) => (
                                        <Portrait key={key} person={person} />
                                      ))}
                                    {team.members.length > 4 && (
                                      <span className="team-remainder">
                                        +{team.members.length - 4}
                                      </span>
                                    )}
                                  </div>
                                  <h3 className="team-name">
                                    {peopleLabel || "Contributors"}
                                  </h3>
                                  <p className="research-team-meta">
                                    {schoolNames} · {yearLabel}
                                    {insight.id.startsWith("synthesis-")
                                      ? " event listing"
                                      : ""}
                                  </p>
                                </a>
                              ) : (
                                <p className="research-project-meta">
                                  {schoolNames} · {yearLabel}
                                  {insight.id.startsWith("synthesis-")
                                    ? " event listing"
                                    : ""}
                                </p>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    </BriefSection>
                    {brief.marketEvidence.length > 0 && (
                      <details className="deeper-detail">
                        <summary>Market sources</summary>
                        <div className="market-sources">
                          {brief.marketEvidence.map((item) => (
                            <div key={item.url}>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {item.title}
                                <Arrow external />
                              </a>
                              <blockquote>{item.excerpt}</blockquote>
                              <small>
                                Accessed {formatDate(item.accessedAt)}
                              </small>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                    {opportunity && (
                      <OpportunityFeedback key={insight.id} id={insight.id} />
                    )}
                  </div>
                </article>
              )}
            </>
          ) : null}
        </main>
      </div>
    </Sheet>
  );
}

function SourceView({
  source,
  project,
  corpus,
  insight,
  headingRef,
}: {
  source: Source;
  project: Project | undefined;
  corpus: Corpus;
  insight: Insight;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const school = corpus.schools.find((item) => item.id === source.schoolId);
  const projects = project
    ? [project]
    : corpus.projects.filter(
        (item) =>
          insight.projectIds.includes(item.id) &&
          item.evidence.some((evidence) => evidence.sourceId === source.id),
      );
  const citations = projects.flatMap((item) =>
    item.evidence.filter((evidence) => evidence.sourceId === source.id),
  );
  const excerpts = citations.length
    ? citations.filter(
        (item, index) =>
          citations.findIndex(
            (other) => other.quote === item.quote && other.page === item.page,
          ) === index,
      )
    : [{ quote: source.excerpt, page: undefined, locator: undefined }];
  const originalUrl =
    excerpts[0]?.page && source.kind === "pdf"
      ? `${source.url.split("#")[0]}#page=${excerpts[0].page}`
      : source.url;
  return (
    <article className="source-view">
      <div className="source-header">
        <h1 ref={headingRef} tabIndex={-1}>
          {source.title}
        </h1>
        <p className="source-meta">
          {school?.name} <span>·</span> {source.year}
          {source.id.startsWith("synthesis-") ? " event listing" : ""}
        </p>
      </div>
      <div className="source-layout">
        <div className="source-context">
          <section>
            <h2>Who</h2>
            <p>
              {source.id.startsWith("synthesis-") ? "Source collection: " : ""}
              {school?.name}
            </p>
            {projects.map((item) =>
              item.authors.length > 0 ? (
                <p key={item.id} className="researchers">
                  {item.authors.join(", ")}
                </p>
              ) : null,
            )}
          </section>
          {projects.map((item) => (
            <div className="project-context" key={item.id}>
              <section>
                <h2>What they did</h2>
                {projects.length > 1 && <h3>{item.title}</h3>}
                <p>{clean(item.approach)}</p>
              </section>
              <section>
                <h2>Reported result</h2>
                <p>{clean(item.results)}</p>
              </section>
              <section>
                <h2>Why it matters</h2>
                <p>Our interpretation: {clean(item.whyItMatters)}</p>
              </section>
              {item.limitations && (
                <section>
                  <h2>Limitations</h2>
                  <p>{clean(item.limitations)}</p>
                </section>
              )}
            </div>
          ))}
        </div>
        <div className="source-evidence">
          <div className="section-heading">
            <h2>Exact excerpt</h2>
          </div>
          {excerpts.map((item, index) => (
            <div className="excerpt" key={index}>
              <blockquote>{item.quote}</blockquote>
              {(item.page || item.locator) && (
                <p className="excerpt-locator">
                  {item.page ? `Page ${item.page}` : ""}
                  {item.page && item.locator ? " · " : ""}
                  {item.locator}
                </p>
              )}
            </div>
          ))}
          <dl className="source-facts">
            <div>
              <dt>
                {source.id.startsWith("synthesis-")
                  ? "Event year"
                  : "Published"}
              </dt>
              <dd>{source.year}</dd>
            </div>
            <div>
              <dt>
                {source.id.startsWith("synthesis-")
                  ? "Saved evidence inspected"
                  : "Accessed"}
              </dt>
              <dd>{formatDate(source.accessedAt)}</dd>
            </div>
            <div>
              <dt>Original URL</dt>
              <dd>
                <a href={originalUrl} target="_blank" rel="noopener noreferrer">
                  {source.url}
                </a>
              </dd>
            </div>
          </dl>
          <a
            className="original-link"
            href={originalUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open original source <Arrow external />
          </a>
        </div>
      </div>
    </article>
  );
}
