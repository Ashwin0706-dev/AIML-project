import React, { useRef } from 'react'

export default function SurveyReportModal({ isOpen, onClose, reportData, statistics }) {
  const reportRef = useRef(null)

  if (!isOpen) return null

  const rep = reportData || {}
  const inv = rep.inventory || statistics || {}
  const aiInfo = rep.ai_model || {}
  const topo = rep.topology_summary || {}
  const gnss = rep.gnss_verification_summary || {}

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(rep, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cadastral_survey_report_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card report-modal">
        <div className="modal-header">
          <div className="modal-title-row">
            <span className="modal-badge-ai">OFFICIAL DOCUMENT</span>
            <h3>{rep.title || 'AI URBAN CADASTRAL MAPPING REPORT'}</h3>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-secondary" onClick={handleDownloadJson}>
              📥 Download JSON
            </button>
            <button className="btn-accent" onClick={handlePrint}>
              🖨 Print / Save PDF
            </button>
            <button className="modal-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="modal-body report-printable-content" ref={reportRef}>
          {/* REPORT HEADER */}
          <div className="report-doc-header">
            <div className="doc-seal">CADASTRE</div>
            <div>
              <h2 className="doc-main-title">AI URBAN CADASTRAL MAPPING REPORT</h2>
              <div className="doc-sub-title">Spatial Audit, Topology Certification & GNSS Verification Log</div>
            </div>
          </div>

          <div className="report-meta-grid">
            <div className="report-meta-item">
              <span className="meta-label">Project Name:</span>
              <span className="meta-val">{rep.project?.name || 'Tiruchengode Urban Cadastral Zone A'}</span>
            </div>
            <div className="report-meta-item">
              <span className="meta-label">Survey Area:</span>
              <span className="meta-val">{rep.project?.survey_area || 'Tiruchengode Sector 4 (WGS84 EPSG:4326)'}</span>
            </div>
            <div className="report-meta-item">
              <span className="meta-label">Date of Report:</span>
              <span className="meta-val">{rep.project?.date || new Date().toISOString().slice(0, 10)}</span>
            </div>
            <div className="report-meta-item">
              <span className="meta-label">Coordinate System:</span>
              <span className="meta-val">{rep.project?.coordinate_system || 'EPSG:4326 (WGS84)'}</span>
            </div>
          </div>

          {/* INVENTORY TABLE */}
          <div className="report-section">
            <h4 className="report-section-title">1. Cadastral Spatial Inventory</h4>
            <div className="report-inventory-grid">
              <div className="inventory-card">
                <div className="inv-num">{inv.total_parcels || 0}</div>
                <div className="inv-label">Total Parcels</div>
              </div>
              <div className="inventory-card">
                <div className="inv-num">{inv.buildings || inv.total_buildings || 0}</div>
                <div className="inv-label">Buildings</div>
              </div>
              <div className="inventory-card">
                <div className="inv-num">{inv.roads || inv.total_roads || 0}</div>
                <div className="inv-label">Roads</div>
              </div>
              <div className="inventory-card">
                <div className="inv-num" style={{ color: '#16a34a' }}>{inv.valid_parcels || 0}</div>
                <div className="inv-label">Valid Parcels</div>
              </div>
              <div className="inventory-card">
                <div className="inv-num" style={{ color: (inv.topology_issues || 0) > 0 ? '#dc2626' : '#16a34a' }}>
                  {inv.topology_issues || 0}
                </div>
                <div className="inv-label">Topology Issues</div>
              </div>
              <div className="inventory-card">
                <div className="inv-num" style={{ color: '#2563eb' }}>
                  {inv.pending_verification ?? 0}
                </div>
                <div className="inv-label">Pending Verification</div>
              </div>
              <div className="inventory-card">
                <div className="inv-num" style={{ color: '#059669' }}>
                  {inv.gnss_verified ?? (inv.ground_truth_verified || 0)}
                </div>
                <div className="inv-label">GNSS Verified</div>
              </div>
            </div>
          </div>

          {/* AI MODEL INFORMATION */}
          <div className="report-section">
            <h4 className="report-section-title">2. AI Model & Extraction Metadata</h4>
            <table className="report-table">
              <tbody>
                <tr>
                  <td><b>AI Model Mode:</b></td>
                  <td>
                    <span className="badge badge-warning">{aiInfo.mode || 'DEMO MODE'}</span>
                  </td>
                </tr>
                <tr>
                  <td><b>Architecture:</b></td>
                  <td>Multi-Task Cadastral Segmentation Interface (U-Net / DeepLabV3+ with Shapely Vectorizer)</td>
                </tr>
                <tr>
                  <td><b>Weights Configured:</b></td>
                  <td>{aiInfo.weights_configured ? 'Yes (Trained PyTorch weights)' : 'No (Demo Fallback Pipeline active)'}</td>
                </tr>
                <tr>
                  <td><b>Average AI Confidence:</b></td>
                  <td>{aiInfo.average_confidence || `${statistics?.avg_confidence || 0}%`}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* TOPOLOGY SUMMARY */}
          <div className="report-section">
            <h4 className="report-section-title">3. Spatial Topology Audit Summary</h4>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Validation Criterion</th>
                  <th>Count</th>
                  <th>Threshold / Rule</th>
                  <th>Compliance Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Overlapping Boundaries</td>
                  <td>{topo.breakdown?.overlaps ?? 0}</td>
                  <td>Area ratio &gt; 1.5%</td>
                  <td>{(topo.breakdown?.overlaps || 0) === 0 ? '✓ PASS' : '⚠ ENFORCEMENT REQUIRED'}</td>
                </tr>
                <tr>
                  <td>Cadastral Voids / Gaps</td>
                  <td>{topo.breakdown?.gaps ?? 0}</td>
                  <td>Enclosed hole &gt; 5 m²</td>
                  <td>{(topo.breakdown?.gaps || 0) === 0 ? '✓ PASS' : '⚠ AUDIT REQUIRED'}</td>
                </tr>
                <tr>
                  <td>Invalid Geometries</td>
                  <td>{topo.breakdown?.invalid_geometries ?? 0}</td>
                  <td>Self-intersections / bow-ties</td>
                  <td>{(topo.breakdown?.invalid_geometries || 0) === 0 ? '✓ PASS' : '⚠ CORRECTION REQUIRED'}</td>
                </tr>
                <tr>
                  <td>Duplicate Geometries</td>
                  <td>{topo.breakdown?.duplicates ?? 0}</td>
                  <td>Identical WKB hex hash</td>
                  <td>{(topo.breakdown?.duplicates || 0) === 0 ? '✓ PASS' : '⚠ MERGE REQUIRED'}</td>
                </tr>
                <tr>
                  <td>Sliver Polygons</td>
                  <td>{topo.breakdown?.sliver_polygons ?? 0}</td>
                  <td>Area &lt; 35 m²</td>
                  <td>{(topo.breakdown?.sliver_polygons || 0) === 0 ? '✓ PASS' : '⚠ MERGE REQUIRED'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* GNSS SUMMARY */}
          <div className="report-section">
            <h4 className="report-section-title">4. GNSS Rover Field Survey Verification Summary</h4>
            <div style={{ marginBottom: '8px', fontSize: '12px' }}>
              Total RTK Checkpoints: <b>{gnss.total_checkpoints || 0}</b> |
              Verified: <b style={{ color: '#16a34a' }}>{gnss.verified || 0}</b> |
              Rejected / Disputed: <b style={{ color: '#dc2626' }}>{gnss.rejected || 0}</b>
            </div>

            {gnss.checkpoints && gnss.checkpoints.length > 0 && (
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Survey ID</th>
                    <th>Parcel ID</th>
                    <th>AI Area</th>
                    <th>Survey Area</th>
                    <th>Difference</th>
                    <th>Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {gnss.checkpoints.slice(0, 8).map((pt, i) => (
                    <tr key={i}>
                      <td>{pt.survey_id}</td>
                      <td><b>{pt.parcel_id}</b></td>
                      <td>{pt.ai_area} m²</td>
                      <td>{pt.gt_area} m²</td>
                      <td>{pt.difference} m²</td>
                      <td><b>{pt.decision}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* SIGN-OFF SECTION */}
          <div className="report-sign-off-grid">
            <div className="sign-off-box">
              <div className="sign-line"></div>
              <div className="sign-title">AI System Pipeline Engineer</div>
              <div className="sign-sub">Automated Extraction System</div>
            </div>
            <div className="sign-off-box">
              <div className="sign-line"></div>
              <div className="sign-title">Certified Cadastral Surveyor</div>
              <div className="sign-sub">GNSS Field Verification Officer</div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={handlePrint}>Print Survey Report</button>
        </div>
      </div>
    </div>
  )
}
