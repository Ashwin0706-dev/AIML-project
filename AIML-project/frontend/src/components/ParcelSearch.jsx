import React, { useState } from 'react'

export default function ParcelSearch({ parcels, onSelectParcel }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)

  const handleSearch = (term) => {
    setSearchTerm(term)
    if (!term.trim() || !parcels?.features) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    const clean = term.trim().toUpperCase()
    const matches = parcels.features
      .filter(f => {
        const pid = f.properties?.parcel_id?.toUpperCase() || ''
        return pid.includes(clean)
      })
      .slice(0, 8)

    setSearchResults(matches)
    setIsSearching(true)
  }

  const handlePick = (feature) => {
    onSelectParcel(feature)
    setSearchTerm(feature.properties.parcel_id)
    setIsSearching(false)
  }

  return (
    <div className="parcel-search-bar">
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          className="search-input"
          placeholder="SEARCH PARCEL ID (e.g. P-020, P-001)..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => {
            if (searchTerm.trim()) setIsSearching(true)
          }}
        />
        {searchTerm && (
          <button
            className="search-clear-btn"
            onClick={() => {
              setSearchTerm('')
              setSearchResults([])
              setIsSearching(false)
            }}
          >
            ✕
          </button>
        )}
      </div>

      {isSearching && searchResults.length > 0 && (
        <div className="search-dropdown-menu">
          {searchResults.map((f) => {
            const props = f.properties || {}
            return (
              <div
                key={props.parcel_id}
                className="search-result-item"
                onClick={() => handlePick(f)}
              >
                <div className="result-main-line">
                  <span className="result-pid"><b>{props.parcel_id}</b></span>
                  <span className="result-lu">{props.land_use || 'Parcel'}</span>
                  <span className="result-area">{props.area} m²</span>
                </div>
                <div className="result-sub-line">
                  <span>Confidence: <b>{Math.round((props.confidence || 0) * 100)}%</b></span>
                  <span>Status: <b className={`badge-status-${props.status || 'pending'}`}>{props.status || 'pending'}</b></span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {isSearching && searchResults.length === 0 && (
        <div className="search-dropdown-menu search-no-results">
          No parcels matching "{searchTerm}" found.
        </div>
      )}
    </div>
  )
}
