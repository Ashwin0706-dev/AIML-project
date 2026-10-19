import React from 'react'

const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'UPLOAD ORTHOPHOTO',
    desc: 'High-resolution drone orthomosaics (GeoTIFF/PNG) and digital surface models (DSM) are ingested with spatial coordinate reference system (CRS).'
  },
  {
    step: '02',
    title: 'AI EXTRACTS FEATURES',
    desc: 'Computer vision pipeline identifies cadastral boundary edges, building rooftops, and road networks from orthorectified imagery.'
  },
  {
    step: '03',
    title: 'GENERATE GIS POLYGONS',
    desc: 'Raster masks are vectorized into discrete, simplified planar polygons with assigned land-use classifications and boundary confidence scores.'
  },
  {
    step: '04',
    title: 'VALIDATE TOPOLOGY',
    desc: 'Shapely spatial algorithms detect boundary overlaps (encroachment), self-intersections, cadastral voids/gaps, slivers, and duplicate shapes.'
  },
  {
    step: '05',
    title: 'HUMAN REVIEW',
    desc: 'Surveyors inspect flagged anomalies in the review queue, interactively adjusting vertex boundaries on the live map canvas.'
  },
  {
    step: '06',
    title: 'GNSS VERIFICATION',
    desc: 'Field surveyors capture centimeter-accurate RTK/CORS rover checkpoints to compute area differences and certify parcel boundaries.'
  },
  {
    step: '07',
    title: 'EXPORT CADASTRAL DATA',
    desc: 'Validated cadastre is exported as standards-compliant GeoJSON layers and formal municipal Cadastral Survey Reports.'
  }
]

export default function WorkflowGuide({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <div className="modal-backdrop">
      <div className="modal-card workflow-modal">
        <div className="modal-header">
          <div className="modal-title-row">
            <span className="modal-badge-ai">PIPELINE ARCHITECTURE</span>
            <h3>How It Works: AI-Assisted Cadastral Mapping</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="workflow-diagram">
            {WORKFLOW_STEPS.map((s, idx) => (
              <div key={s.step} className="workflow-step-card">
                <div className="workflow-step-num">{s.step}</div>
                <div className="workflow-step-body">
                  <div className="workflow-step-title">{s.title}</div>
                  <div className="workflow-step-desc">{s.desc}</div>
                </div>
                {idx < WORKFLOW_STEPS.length - 1 && (
                  <div className="workflow-connector">↓</div>
                )}
              </div>
            ))}
          </div>

          <div className="workflow-philosophy-banner">
            <b>Core Concept:</b> AI-assisted urban cadastral mapping with human-in-the-loop verification.
            AI accelerates feature extraction by 85%, while certified surveyors maintain legal accuracy through topology validation and GNSS rover verification.
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>Close Guide</button>
        </div>
      </div>
    </div>
  )
}
