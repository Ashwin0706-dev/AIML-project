import React from 'react'

export default function Header({
  statistics,
  systemStatus,
  onRunExtraction,
  onLoadDemo,
  onOpenReport,
  onOpenWorkflow,
  onOpenSystemStatus,
  presentationMode,
  setPresentationMode,
  busy
}) {
  const isDemo = statistics?.mode === 'demo' || systemStatus?.ai_engine?.mode === 'demo'

  return (
    <header className="topbar">
      <div className="brand-section">
        <div className="brand-icon">GIS</div>
        <div className="brand-text-container">
          <div className="brand-title-row">
            <span className="brand-title">AI URBAN CADASTRAL MAPPING</span>
            <span className={`mode-pill ${isDemo ? 'mode-demo' : 'mode-model'}`}>
              {isDemo ? 'DEMO MODE' : 'REAL AI MODEL'}
            </span>
          </div>
          <span className="brand-subtitle">
            AI-Assisted Urban Parcel Extraction, Validation & GNSS Verification
          </span>
        </div>
      </div>

      <div className="topbar-actions">
        {/* System Status quick indicator */}
        <button
          className="btn-status-indicator"
          onClick={onOpenSystemStatus}
          title="Click to view real-time system engine status"
        >
          <span className="status-dot dot-online"></span>
          <span>System Status</span>
        </button>

        {/* Workflow Guide */}
        <button
          className="btn-secondary"
          onClick={onOpenWorkflow}
          title="View how the 7-step cadastral pipeline works"
        >
          <span>ℹ Workflow</span>
        </button>

        {/* Load Demo Dataset button */}
        <button
          className="btn-demo-data"
          disabled={busy}
          onClick={onLoadDemo}
          title="Initialize complete sample parcel, building, road, and GNSS dataset"
        >
          <span className="btn-icon">⚡</span>
          <span>LOAD DEMO DATASET</span>
        </button>

        {/* Generate Survey Report */}
        <button
          className="btn-secondary"
          onClick={onOpenReport}
          title="Generate formal Cadastral Survey Report"
        >
          <span>📄 Survey Report</span>
        </button>

        {/* Presentation Mode Toggle */}
        <button
          className={`btn-presentation ${presentationMode ? 'active' : ''}`}
          onClick={() => setPresentationMode(!presentationMode)}
          title="Toggle Judge / Projector Presentation Mode"
        >
          <span>{presentationMode ? '✕ Exit Presentation' : '📽 Presentation Mode'}</span>
        </button>

        {/* Primary AI Extraction Action */}
        <button
          className="btn-primary btn-run-ai"
          disabled={busy}
          onClick={onRunExtraction}
          title="Run end-to-end cadastral feature extraction pipeline"
        >
          <span className="btn-sparkle">✦</span>
          <span>RUN AI EXTRACTION</span>
        </button>
      </div>
    </header>
  )
}
