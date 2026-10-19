import React from 'react'

export default function ComparisonPanel({
  comparisons,
  onRecompute,
  onUploadExisting,
  busy
}) {
  return (
    <div className="comparison-panel">
      <div className="control-card">
        <div className="card-title">
          <span>Cadastral Overlays & Differences</span>
          <span className="badge badge-info">Spatial Intersection</span>
        </div>

        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
          Quantifies spatial intersection, encroachment, and area changes between baseline municipal GIS records and newly extracted AI drone boundaries.
        </p>

        {/* DATASET LABELS */}
        <div className="dataset-label-row">
          <div className="dataset-chip chip-reference">
            <span className="chip-indicator-sq indicator-purple"></span>
            <div>
              <div className="chip-title">REFERENCE DATA</div>
              <div className="chip-subtitle">Existing Municipal Cadastre GIS</div>
            </div>
          </div>

          <span className="vs-badge">VS</span>

          <div className="dataset-chip chip-ai">
            <span className="chip-indicator-sq indicator-blue"></span>
            <div>
              <div className="chip-title">AI-GENERATED DATA</div>
              <div className="chip-subtitle">Drone Feature Segmentation</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '10px' }}>
          <button
            className="btn-primary"
            disabled={busy}
            onClick={onRecompute}
          >
            <span>↻ Recompute Overlays</span>
          </button>

          <label className="file-input-wrapper-btn">
            <span>📁 Upload GeoJSON</span>
            <input type="file" accept=".geojson,.json" onChange={onUploadExisting} />
          </label>
        </div>
      </div>

      {/* OVERLAY RESULTS TABLE */}
      <div className="control-card">
        <div className="card-title">
          <span>Spatial Intersection Log ({comparisons.length})</span>
          <span className="badge badge-neutral">EPSG:4326</span>
        </div>

        <div className="comparison-table-scroll">
          <table className="gis-table">
            <thead>
              <tr>
                <th>AI Parcel ID</th>
                <th>Municipal Ref ID</th>
                <th>AI Area</th>
                <th>Ref Area</th>
                <th>Area Diff</th>
                <th>Overlap</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((c, i) => (
                <tr key={i}>
                  <td><b>{c.ai_parcel_id}</b></td>
                  <td><span className="ref-tag">{c.existing_parcel_id}</span></td>
                  <td>{c.ai_area} m²</td>
                  <td>{c.existing_area} m²</td>
                  <td>
                    <span className={c.difference_sqm > 20 ? 'diff-high' : 'diff-normal'}>
                      {c.difference_sqm} m²
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${c.overlap_percentage >= 90 ? 'badge-high' : (c.overlap_percentage >= 70 ? 'badge-med' : 'badge-low')}`}>
                      {c.overlap_percentage}%
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
