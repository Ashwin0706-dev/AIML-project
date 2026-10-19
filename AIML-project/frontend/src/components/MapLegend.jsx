import React, { useState } from 'react'

export default function MapLegend() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={`map-floating-legend ${collapsed ? 'collapsed' : ''}`}>
      <div className="legend-header" onClick={() => setCollapsed(!collapsed)}>
        <span>🗺 Map Layer Legend</span>
        <button className="legend-toggle-btn">{collapsed ? '+' : '−'}</button>
      </div>

      {!collapsed && (
        <div className="legend-body">
          <div className="legend-item">
            <span className="legend-symbol" style={{ background: '#2563eb', border: '1px solid #1e40af' }}></span>
            <span>AI Cadastral Parcels</span>
          </div>
          <div className="legend-item">
            <span className="legend-symbol" style={{ background: '#16a34a', border: '1px solid #15803d' }}></span>
            <span>GNSS Verified Parcels</span>
          </div>
          <div className="legend-item">
            <span className="legend-symbol" style={{ background: '#ea580c' }}></span>
            <span>Buildings (Rooftops)</span>
          </div>
          <div className="legend-item">
            <span className="legend-symbol" style={{ background: '#eab308' }}></span>
            <span>Main Roads & Avenues</span>
          </div>
          <div className="legend-item">
            <span className="legend-symbol" style={{ background: '#06b6d4', border: '1px dashed #fff' }}></span>
            <span>Pathways & Lanes</span>
          </div>
          <div className="legend-item">
            <span className="legend-symbol symbol-circle" style={{ background: '#ef4444' }}></span>
            <span>Topology Issue Anomaly</span>
          </div>
          <div className="legend-item">
            <span className="legend-symbol symbol-circle" style={{ background: '#22c55e' }}></span>
            <span>GNSS RTK Checkpoint</span>
          </div>
          <div className="legend-item">
            <span className="legend-symbol" style={{ background: 'transparent', border: '2px dashed #9333ea' }}></span>
            <span>Municipal GIS Reference</span>
          </div>
          <div className="legend-item">
            <span className="legend-symbol" style={{ background: 'transparent', border: '2px dashed #f59e0b' }}></span>
            <span>Low Confidence (&lt;88%)</span>
          </div>
        </div>
      )}
    </div>
  )
}
