import React from 'react'

export default function TopologyPanel({
  issues,
  statistics,
  onValidateAgain,
  onSelectIssue,
  onSelectParcel,
  parcels,
  busy
}) {
  const overlaps = issues.filter(i => i.issue_type === 'overlaps')
  const gaps = issues.filter(i => i.issue_type === 'gaps')
  const invalidGeoms = issues.filter(i => i.issue_type === 'invalid_geometry')
  const duplicates = issues.filter(i => i.issue_type === 'duplicates')
  const slivers = issues.filter(i => i.issue_type === 'sliver_polygons')
  const validParcels = statistics?.valid_parcels || 0

  return (
    <div className="topology-panel">
      <div className="control-card">
        <div className="card-title">
          <span>SPATIAL QUALITY ENFORCEMENT</span>
          <span className="badge-rule">Shapely 2.0 Planar Rules</span>
        </div>

        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
          Automated geometric validation enforces closed 2D planar topology: no self-intersections, no boundary overlaps (encroachment), no voids/gaps, no slivers below 35 m², and no duplicate cadastral records.
        </p>

        <button
          className="btn-primary btn-full btn-validate-large"
          disabled={busy}
          onClick={onValidateAgain}
        >
          <span>↻ VALIDATE AGAIN</span>
        </button>

        {/* SPATIAL QUALITY METRIC CARDS */}
        <div className="topology-metrics-grid">
          <div className="topo-metric-card metric-valid">
            <div className="topo-metric-icon">✓</div>
            <div className="topo-metric-num">{validParcels}</div>
            <div className="topo-metric-name">Valid Parcels</div>
          </div>

          <div className={`topo-metric-card ${overlaps.length > 0 ? 'metric-error' : 'metric-clean'}`}>
            <div className="topo-metric-icon">{overlaps.length > 0 ? '⚠' : '✓'}</div>
            <div className="topo-metric-num">{overlaps.length}</div>
            <div className="topo-metric-name">Overlaps</div>
          </div>

          <div className={`topo-metric-card ${gaps.length > 0 ? 'metric-warning' : 'metric-clean'}`}>
            <div className="topo-metric-icon">{gaps.length > 0 ? '⚠' : '✓'}</div>
            <div className="topo-metric-num">{gaps.length}</div>
            <div className="topo-metric-name">Cadastral Gaps</div>
          </div>

          <div className={`topo-metric-card ${invalidGeoms.length > 0 ? 'metric-error' : 'metric-clean'}`}>
            <div className="topo-metric-icon">{invalidGeoms.length > 0 ? '⚠' : '✓'}</div>
            <div className="topo-metric-num">{invalidGeoms.length}</div>
            <div className="topo-metric-name">Invalid Geometries</div>
          </div>

          <div className={`topo-metric-card ${duplicates.length > 0 ? 'metric-warning' : 'metric-clean'}`}>
            <div className="topo-metric-icon">{duplicates.length > 0 ? '⚠' : '✓'}</div>
            <div className="topo-metric-num">{duplicates.length}</div>
            <div className="topo-metric-name">Duplicate Geometries</div>
          </div>

          <div className={`topo-metric-card ${slivers.length > 0 ? 'metric-warning' : 'metric-clean'}`}>
            <div className="topo-metric-icon">{slivers.length > 0 ? '⚠' : '✓'}</div>
            <div className="topo-metric-num">{slivers.length}</div>
            <div className="topo-metric-name">Sliver Polygons</div>
          </div>
        </div>
      </div>

      {/* ANOMALY LIST */}
      <div className="control-card">
        <div className="card-title">
          <span>Identified Topology Anomalies ({issues.length})</span>
          <span className="badge badge-info">Click to Zoom</span>
        </div>

        <div className="issue-list-scroll">
          {issues.length === 0 ? (
            <div className="empty-state-small">
              <span className="empty-check">✓</span>
              <span>All parcel boundaries strictly satisfy planar topology.</span>
            </div>
          ) : (
            issues.map(iss => (
              <div
                key={iss.issue_id}
                className="issue-row"
                onClick={() => {
                  if (iss.geometry?.coordinates) {
                    onSelectIssue(iss.geometry.coordinates)
                  }
                  const target = parcels?.features?.find(f => f.properties?.parcel_id === iss.feature_id)
                  if (target) onSelectParcel(target)
                }}
              >
                <div className="issue-row-top">
                  <b>{iss.issue_id}: {iss.feature_id}</b>
                  <span className={`badge badge-${iss.severity?.toLowerCase()}`}>{iss.severity}</span>
                </div>
                <div className="issue-row-desc">{iss.description}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
