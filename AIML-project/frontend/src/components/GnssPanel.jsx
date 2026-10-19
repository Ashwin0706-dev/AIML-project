import React from 'react'

export default function GnssPanel({
  selectedParcel,
  gtForm,
  setGtForm,
  groundTruthList,
  onVerifyDecision,
  onStartEditing,
  onLoadDemoGnss,
  busy
}) {
  const aiArea = selectedParcel?.properties?.area || 0
  const surveyArea = gtForm.surveyArea !== '' ? parseFloat(gtForm.surveyArea) : null
  const areaDiff = surveyArea !== null ? Math.abs(aiArea - surveyArea) : null
  const pctDiff = (surveyArea !== null && aiArea > 0) ? ((areaDiff / aiArea) * 100).toFixed(2) : null
  const isDiffHigh = pctDiff !== null && parseFloat(pctDiff) > 5.0

  return (
    <div className="gnss-panel">
      {/* CADASTRAL WORKFLOW STORY */}
      <div className="control-card workflow-card-compact">
        <div className="card-title">Survey Verification Protocol</div>
        <div className="gnss-workflow-breadcrumbs">
          <div className="crumb-step active">
            <span className="crumb-num">1</span>
            <span className="crumb-text">AI Proposes</span>
          </div>
          <span className="crumb-arrow">→</span>
          <div className="crumb-step active">
            <span className="crumb-num">2</span>
            <span className="crumb-text">Surveyor Reviews</span>
          </div>
          <span className="crumb-arrow">→</span>
          <div className="crumb-step active">
            <span className="crumb-num">3</span>
            <span className="crumb-text">GNSS Verification</span>
          </div>
          <span className="crumb-arrow">→</span>
          <div className="crumb-step highlight">
            <span className="crumb-num">4</span>
            <span className="crumb-text">Approved Cadastre</span>
          </div>
        </div>

        <button
          className="btn-secondary btn-full"
          disabled={busy}
          onClick={onLoadDemoGnss}
          style={{ marginTop: '8px' }}
        >
          <span>📍 Load Sample GNSS Checkpoints</span>
        </button>
      </div>

      {/* SELECTED PARCEL FIELD AUDIT */}
      {selectedParcel ? (
        <div className="control-card gnss-audit-card">
          <div className="card-title">
            <span>PARCEL {selectedParcel.properties.parcel_id} AUDIT</span>
            <span className={`status-badge-pill status-${selectedParcel.properties.status || 'pending'}`}>
              {selectedParcel.properties.status || 'Pending'}
            </span>
          </div>

          <div className="gnss-metrics-box">
            <div className="gnss-metric-row">
              <span className="metric-title">AI ESTIMATED AREA:</span>
              <span className="metric-value"><b>{aiArea} m²</b></span>
            </div>

            <div className="gnss-metric-row">
              <span className="metric-title">GNSS SURVEY AREA:</span>
              <span className="metric-value">
                <b>{surveyArea !== null ? `${surveyArea} m²` : 'Enter value below'}</b>
              </span>
            </div>

            {surveyArea !== null && (
              <>
                <div className="gnss-metric-row highlight-diff">
                  <span className="metric-title">AREA DIFFERENCE:</span>
                  <span className="metric-value">{areaDiff.toFixed(2)} m²</span>
                </div>

                <div className="gnss-metric-row highlight-diff">
                  <span className="metric-title">PERCENTAGE DIFFERENCE:</span>
                  <span className="metric-value">{pctDiff}%</span>
                </div>

                <div className="gnss-metric-row status-outcome">
                  <span className="metric-title">STATUS:</span>
                  <span className={`metric-value ${isDiffHigh ? 'status-review' : 'status-ok'}`}>
                    {isDiffHigh ? '⚠ REVIEW REQUIRED (>5% delta)' : '✓ VERIFIED (within tolerance)'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* INPUT FORM FOR SURVEY DATA */}
          <div className="form-group" style={{ marginTop: '10px' }}>
            <label className="form-label">GNSS Rover Measured Area (m²)</label>
            <input
              type="number"
              step="0.1"
              placeholder="Enter field surveyed area..."
              value={gtForm.surveyArea}
              onChange={e => setGtForm({ ...gtForm, surveyArea: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <div className="form-group">
              <label className="form-label">Rover ID</label>
              <input
                type="text"
                value={gtForm.surveyId}
                onChange={e => setGtForm({ ...gtForm, surveyId: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">RTK Accuracy (m)</label>
              <input
                type="text"
                value={gtForm.surveyAccuracy}
                onChange={e => setGtForm({ ...gtForm, surveyAccuracy: e.target.value })}
              />
            </div>
          </div>

          {/* AUDIT ACTIONS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '10px' }}>
            <button
              className="btn-accent btn-full"
              disabled={busy}
              onClick={() => onVerifyDecision('verified')}
            >
              ✓ Verify
            </button>
            <button
              className="btn-danger btn-full"
              disabled={busy}
              onClick={() => onVerifyDecision('rejected')}
            >
              ✕ Reject
            </button>
            <button
              className="btn-secondary btn-full"
              onClick={() => onStartEditing(selectedParcel)}
            >
              ✎ Edit Map
            </button>
          </div>
        </div>
      ) : (
        <div className="control-card empty-state-box">
          <div className="empty-icon">📍</div>
          <div className="empty-title">No Parcel Selected</div>
          <p className="empty-text">Click any parcel on the map or select from the search bar to record GNSS rover field data.</p>
        </div>
      )}

      {/* VERIFICATION AUDIT LOG */}
      <div className="control-card">
        <div className="card-title">
          <span>Survey Verification Log ({groundTruthList.length})</span>
          <span className="badge badge-info">CORS RTK WGS84</span>
        </div>

        <div className="log-table-scroll">
          <table className="gis-table">
            <thead>
              <tr>
                <th>Parcel ID</th>
                <th>AI Area</th>
                <th>Survey Area</th>
                <th>Diff</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {groundTruthList.map((g, idx) => (
                <tr key={idx}>
                  <td><b>{g.parcel_id}</b></td>
                  <td>{g.ai_area} m²</td>
                  <td>{g.gt_area} m²</td>
                  <td>{g.difference} m²</td>
                  <td>
                    <span className={`status-pill status-${g.decision?.toLowerCase()}`}>
                      {g.decision}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
