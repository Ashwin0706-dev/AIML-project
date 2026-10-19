import React from 'react'

export default function ReviewQueue({
  issues,
  parcels,
  onSelectIssue,
  onSelectParcel,
  onApproveParcel,
  onRejectParcel,
  onEditParcel,
  onValidateAgain,
  busy
}) {
  // Aggregate parcels with anomalies, low confidence, or validation issues
  const reviewItems = []

  // 1. Parcels directly identified in topology issues
  const issueParcelIds = new Set()
  issues.forEach(iss => {
    issueParcelIds.add(iss.feature_id)
    const feat = parcels?.features?.find(f => f.properties?.parcel_id === iss.feature_id)
    reviewItems.push({
      id: iss.issue_id,
      parcelId: iss.feature_id,
      issueType: iss.issue_type,
      description: iss.description,
      severity: iss.severity,
      confidence: feat?.properties?.confidence ? Math.round(feat.properties.confidence * 100) : 85,
      status: feat?.properties?.status || 'Needs Review',
      feature: feat,
      coordinates: iss.geometry?.coordinates
    })
  })

  // 2. Any parcel with low confidence (< 88%) not already in review
  parcels?.features?.forEach(f => {
    const pid = f.properties?.parcel_id
    if (!issueParcelIds.has(pid) && (f.properties?.confidence || 1) < 0.88) {
      reviewItems.push({
        id: `CONF-${pid}`,
        parcelId: pid,
        issueType: 'Low Confidence',
        description: `AI boundary certainty (${Math.round((f.properties.confidence || 0) * 100)}%) is below standard threshold`,
        severity: 'LOW',
        confidence: Math.round((f.properties.confidence || 0) * 100),
        status: f.properties?.status || 'Needs Review',
        feature: f,
        coordinates: f.geometry?.coordinates?.[0]?.[0]
      })
    }
  })

  return (
    <div className="review-queue-panel">
      <div className="review-queue-header">
        <div>
          <div className="panel-headline">
            <span className="badge-alert-count">{reviewItems.length}</span>
            <span>AI REVIEW QUEUE</span>
          </div>
          <p className="panel-subtext">
            Parcels flagged by topological geometry rules or low AI boundary confidence requiring surveyor human-in-the-loop sign-off.
          </p>
        </div>

        <button
          className="btn-primary btn-validate-action"
          disabled={busy}
          onClick={onValidateAgain}
          title="Re-run Shapely planar topology validation against updated geometries"
        >
          <span>↻ VALIDATE AGAIN</span>
        </button>
      </div>

      {reviewItems.length === 0 ? (
        <div className="empty-state-card">
          <div className="empty-icon">✓</div>
          <div className="empty-title">Queue Clear: All Geometries Satisfy Cadastral Criteria</div>
          <p className="empty-desc">
            No boundary overlaps, self-intersections, slivers, or low-confidence polygons detected.
          </p>
        </div>
      ) : (
        <div className="review-table-container">
          <table className="gis-table review-table">
            <thead>
              <tr>
                <th>Parcel ID</th>
                <th>Detected Issue</th>
                <th>AI Confidence</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviewItems.map((item) => (
                <tr
                  key={item.id}
                  className="review-row"
                  onClick={() => {
                    if (item.feature) onSelectParcel(item.feature)
                    if (item.coordinates) onSelectIssue(item.coordinates)
                  }}
                >
                  <td className="col-pid">
                    <b>{item.parcelId}</b>
                  </td>
                  <td className="col-issue">
                    <span className={`issue-tag severity-${item.severity?.toLowerCase()}`}>
                      {item.issueType?.replace('_', ' ')}
                    </span>
                    <span className="issue-desc-snip">{item.description}</span>
                  </td>
                  <td className="col-conf">
                    <span className="conf-value">{item.confidence}%</span>
                  </td>
                  <td className="col-status">
                    <span className={`status-pill status-${item.status?.toLowerCase()}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="col-actions" onClick={e => e.stopPropagation()}>
                    <button
                      className="btn-table-action btn-approve"
                      title="Approve parcel boundary"
                      onClick={() => onApproveParcel(item.parcelId)}
                    >
                      ✓ Approve
                    </button>
                    <button
                      className="btn-table-action btn-reject"
                      title="Reject parcel"
                      onClick={() => onRejectParcel(item.parcelId)}
                    >
                      ✕ Reject
                    </button>
                    {item.feature && (
                      <button
                        className="btn-table-action btn-edit"
                        title="Edit boundary vertices on map"
                        onClick={() => onEditParcel(item.feature)}
                      >
                        ✎ Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
