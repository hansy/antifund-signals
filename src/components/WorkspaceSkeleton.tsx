function Lines({ count = 3 }: { count?: number }) {
  return (
    <div className="skeleton-lines">
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-shape" key={index} />
      ))}
    </div>
  );
}
export function WorkspaceSkeleton() {
  return (
    <div
      className="workspace-skeleton"
      role="status"
      aria-label="Loading signals"
      aria-busy="true"
    >
      <span className="sr-only">Loading signals…</span>
      <div aria-hidden="true">
        <div className="skeleton-rail">
          <span className="antifund-wordmark">Anti Fund</span>
          <div className="skeleton-nav">
            {Array.from({ length: 8 }, (_, index) => (
              <div className="skeleton-nav-item" key={index}>
                <Lines count={2} />
              </div>
            ))}
          </div>
        </div>
        <div className="skeleton-mobile">
          <span className="antifund-wordmark">Anti Fund</span>
          <div className="skeleton-shape" />
        </div>
        <div className="report skeleton-report">
          <div className="skeleton-shape skeleton-stage" />
          <div className="skeleton-title">
            <Lines count={2} />
          </div>
          <Lines />
          <div className="skeleton-commercial">
            <div>
              <div className="skeleton-shape skeleton-label" />
              <Lines />
              <div className="skeleton-shape skeleton-label" />
              <Lines />
            </div>
            <div>
              <div className="skeleton-shape skeleton-label" />
              <div className="skeleton-shape skeleton-number" />
              <Lines count={2} />
            </div>
          </div>
          <div className="skeleton-section">
            <div className="skeleton-shape skeleton-label" />
            <Lines />
          </div>
          <div className="skeleton-section">
            <div className="skeleton-shape skeleton-label" />
            <Lines count={2} />
          </div>
          <div className="skeleton-cards">
            {[0, 1].map((index) => (
              <div className="skeleton-card" key={index}>
                <Lines />
              </div>
            ))}
          </div>
        </div>
        <div className="skeleton-dock">
          <div className="skeleton-shape skeleton-note" />
          {[0, 1].map((index) => (
            <div className="skeleton-shape skeleton-control" key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
