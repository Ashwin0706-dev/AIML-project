import React, { useState, useRef, useEffect, useCallback } from 'react'
import { api } from '../services/api'

export default function BeforeAfterSlider({ parcels, buildings, roads }) {
  const [sliderPos, setSliderPos] = useState(50) // percentage 0 - 100
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef(null)

  const handleMove = useCallback((clientX) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    const pct = Math.round((x / rect.width) * 100)
    setSliderPos(pct)
  }, [])

  const handleTouchMove = (e) => {
    if (e.touches && e.touches[0]) {
      handleMove(e.touches[0].clientX)
    }
  }

  const handleMouseMove = (e) => {
    if (isDragging) {
      handleMove(e.clientX)
    }
  }

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false)
    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [])

  const sampleImgSrc = '/sample_urban_drone.png'

  return (
    <div className="comparison-slider-container">
      <div className="comparison-slider-header">
        <div>
          <h4>Orthophoto vs AI Cadastral Map Comparison</h4>
          <p className="comparison-slider-subtitle">
            Drag the divider to compare the raw drone orthomosaic against extracted vector parcels, buildings, and roads.
          </p>
        </div>

        {/* PRESET BUTTONS */}
        <div className="preset-buttons">
          <button
            className={`btn-preset ${sliderPos === 25 ? 'active' : ''}`}
            onClick={() => setSliderPos(25)}
          >
            25% Split
          </button>
          <button
            className={`btn-preset ${sliderPos === 50 ? 'active' : ''}`}
            onClick={() => setSliderPos(50)}
          >
            50% Split
          </button>
          <button
            className={`btn-preset ${sliderPos === 75 ? 'active' : ''}`}
            onClick={() => setSliderPos(75)}
          >
            75% Split
          </button>
        </div>
      </div>

      {/* INTERACTIVE COMPARISON VIEWER */}
      <div
        className="slider-viewport"
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
        onMouseDown={() => setIsDragging(true)}
      >
        {/* UNDER LAYER: AI-GENERATED CADASTRAL MAP (RIGHT / FULL) */}
        <div className="layer-cadastral">
          <img
            src={sampleImgSrc}
            alt="AI Cadastral Extracted Vector Layer"
            className="slider-base-img"
          />
          {/* SVG Vector Overlay for Parcels, Buildings, Roads */}
          <svg className="cadastral-vector-overlay" viewBox="0 0 1000 1000" preserveAspectRatio="none">
            {/* Roads */}
            <rect x="0" y="210" width="1000" height="48" fill="#eab308" opacity="0.85" />
            <line x1="0" y1="234" x2="1000" y2="234" stroke="#ffffff" strokeWidth="3" strokeDasharray="14 10" />

            <rect x="0" y="690" width="1000" height="48" fill="#eab308" opacity="0.85" />
            <line x1="0" y1="714" x2="1000" y2="714" stroke="#ffffff" strokeWidth="3" strokeDasharray="14 10" />

            <rect x="270" y="0" width="48" height="1000" fill="#eab308" opacity="0.85" />
            <line x1="294" y1="0" x2="294" y2="1000" stroke="#ffffff" strokeWidth="3" strokeDasharray="14 10" />

            <rect x="670" y="0" width="48" height="1000" fill="#eab308" opacity="0.85" />
            <line x1="694" y1="0" x2="694" y2="1000" stroke="#ffffff" strokeWidth="3" strokeDasharray="14 10" />

            {/* Block 1 (Top-Left) Cadastral Parcel Boundaries */}
            <rect x="25" y="25" width="220" height="170" fill="#2563eb" fillOpacity="0.2" stroke="#2563eb" strokeWidth="2.5" />
            <rect x="35" y="35" width="55" height="40" fill="#ea580c" fillOpacity="0.65" stroke="#c2410c" strokeWidth="1.5" />
            <rect x="105" y="35" width="55" height="40" fill="#ea580c" fillOpacity="0.65" stroke="#c2410c" strokeWidth="1.5" />
            <rect x="175" y="35" width="55" height="40" fill="#ea580c" fillOpacity="0.65" stroke="#c2410c" strokeWidth="1.5" />

            {/* Block 2 (Center-Top) Cadastral Parcels */}
            <rect x="340" y="25" width="310" height="170" fill="#2563eb" fillOpacity="0.2" stroke="#2563eb" strokeWidth="2.5" />
            <rect x="360" y="35" width="45" height="35" fill="#ea580c" fillOpacity="0.65" stroke="#c2410c" strokeWidth="1.5" />
            <rect x="420" y="35" width="45" height="35" fill="#ea580c" fillOpacity="0.65" stroke="#c2410c" strokeWidth="1.5" />
            <rect x="480" y="35" width="45" height="35" fill="#ea580c" fillOpacity="0.65" stroke="#c2410c" strokeWidth="1.5" />
            <rect x="540" y="35" width="45" height="35" fill="#ea580c" fillOpacity="0.65" stroke="#c2410c" strokeWidth="1.5" />

            {/* Block 3 (Top-Right) Cadastral Parcels */}
            <rect x="740" y="25" width="235" height="170" fill="#2563eb" fillOpacity="0.2" stroke="#2563eb" strokeWidth="2.5" />
            <rect x="760" y="35" width="50" height="35" fill="#ea580c" fillOpacity="0.65" stroke="#c2410c" strokeWidth="1.5" />
            <rect x="830" y="35" width="50" height="35" fill="#ea580c" fillOpacity="0.65" stroke="#c2410c" strokeWidth="1.5" />
            <rect x="900" y="35" width="50" height="35" fill="#ea580c" fillOpacity="0.65" stroke="#c2410c" strokeWidth="1.5" />

            {/* Block 4 (Center Heart) */}
            <rect x="340" y="280" width="310" height="390" fill="#2563eb" fillOpacity="0.2" stroke="#2563eb" strokeWidth="2.5" />
            <rect x="365" y="305" width="45" height="35" fill="#ea580c" fillOpacity="0.65" stroke="#c2410c" strokeWidth="1.5" />
            <rect x="425" y="305" width="45" height="35" fill="#ea580c" fillOpacity="0.65" stroke="#c2410c" strokeWidth="1.5" />
            <rect x="485" y="305" width="45" height="35" fill="#ea580c" fillOpacity="0.65" stroke="#c2410c" strokeWidth="1.5" />
            <rect x="545" y="305" width="45" height="35" fill="#ea580c" fillOpacity="0.65" stroke="#c2410c" strokeWidth="1.5" />
            <rect x="365" y="360" width="45" height="35" fill="#ea580c" fillOpacity="0.65" stroke="#c2410c" strokeWidth="1.5" />
            <rect x="425" y="360" width="45" height="35" fill="#ea580c" fillOpacity="0.65" stroke="#c2410c" strokeWidth="1.5" />
            <rect x="485" y="360" width="45" height="35" fill="#ea580c" fillOpacity="0.65" stroke="#c2410c" strokeWidth="1.5" />
            <rect x="545" y="360" width="45" height="35" fill="#ea580c" fillOpacity="0.65" stroke="#c2410c" strokeWidth="1.5" />

            {/* Block 5 (Bottom Sectors) */}
            <rect x="340" y="760" width="310" height="215" fill="#2563eb" fillOpacity="0.2" stroke="#2563eb" strokeWidth="2.5" />
            <rect x="25" y="760" width="220" height="215" fill="#2563eb" fillOpacity="0.2" stroke="#2563eb" strokeWidth="2.5" />
            <rect x="740" y="760" width="235" height="215" fill="#2563eb" fillOpacity="0.2" stroke="#2563eb" strokeWidth="2.5" />
          </svg>
          <div className="view-label label-right">AI CADASTRAL MAP</div>
        </div>

        {/* OVER LAYER: RAW ORTHOPHOTO (CLIPPED BY SLIDER POSITION) */}
        <div
          className="layer-raw-clipped"
          style={{ width: `${sliderPos}%` }}
        >
          <img
            src={sampleImgSrc}
            alt="Raw Orthophoto Drone Image"
            className="slider-raw-img"
          />
          <div className="view-label label-left">RAW ORTHOPHOTO</div>
        </div>

        {/* SLIDER HANDLE */}
        <div
          className="slider-divider"
          style={{ left: `${sliderPos}%` }}
          onMouseDown={() => setIsDragging(true)}
          onTouchStart={() => setIsDragging(true)}
        >
          <div className="slider-handle">
            <span>◀▶</span>
          </div>
        </div>
      </div>

      {/* LEGEND BAR */}
      <div className="comparison-legend-bar">
        <div className="legend-chip">
          <span className="chip-indicator" style={{ background: '#2563eb', border: '1px solid #1d4ed8' }}></span>
          <span>Parcel Boundaries</span>
        </div>
        <div className="legend-chip">
          <span className="chip-indicator" style={{ background: '#ea580c' }}></span>
          <span>Buildings (Rooftops)</span>
        </div>
        <div className="legend-chip">
          <span className="chip-indicator" style={{ background: '#eab308' }}></span>
          <span>Road Network</span>
        </div>
        <div className="legend-chip">
          <span className="chip-indicator" style={{ background: '#708d5c' }}></span>
          <span>Raw Ground Orthomosaic</span>
        </div>
      </div>
    </div>
  )
}
