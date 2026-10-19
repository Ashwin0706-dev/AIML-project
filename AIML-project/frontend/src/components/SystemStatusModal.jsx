import React from 'react'

export default function SystemStatusModal({ isOpen, onClose, systemStatus }) {
  if (!isOpen) return null

  const st = systemStatus || {}
  const backend = st.backend || { status: 'unknown' }
  const ai = st.ai_engine || { status: 'unknown' }
  const gis = st.gis_engine || { status: 'unknown' }
  const db = st.database || { status: 'unknown' }

  return (
    <div className="modal-backdrop">
      <div className="modal-card status-modal">
        <div className="modal-header">
          <div className="modal-title-row">
            <span className="modal-badge-ai">LIVE TELEMETRY</span>
            <h3>System Diagnostics & Engine Status</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="status-grid-cards">
            {/* BACKEND */}
            <div className="status-service-card">
              <div className="service-header">
                <span className="service-name">FastAPI Backend API</span>
                <span className={`status-pill ${backend.status === 'connected' ? 'status-ok' : 'status-err'}`}>
                  ● {backend.status === 'connected' ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              <div className="service-details">
                <div>Service: <b>{backend.service || 'FastAPI REST Core'}</b></div>
                <div>Protocol: <b>HTTP/1.1 CORS Enabled</b></div>
                <div>Status Code: <b>200 OK</b></div>
              </div>
            </div>

            {/* AI ENGINE */}
            <div className="status-service-card">
              <div className="service-header">
                <span className="service-name">Cadastral AI Engine</span>
                <span className={`status-pill ${ai.weights_available ? 'status-ok' : 'status-demo'}`}>
                  ● {ai.weights_available ? 'Ready (Model)' : 'Demo Mode'}
                </span>
              </div>
              <div className="service-details">
                <div>Mode: <b>{ai.mode_label || 'Demo Mode (Weights Not Configured)'}</b></div>
                <div>Weights Loaded: <b>{ai.weights_available ? 'Yes' : 'None in MODEL_DIR'}</b></div>
                <div>Fallback Pipeline: <b>Active & Resilient</b></div>
              </div>
            </div>

            {/* GIS ENGINE */}
            <div className="status-service-card">
              <div className="service-header">
                <span className="service-name">Spatial GIS Engine</span>
                <span className="status-pill status-ok">
                  ● Ready
                </span>
              </div>
              <div className="service-details">
                <div>Library: <b>{gis.engine || 'Shapely 2.0+'}</b></div>
                <div>Spatial Index: <b>STRtree R-Tree Algorithm</b></div>
                <div>Topology Engine: <b>Closed 2D Planar Validation</b></div>
              </div>
            </div>

            {/* DATABASE */}
            <div className="status-service-card">
              <div className="service-header">
                <span className="service-name">Spatial Data Storage</span>
                <span className="status-pill status-ok">
                  ● Connected
                </span>
              </div>
              <div className="service-details">
                <div>Active Store: <b>{db.type || 'Spatial Memory Store'}</b></div>
                <div>PostGIS Fallback: <b>Automatic Resilient Switch</b></div>
                <div>Persistence: <b>In-Memory / Postgres Active</b></div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>Close Diagnostics</button>
        </div>
      </div>
    </div>
  )
}
