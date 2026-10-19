import React from 'react'

export default function StatsDock({ statistics, onTabChange }) {
  const totalParcels = statistics?.total_parcels || 0
  const buildings = statistics?.total_buildings || 0
  const roads = statistics?.total_roads || 0
  const validParcels = statistics?.valid_parcels ?? totalParcels
  const topologyIssues = statistics?.topology_issues ?? 0
  const pending = statistics?.pending_verification ?? (totalParcels - (statistics?.gnss_verified || 0))
  const gnssVerified = statistics?.gnss_verified ?? (statistics?.ground_truth_verified || 0)
  const avgConfidence = statistics?.avg_confidence ?? 0

  return (
    <footer className="bottom-dock">
      <div className="dock-item" onClick={() => onTabChange && onTabChange('extraction')} title="Total parcels detected in current survey area">
        <span className="dock-val">{totalParcels}</span>
        <span className="dock-label">TOTAL PARCELS</span>
      </div>

      <div className="dock-item" onClick={() => onTabChange && onTabChange('layers')} title="Building rooftop footprints detected">
        <span className="dock-val" style={{ color: '#ea580c' }}>{buildings}</span>
        <span className="dock-label">BUILDINGS</span>
      </div>

      <div className="dock-item" onClick={() => onTabChange && onTabChange('layers')} title="Road centerlines and pathway corridors">
        <span className="dock-val" style={{ color: '#d97706' }}>{roads}</span>
        <span className="dock-label">ROADS</span>
      </div>

      <div className="dock-item" onClick={() => onTabChange && onTabChange('topology')} title="Parcels satisfying planar topology rules">
        <span className="dock-val" style={{ color: '#16a34a' }}>{validParcels}</span>
        <span className="dock-label">VALID PARCELS</span>
      </div>

      <div className="dock-item" onClick={() => onTabChange && onTabChange('topology')} title="Detected boundary overlaps, slivers, gaps, or self-intersections">
        <span className="dock-val" style={{ color: topologyIssues > 0 ? '#dc2626' : '#16a34a' }}>
          {topologyIssues}
        </span>
        <span className="dock-label">TOPOLOGY ISSUES</span>
      </div>

      <div className="dock-item" onClick={() => onTabChange && onTabChange('reviewQueue')} title="Parcels awaiting surveyor review">
        <span className="dock-val" style={{ color: '#2563eb' }}>{pending}</span>
        <span className="dock-label">PENDING VERIFICATION</span>
      </div>

      <div className="dock-item" onClick={() => onTabChange && onTabChange('gt')} title="Parcels verified with ground-truth GNSS rover coordinates">
        <span className="dock-val" style={{ color: '#059669' }}>{gnssVerified}</span>
        <span className="dock-label">GNSS VERIFIED</span>
      </div>

      <div className="dock-item" onClick={() => onTabChange && onTabChange('evaluation')} title="Mean AI boundary certainty confidence (not model accuracy)">
        <span className="dock-val" style={{ color: '#0284c7' }}>{avgConfidence}%</span>
        <span className="dock-label">AVG AI CONFIDENCE</span>
      </div>
    </footer>
  )
}
