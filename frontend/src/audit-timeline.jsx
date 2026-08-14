// Audit Timeline JSX (to be integrated into App.jsx)

<section className="audit-panel">

  <div className="audit-heading">

    <div>

      <div className="section-kicker">
        IMMUTABLE AUDIT LOG
      </div>

      <h2>
        RUN ID: {runId}
      </h2>

    </div>

  </div>

  <div className="audit-timeline">

    {auditTrail.length === 0 ? (

      <div className="audit-placeholder">
        <Terminal size={15} />
        <span>No execution events recorded.</span>
      </div>

    ) : (

      <div className="timeline-events">
        {auditTrail.map((event, idx) => (
          <div key={idx} className={`timeline-event ${event.type.toLowerCase()}`}>
            <div className="timeline-marker" />
            <div className="timeline-content">
              <div className="event-header">
                <span className="event-time">{event.time}</span>
                <span className="event-type">{event.type}</span>
              </div>
              <div className="event-body">
                {event.type === "PLANNING" && (
                  <>
                    <span className="event-label">{event.label}</span>
                    <span className="event-detail">└─ {event.details}</span>
                  </>
                )}
                {event.type === "INTERCEPTOR" && (
                  <>
                    <div className="event-metrics">
                      <div>
                        <span className="metric-label">Similarity</span>
                        <span className="metric-value">{(event.similarity * 100).toFixed(2)}%</span>
                      </div>
                      <div>
                        <span className="metric-label">Threshold</span>
                        <span className="metric-value">{(event.threshold * 100).toFixed(2)}%</span>
                      </div>
                    </div>
                    <div>
                      <span className="event-label">Matched</span>
                      <span className="event-detail">{event.matched}</span>
                    </div>
                    {event.blocked && (
                      <span className="event-status blocked">└─ BLOCKED</span>
                    )}
                  </>
                )}
                {event.type === "ROLLBACK" && (
                  <>
                    <span className="event-label">{event.label}</span>
                    <div className="event-metrics">
                      <div>
                        <span className="metric-label">Vector</span>
                        <span className="metric-value">{event.vector}</span>
                      </div>
                      <div>
                        <span className="metric-label">Vault entries</span>
                        <span className="metric-value">{event.vaultEntries}</span>
                      </div>
                    </div>
                  </>
                )}
                {event.type === "PIVOT" && (
                  <>
                    <span className="event-label">{event.label}</span>
                    {event.verified && (
                      <span className="event-status verified">└─ Verification passed</span>
                    )}
                  </>
                )}
                {event.type === "COMPLETE" && (
                  <span className="event-label">{event.label}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

    )}

  </div>

</section>
