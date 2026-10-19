import React, { useState, useEffect } from 'react'

const PIPELINE_STEPS = [
  { id: 'ortho', label: 'Orthophoto loaded', icon: '📸', desc: 'Validating raster geometry & WGS84 spatial bounds' },
  { id: 'preproc', label: 'Image preprocessing', icon: '⚙️', desc: 'Radiometric normalization & tile grid partitioning' },
  { id: 'parcels', label: 'Parcel segmentation', icon: '📐', desc: 'Boundary edge detection & parcel mask generation' },
  { id: 'buildings', label: 'Building detection', icon: '🏠', desc: 'Rooftop footprint vectorization & setback analysis' },
  { id: 'roads', label: 'Road extraction', icon: '🛣️', desc: 'Centerline network routing & corridor classification' },
  { id: 'polygons', label: 'Polygon generation', icon: '🔷', desc: 'Contour polygonization, simplification & make_valid' },
  { id: 'topology', label: 'Topology validation', icon: '🔍', desc: 'STRtree spatial intersection, overlap & gap detection' }
]

export default function ExtractionModal({
  isOpen,
  onClose,
  onStartExtraction,
  extractionResult,
  isProcessing
}) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isDone, setIsDone] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setCurrentStepIndex(0)
      setIsDone(false)
      return
    }

    if (isProcessing) {
      setIsDone(false)
      const interval = setInterval(() => {
        setCurrentStepIndex(prev => {
          if (prev < PIPELINE_STEPS.length - 1) {
            return prev + 1
          }
          return prev
        })
      }, 550)
      return () => clearInterval(interval)
    } else if (extractionResult) {
      setCurrentStepIndex(PIPELINE_STEPS.length)
      setIsDone(true)
    }
  }, [isOpen, isProcessing, extractionResult])

  if (!isOpen) return null

  const mode = extractionResult?.mode || 'demo'
  const isDemo = mode === 'demo'

  return (
    <div className="modal-backdrop">
      <div className="modal-card extraction-modal">
        <div className="modal-header">
          <div className="modal-title-row">
            <span className="modal-badge-ai">✦ AI PIPELINE</span>
            <h3>{isDone ? 'AI EXTRACTION COMPLETE' : 'Running AI Cadastral Extraction...'}</h3>
          </div>
          {isDone && (
            <button className="modal-close-btn" onClick={onClose}>✕</button>
          )}
        </div>

        <div className="modal-body">
          {/* PROGRESS BAR */}
          <div className="pipeline-progress-track">
            <div
              className={`pipeline-progress-fill ${isDone ? 'done' : ''}`}
              style={{
                width: isDone ? '100%' : `${Math.round(((currentStepIndex + 1) / PIPELINE_STEPS.length) * 100)}%`
              }}
            ></div>
          </div>

          {/* STEP LIST */}
          <div className="pipeline-steps-list">
            {PIPELINE_STEPS.map((step, idx) => {
              const isFinished = isDone || idx < currentStepIndex
              const isCurrent = !isDone && idx === currentStepIndex
              return (
                <div
                  key={step.id}
                  className={`pipeline-step-item ${isFinished ? 'step-done' : ''} ${isCurrent ? 'step-current' : ''}`}
                >
                  <div className="step-icon-status">
                    {isFinished ? (
                      <span className="status-checkmark">✓</span>
                    ) : isCurrent ? (
                      <span className="status-spinner"></span>
                    ) : (
                      <span className="status-pending-bullet">○</span>
                    )}
                  </div>
                  <div className="step-content">
                    <div className="step-label">
                      <span>{step.label}</span>
                      {isFinished && <span className="step-tag-done">Complete</span>}
                      {isCurrent && <span className="step-tag-active">Processing...</span>}
                    </div>
                    <div className="step-desc">{step.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* EXTRACTION RESULTS SUMMARY */}
          {isDone && extractionResult && (
            <div className="extraction-summary-card">
              <div className="summary-banner">
                <span className="summary-banner-icon">🎯</span>
                <div>
                  <div className="summary-banner-title">Feature Extraction Results</div>
                  <div className="summary-banner-subtitle">
                    Spatial polygons and centerlines generated and committed to spatial store
                  </div>
                </div>
              </div>

              <div className="summary-metrics-grid">
                <div className="summary-metric-box">
                  <div className="metric-val">{extractionResult.parcels || 0}</div>
                  <div className="metric-label">Parcels Extracted</div>
                </div>
                <div className="summary-metric-box">
                  <div className="metric-val">{extractionResult.buildings || 0}</div>
                  <div className="metric-label">Buildings Detected</div>
                </div>
                <div className="summary-metric-box">
                  <div className="metric-val">{extractionResult.roads || 0}</div>
                  <div className="metric-label">Roads & Pathways</div>
                </div>
                <div className="summary-metric-box">
                  <div className="metric-val" style={{ color: extractionResult.validation?.overlaps > 0 ? '#dc2626' : '#16a34a' }}>
                    {extractionResult.validation?.overlaps ?? 0}
                  </div>
                  <div className="metric-label">Topology Overlaps</div>
                </div>
              </div>

              {/* TRANSPARENT AI MODE DISCLOSURE */}
              <div className={`ai-mode-disclosure-box ${isDemo ? 'disclosure-demo' : 'disclosure-model'}`}>
                <div className="disclosure-header">
                  <span className="disclosure-badge">
                    {isDemo ? 'AI MODE: DEMO MODE' : 'AI MODE: REAL MODEL'}
                  </span>
                </div>
                <p className="disclosure-text">
                  {isDemo ? (
                    <>
                      <b>Demo Mode Active:</b> Neural network weights (<code>.pt/.onnx</code>) are not present in <code>MODEL_DIR</code>.
                      Features were generated using calibrated parametric cadastral simulation with deliberate real-world topological anomalies (encroachments, self-intersections, slivers) to demonstrate validation and verification workflows.
                    </>
                  ) : (
                    <>
                      <b>Real AI Model Inference Active:</b> Neural network weights loaded and executed on orthophoto imagery.
                    </>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {isDone ? (
            <button className="btn-primary btn-modal-done" onClick={onClose}>
              View Cadastral Map
            </button>
          ) : (
            <button className="btn-secondary" disabled>
              Processing Pipeline...
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
