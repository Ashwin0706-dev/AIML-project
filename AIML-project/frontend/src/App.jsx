import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Marker, Polygon as LeafletPolygon, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { api } from './services/api'

// Components
import Header from './components/Header'
import StatsDock from './components/StatsDock'
import ExtractionModal from './components/ExtractionModal'
import BeforeAfterSlider from './components/BeforeAfterSlider'
import ParcelSearch from './components/ParcelSearch'
import ReviewQueue from './components/ReviewQueue'
import TopologyPanel from './components/TopologyPanel'
import GnssPanel from './components/GnssPanel'
import ComparisonPanel from './components/ComparisonPanel'
import ModelEvaluation from './components/ModelEvaluation'
import WorkflowGuide from './components/WorkflowGuide'
import SurveyReportModal from './components/SurveyReportModal'
import SystemStatusModal from './components/SystemStatusModal'
import MapLegend from './components/MapLegend'

const CENTER = [11.3812, 77.8965]

const STATUS_COLORS = {
  pending: '#2563eb',
  verified: '#16a34a',
  rejected: '#dc2626',
  'Manual Map Edit': '#7c3aed'
}

// Custom icons for vertex editing
const vertexIcon = L.divIcon({
  className: 'vertex-marker',
  iconSize: [14, 14],
  iconAnchor: [7, 7]
})

const midpointIcon = L.divIcon({
  className: 'midpoint-marker',
  html: '+',
  iconSize: [12, 12],
  iconAnchor: [6, 6]
})

// Pan to coordinate helper component
function MapController({ targetPos }) {
  const map = useMap()
  useEffect(() => {
    if (targetPos) {
      map.flyTo(targetPos, Math.max(map.getZoom(), 18), { duration: 0.8 })
    }
  }, [targetPos, map])
  return null
}

export default function App() {
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState('extraction') // dashboard, extraction, comparisonSlider, layers, topology, reviewQueue, gt, comparison, evaluation, export

  // Core Data States
  const [projects, setProjects] = useState([])
  const [activeProject, setActiveProject] = useState({ id: 1, name: 'Tiruchengode Urban Cadastral Zone A' })
  const [parcels, setParcels] = useState(null)
  const [buildings, setBuildings] = useState(null)
  const [roads, setRoads] = useState(null)
  const [existingParcels, setExistingParcels] = useState(null)
  const [issues, setIssues] = useState([])
  const [validationSummary, setValidationSummary] = useState(null)
  const [groundTruthList, setGroundTruthList] = useState([])
  const [comparisons, setComparisons] = useState([])
  const [statistics, setStatistics] = useState(null)
  const [systemStatus, setSystemStatus] = useState(null)
  const [evaluationData, setEvaluationData] = useState(null)
  const [reportData, setReportData] = useState(null)

  // Layer Visibility
  const [layers, setLayers] = useState({
    imagery: true,
    parcels: true,
    buildings: true,
    roads: true,
    existing: false,
    gt: true,
    issues: true
  })

  // Selected Parcel & Inspection
  const [selectedParcel, setSelectedParcel] = useState(null)
  const [mapTarget, setMapTarget] = useState(null)

  // Map-based Vertex Editing State
  const [isEditing, setIsEditing] = useState(false)
  const [editingCoords, setEditingCoords] = useState([]) // Array of [lat, lon]
  const [editLandUse, setEditLandUse] = useState('Residential')

  // Ground Truth Form
  const [gtForm, setGtForm] = useState({
    surveyArea: '',
    lat: '',
    lon: '',
    surveyId: 'GNSS-CORS-01',
    surveyAccuracy: '0.015'
  })

  // Modals & Mode States
  const [isExtractionModalOpen, setIsExtractionModalOpen] = useState(false)
  const [extractionResult, setExtractionResult] = useState(null)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [presentationMode, setPresentationMode] = useState(false)

  // UI Notifications & Busy indicator
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' })
  const [busy, setBusy] = useState(false)
  const [rev, setRev] = useState(0)

  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 4000)
  }

  // Load / Refresh all data from backend
  const refreshData = useCallback(async () => {
    try {
      const [pData, bData, rData, issData, gtData, statData, projList, sysData, evalData] = await Promise.all([
        api.getParcels().catch(() => null),
        api.getBuildings().catch(() => null),
        api.getRoads().catch(() => null),
        api.getIssues().catch(() => []),
        api.getGroundTruth().catch(() => []),
        api.getStatistics().catch(() => null),
        api.getProjects().catch(() => []),
        api.getSystemStatus().catch(() => null),
        api.getModelEvaluation().catch(() => null)
      ])

      setParcels(pData)
      setBuildings(bData)
      setRoads(rData)
      setIssues(issData)
      setGroundTruthList(gtData)
      setStatistics(statData)
      setProjects(projList)
      setSystemStatus(sysData)
      setEvaluationData(evalData)
      setRev(r => r + 1)
    } catch (err) {
      showToast('Error syncing data: ' + err.message, 'error')
    }
  }, [])

  useEffect(() => {
    refreshData()
  }, [refreshData])

  // Pre-load Existing Parcels when toggled or on comparison tab
  useEffect(() => {
    if ((layers.existing || activeTab === 'comparison') && !existingParcels) {
      api.getExistingParcels()
        .then(data => setExistingParcels(data))
        .catch(() => {})
    }
    if (activeTab === 'comparison') {
      api.getComparison()
        .then(res => setComparisons(res.comparisons || []))
        .catch(() => {})
    }
  }, [layers.existing, activeTab, existingParcels])

  // Fetch survey report when modal opens
  const handleOpenReport = async () => {
    try {
      const rep = await api.getSurveyReport()
      setReportData(rep)
      setIsReportModalOpen(true)
    } catch (err) {
      showToast('Failed to generate report: ' + err.message, 'error')
    }
  }

  // AI Pipeline Actions with animated modal
  const handleTriggerAiExtraction = async () => {
    setIsExtractionModalOpen(true)
    setBusy(true)
    try {
      const pipeline = await api.runPipeline()
      const res = pipeline.result
      setExtractionResult(res)
      await refreshData()
      showToast(`Pipeline complete: ${res.parcels} parcels, ${res.buildings} buildings, ${res.roads} roads.`, 'success')
    } catch (err) {
      showToast('Complete analysis failed: ' + err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  // Demo Dataset Loader
  const handleLoadDemoDataset = async () => {
    setBusy(true)
    try {
      const res = await api.loadDemoDataset()
      await refreshData()
      showToast(`DEMO DATASET loaded: ${res.statistics.total_parcels} parcels initialized with validation anomalies.`, 'success')
    } catch (err) {
      showToast('Error loading demo dataset: ' + err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  // Topology Validation
  const runTopologyValidation = async () => {
    setBusy(true)
    try {
      const res = await api.validate()
      setValidationSummary(res.summary)
      setIssues(res.issues)
      await refreshData()
      showToast(`Topology validated: ${res.summary.overlaps} overlaps, ${res.summary.gaps} gaps, ${res.summary.invalid_geometries} invalid geometries.`, 'info')
    } catch (err) {
      showToast('Topology check failed: ' + err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  // File Upload Handlers
  const handleDroneUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const res = await api.upload(file, activeProject.id)
      showToast(`Uploaded ${res.filename} (${res.type}). Ready for extraction.`, 'success')
      await refreshData()
    } catch (err) {
      showToast('Unable to process image. Please check the file format.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleElevationUpload = async (e, type) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const res = await api.uploadElevation(file, type, activeProject.id)
      showToast(`Uploaded ${type}: ${res.filename}. Stored for 3D/elevation analysis.`, 'success')
    } catch (err) {
      showToast('Elevation upload error: ' + err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleGisUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const res = await api.uploadExistingGis(file)
      showToast(`Loaded ${res.parcels_loaded} existing cadastral parcels from ${res.filename}.`, 'success')
      setLayers(l => ({ ...l, existing: true }))
      const exData = await api.getExistingParcels()
      setExistingParcels(exData)
    } catch (err) {
      showToast('GIS Upload error: ' + err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  // Map-Based Editing Workflow
  const startEditingParcel = (feat) => {
    if (!feat || !feat.geometry) return
    const rawCoords = feat.geometry.coordinates[0] || []
    const latlngs = rawCoords.map(c => [c[1], c[0]])
    if (latlngs.length > 2 && latlngs[0][0] === latlngs[latlngs.length - 1][0] && latlngs[0][1] === latlngs[latlngs.length - 1][1]) {
      latlngs.pop()
    }
    setEditingCoords(latlngs)
    setEditLandUse(feat.properties.land_use || 'Residential')
    setIsEditing(true)
    showToast(`Editing ${feat.properties.parcel_id}. Drag handles on the map to modify vertices.`, 'info')
  }

  const handleVertexDrag = (index, newLat, newLon) => {
    setEditingCoords(prev => {
      const updated = [...prev]
      updated[index] = [newLat, newLon]
      return updated
    })
  }

  const handleAddVertex = (midpointIndex, midLat, midLon) => {
    setEditingCoords(prev => {
      const updated = [...prev]
      updated.splice(midpointIndex + 1, 0, [midLat, midLon])
      return updated
    })
    showToast('Vertex added to boundary.', 'info')
  }

  const handleDeleteVertex = (index) => {
    if (editingCoords.length <= 3) {
      showToast('Cannot delete: A polygon must have at least 3 vertices.', 'warning')
      return
    }
    setEditingCoords(prev => prev.filter((_, i) => i !== index))
    showToast('Vertex removed.', 'info')
  }

  const saveEditedParcel = async () => {
    if (!selectedParcel || editingCoords.length < 3) return
    setBusy(true)
    try {
      const closedLatlngs = [...editingCoords, editingCoords[0]]
      const geojsonCoords = closedLatlngs.map(c => [c[1], c[0]])

      const patch = {
        geometry: {
          type: 'Polygon',
          coordinates: [geojsonCoords]
        },
        land_use: editLandUse,
        status: 'Manual Map Edit'
      }

      const res = await api.editParcel(selectedParcel.properties.parcel_id, patch)
      showToast(`Parcel ${selectedParcel.properties.parcel_id} saved. Topology re-validated.`, 'success')
      setIsEditing(false)
      setSelectedParcel(res.parcel)
      await refreshData()
    } catch (err) {
      showToast('Save error: ' + err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setEditingCoords([])
    showToast('Editing cancelled.', 'info')
  }

  // Parcel Selection & Zoom
  const handleSelectParcel = (feat) => {
    if (!feat) return
    setSelectedParcel(feat)
    setGtForm(prev => ({
      ...prev,
      surveyArea: feat.properties?.area || ''
    }))

    // Compute centroid for zoom
    const coords = feat.geometry?.coordinates?.[0]
    if (coords && coords.length > 0) {
      const avgLat = coords.reduce((acc, c) => acc + c[1], 0) / coords.length
      const avgLon = coords.reduce((acc, c) => acc + c[0], 0) / coords.length
      setMapTarget([avgLat, avgLon])
    }
  }

  // Ground Truth Verification Decision
  const submitGroundTruthDecision = async (decision, customPid = null) => {
    const target = customPid
      ? parcels?.features?.find(f => f.properties.parcel_id === customPid)
      : selectedParcel
    if (!target) return
    const pid = target.properties.parcel_id
    const area = gtForm.surveyArea !== '' ? parseFloat(gtForm.surveyArea) : target.properties.area

    setBusy(true)
    try {
      await api.groundTruth({
        parcel_id: pid,
        gt_area: area,
        lat: target.geometry?.coordinates?.[0]?.[0]?.[1] || 11.3801,
        lon: target.geometry?.coordinates?.[0]?.[0]?.[0] || 77.8946,
        survey_accuracy: parseFloat(gtForm.surveyAccuracy || 0.015),
        survey_id: gtForm.surveyId || 'GNSS-01',
        decision
      })
      showToast(`Parcel ${pid} marked as ${decision.toUpperCase()}.`, 'success')
      if (selectedParcel && selectedParcel.properties.parcel_id === pid) {
        setSelectedParcel(prev => ({
          ...prev,
          properties: { ...prev.properties, status: decision }
        }))
      }
      await refreshData()
    } catch (err) {
      showToast('Ground Truth error: ' + err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const loadDemoGnssPoints = async () => {
    try {
      const demo = await api.getGnssSample()
      for (const pt of demo.checkpoints) {
        await api.groundTruth({
          parcel_id: pt.parcel_id,
          gt_area: 250.0,
          lat: pt.lat,
          lon: pt.lon,
          survey_accuracy: pt.accuracy_m,
          survey_id: pt.survey_id,
          decision: 'verified'
        })
      }
      await refreshData()
      showToast(`Loaded ${demo.checkpoints.length} Demo GNSS survey checkpoints.`, 'success')
    } catch (err) {
      showToast('GNSS load error: ' + err.message, 'error')
    }
  }

  // Layer toggle helper
  const toggleLayer = (layerKey) => setLayers(l => ({ ...l, [layerKey]: !l[layerKey] }))

  // Export GeoJSON helper
  const downloadCsv = (layerName) => {
    const a = document.createElement('a')
    a.href = api.exportCsvUrl(layerName)
    a.download = `${layerName}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const downloadLayer = async (layerName) => {
    try {
      const data = await api.exportLayer(layerName)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/geo+json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${layerName}.geojson`
      a.click()
      URL.revokeObjectURL(url)
      showToast(`Exported ${layerName}.geojson`, 'success')
    } catch (err) {
      showToast('Export failed: ' + err.message, 'error')
    }
  }

  // Render polygon midpoints for vertex insertion
  const midpoints = useMemo(() => {
    if (!isEditing || editingCoords.length < 2) return []
    const pts = []
    for (let i = 0; i < editingCoords.length; i++) {
      const nextIdx = (i + 1) % editingCoords.length
      const p1 = editingCoords[i]
      const p2 = editingCoords[nextIdx]
      const midLat = (p1[0] + p2[0]) / 2
      const midLon = (p1[1] + p2[1]) / 2
      pts.push({ index: i, lat: midLat, lon: midLon })
    }
    return pts
  }, [isEditing, editingCoords])

  return (
    <>
      {/* TOP HEADER */}
      <Header
        statistics={statistics}
        systemStatus={systemStatus}
        onRunExtraction={handleTriggerAiExtraction}
        onLoadDemo={handleLoadDemoDataset}
        onOpenReport={handleOpenReport}
        onOpenWorkflow={() => setIsWorkflowModalOpen(true)}
        onOpenSystemStatus={() => setIsStatusModalOpen(true)}
        presentationMode={presentationMode}
        setPresentationMode={setPresentationMode}
        busy={busy}
      />

      {/* WORKSPACE */}
      <div className={`workspace ${presentationMode ? 'presentation-active' : ''}`}>
        {/* SIDEBAR NAVIGATION (Hidden in Presentation Mode for maximized screen share) */}
        {!presentationMode && (
          <aside className="sidebar">
            <nav className="tab-bar">
              <button className={`tab-btn ${activeTab === 'extraction' ? 'active' : ''}`} onClick={() => setActiveTab('extraction')}>
                Extraction
              </button>
              <button className={`tab-btn ${activeTab === 'comparisonSlider' ? 'active' : ''}`} onClick={() => setActiveTab('comparisonSlider')}>
                Before/After
              </button>
              <button className={`tab-btn ${activeTab === 'reviewQueue' ? 'active' : ''}`} onClick={() => setActiveTab('reviewQueue')}>
                Review Queue ({issues.length})
              </button>
              <button className={`tab-btn ${activeTab === 'topology' ? 'active' : ''}`} onClick={() => setActiveTab('topology')}>
                Topology
              </button>
              <button className={`tab-btn ${activeTab === 'gt' ? 'active' : ''}`} onClick={() => setActiveTab('gt')}>
                GNSS Survey
              </button>
              <button className={`tab-btn ${activeTab === 'comparison' ? 'active' : ''}`} onClick={() => setActiveTab('comparison')}>
                Municipal GIS
              </button>
              <button className={`tab-btn ${activeTab === 'evaluation' ? 'active' : ''}`} onClick={() => setActiveTab('evaluation')}>
                Evaluation
              </button>
              <button className={`tab-btn ${activeTab === 'layers' ? 'active' : ''}`} onClick={() => setActiveTab('layers')}>
                Layers
              </button>
              <button className={`tab-btn ${activeTab === 'export' ? 'active' : ''}`} onClick={() => setActiveTab('export')}>
                Export
              </button>
            </nav>

            <div className="tab-content">
              {/* TAB: EXTRACTION */}
              {activeTab === 'extraction' && (
                <div>
                  <div className="control-card">
                    <div className="card-title">
                      <span>AI Feature Extraction Engine</span>
                      <span className="badge badge-ai">Multitask GIS</span>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                      Runs the complete ingestion → extraction → GIS → topology workflow. Uploaded datasets remain available after restart.
                    </p>
                    <button className="btn-primary btn-full" disabled={busy} onClick={handleTriggerAiExtraction}>
                      <span>✦ RUN COMPLETE ANALYSIS</span>
                    </button>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px' }}>
                      <button disabled={busy} onClick={() => api.detectBuildings().then(r => { refreshData(); showToast(`Extracted ${r.buildings_detected} buildings.`, 'success') })}>
                        Detect Buildings
                      </button>
                      <button disabled={busy} onClick={() => api.detectRoads().then(r => { refreshData(); showToast(`Extracted ${r.roads_detected} roads.`, 'success') })}>
                        Detect Roads
                      </button>
                    </div>
                  </div>

                  <div className="control-card">
                    <div className="card-title">1. Upload Drone Orthophoto</div>
                    <label className="file-input-wrapper">
                      <span>Click to upload Orthomosaic (.tif, .png, .jpg)</span>
                      <input type="file" accept=".tif,.tiff,.png,.jpg,.jpeg" onChange={handleDroneUpload} />
                    </label>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Sample file: <code>data/sample/sample_urban_drone.png</code>
                    </p>
                  </div>

                  <div className="control-card">
                    <div className="card-title">2. Upload Elevation (DSM / DTM)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <label className="file-input-wrapper">
                        <span>Upload DSM</span>
                        <input type="file" accept=".tif,.tiff" onChange={(e) => handleElevationUpload(e, 'DSM')} />
                      </label>
                      <label className="file-input-wrapper">
                        <span>Upload DTM</span>
                        <input type="file" accept=".tif,.tiff" onChange={(e) => handleElevationUpload(e, 'DTM')} />
                      </label>
                    </div>
                  </div>

                  <div className="control-card">
                    <div className="card-title">Cadastral Land-Use Classes</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '11px' }}>
                      <span className="badge" style={{ background: '#dbeafe', color: '#1e40af' }}>Residential</span>
                      <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>Commercial</span>
                      <span className="badge" style={{ background: '#f3e8ff', color: '#6b21a8' }}>Public / Govt</span>
                      <span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>Open Space</span>
                      <span className="badge" style={{ background: '#ccfbf1', color: '#115e59' }}>Vegetation</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: BEFORE / AFTER SLIDER */}
              {activeTab === 'comparisonSlider' && (
                <BeforeAfterSlider
                  parcels={parcels}
                  buildings={buildings}
                  roads={roads}
                />
              )}

              {/* TAB: REVIEW QUEUE */}
              {activeTab === 'reviewQueue' && (
                <ReviewQueue
                  issues={issues}
                  parcels={parcels}
                  onSelectIssue={(coords) => setMapTarget([coords[1], coords[0]])}
                  onSelectParcel={handleSelectParcel}
                  onApproveParcel={(pid) => submitGroundTruthDecision('verified', pid)}
                  onRejectParcel={(pid) => submitGroundTruthDecision('rejected', pid)}
                  onEditParcel={(feat) => startEditingParcel(feat)}
                  onValidateAgain={runTopologyValidation}
                  busy={busy}
                />
              )}

              {/* TAB: TOPOLOGY VALIDATION */}
              {activeTab === 'topology' && (
                <TopologyPanel
                  issues={issues}
                  statistics={statistics}
                  onValidateAgain={runTopologyValidation}
                  onSelectIssue={(coords) => setMapTarget([coords[1], coords[0]])}
                  onSelectParcel={handleSelectParcel}
                  parcels={parcels}
                  busy={busy}
                />
              )}

              {/* TAB: GNSS VERIFICATION */}
              {activeTab === 'gt' && (
                <GnssPanel
                  selectedParcel={selectedParcel}
                  gtForm={gtForm}
                  setGtForm={setGtForm}
                  groundTruthList={groundTruthList}
                  onVerifyDecision={(decision) => submitGroundTruthDecision(decision)}
                  onStartEditing={(feat) => startEditingParcel(feat)}
                  onLoadDemoGnss={loadDemoGnssPoints}
                  busy={busy}
                />
              )}

              {/* TAB: MUNICIPAL GIS COMPARISON */}
              {activeTab === 'comparison' && (
                <ComparisonPanel
                  comparisons={comparisons}
                  onRecompute={() => api.getComparison().then(r => setComparisons(r.comparisons || []))}
                  onUploadExisting={handleGisUpload}
                  busy={busy}
                />
              )}

              {/* TAB: MODEL EVALUATION */}
              {activeTab === 'evaluation' && (
                <ModelEvaluation evaluationData={evaluationData} />
              )}

              {/* TAB: LAYERS */}
              {activeTab === 'layers' && (
                <div className="control-card">
                  <div className="card-title">Map Vector & Raster Layers</div>
                  <div className="layer-item">
                    <span><span className="layer-legend" style={{ background: '#64748b' }}></span>Drone / ORI Satellite</span>
                    <input type="checkbox" checked={layers.imagery} onChange={() => toggleLayer('imagery')} />
                  </div>
                  <div className="layer-item">
                    <span><span className="layer-legend" style={{ background: '#2563eb' }}></span>AI Cadastral Parcels</span>
                    <input type="checkbox" checked={layers.parcels} onChange={() => toggleLayer('parcels')} />
                  </div>
                  <div className="layer-item">
                    <span><span className="layer-legend" style={{ background: '#ea580c' }}></span>Buildings (Rooftops)</span>
                    <input type="checkbox" checked={layers.buildings} onChange={() => toggleLayer('buildings')} />
                  </div>
                  <div className="layer-item">
                    <span><span className="layer-legend" style={{ background: '#eab308' }}></span>Roads & Pathways</span>
                    <input type="checkbox" checked={layers.roads} onChange={() => toggleLayer('roads')} />
                  </div>
                  <div className="layer-item">
                    <span><span className="layer-legend" style={{ background: '#9333ea', border: '1px dashed #fff' }}></span>Existing Municipal GIS</span>
                    <input type="checkbox" checked={layers.existing} onChange={() => toggleLayer('existing')} />
                  </div>
                  <div className="layer-item">
                    <span><span className="layer-legend" style={{ background: '#16a34a' }}></span>Ground Truth Survey Points</span>
                    <input type="checkbox" checked={layers.gt} onChange={() => toggleLayer('gt')} />
                  </div>
                  <div className="layer-item">
                    <span><span className="layer-legend" style={{ background: '#ef4444' }}></span>Topology Validation Issues</span>
                    <input type="checkbox" checked={layers.issues} onChange={() => toggleLayer('issues')} />
                  </div>
                </div>
              )}

              {/* TAB: EXPORT */}
              {activeTab === 'export' && (
                <div className="control-card">
                  <div className="card-title">Cadastral Vector & Report Export</div>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Export verified cadastral vector features as standard GeoJSON or generate formal municipal survey reports.
                  </p>
                  <button className="btn-accent btn-full" style={{ marginBottom: '10px' }} onClick={handleOpenReport}>
                    <span>📄 GENERATE SURVEY REPORT</span>
                  </button>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button className="btn-primary" onClick={() => downloadLayer('parcels')}>
                      Download Parcels (parcels.geojson)
                    </button>
                    <button onClick={() => downloadLayer('buildings')}>
                      Download Buildings (buildings.geojson)
                    </button>
                    <button onClick={() => downloadLayer('roads')}>
                      Download Roads & Pathways (roads.geojson)
                    </button>
                    <button onClick={() => downloadLayer('ground_truth')}>
                      Download Ground Truth Points (ground_truth.geojson)
                    </button>
                    <button onClick={() => downloadLayer('existing_parcels')}>
                      Download Municipal GIS (existing_parcels.geojson)
                    </button>
                    <div className="card-title" style={{ marginTop: '8px' }}>Spreadsheet Exports</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <button onClick={() => downloadCsv('parcels')}>Parcels CSV</button>
                      <button onClick={() => downloadCsv('buildings')}>Buildings CSV</button>
                      <button onClick={() => downloadCsv('roads')}>Roads CSV</button>
                      <button onClick={() => downloadCsv('ground_truth')}>GNSS CSV</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* MAP CANVAS */}
        <main className="map-container">
          {/* SEARCH BAR OVERLAY */}
          <div className="map-top-overlay">
            <ParcelSearch
              parcels={parcels}
              onSelectParcel={handleSelectParcel}
            />
          </div>

          {/* FLOATING MAP LEGEND */}
          <MapLegend />

          {/* PRESENTATION HUD (JUDGE OVERLAY) */}
          {presentationMode && (
            <div className="presentation-hud">
              <div className="hud-title">AI URBAN CADASTRAL MAPPING</div>
              <div className="hud-flow-step">1. AI EXTRACTION → 2. GIS POLYGONS</div>
              <div className="hud-flow-step">3. TOPOLOGY VALIDATION → 4. GNSS SURVEY</div>
              <div className="hud-stats-row">
                <div className="hud-stat-box">
                  <div className="hud-stat-val" style={{ color: '#38bdf8' }}>{statistics?.total_parcels || 0}</div>
                  <div className="hud-stat-lbl">Parcels Extracted</div>
                </div>
                <div className="hud-stat-box">
                  <div className="hud-stat-val" style={{ color: '#4ade80' }}>{statistics?.valid_parcels || 0}</div>
                  <div className="hud-stat-lbl">Valid Parcels</div>
                </div>
                <div className="hud-stat-box">
                  <div className="hud-stat-val" style={{ color: '#f87171' }}>{statistics?.topology_issues || 0}</div>
                  <div className="hud-stat-lbl">Topology Issues</div>
                </div>
                <div className="hud-stat-box">
                  <div className="hud-stat-val" style={{ color: '#a78bfa' }}>{statistics?.gnss_verified || 0}</div>
                  <div className="hud-stat-lbl">GNSS Verified</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="btn-primary" onClick={handleTriggerAiExtraction} disabled={busy}>
                  Run AI
                </button>
                <button className="btn-accent" onClick={runTopologyValidation} disabled={busy}>
                  Validate
                </button>
                <button className="btn-secondary" onClick={handleOpenReport}>
                  Report
                </button>
                <button className="btn-secondary" onClick={() => setPresentationMode(false)}>
                  Exit
                </button>
              </div>
            </div>
          )}

          {/* TOAST STATUS */}
          {toast.show && (
            <div className="status-toast">
              <span>{toast.message}</span>
            </div>
          )}

          {/* ACTIVE EDITING BANNER */}
          {isEditing && (
            <div className="editing-toolbar">
              <span>Editing: <b>{selectedParcel?.properties?.parcel_id}</b></span>
              <span>Drag blue handles to reshape. Click (+) to add vertex.</span>
              <button className="btn-accent" onClick={saveEditedParcel}>Save Changes</button>
              <button className="btn-danger" onClick={cancelEditing}>Cancel</button>
            </div>
          )}

          <MapContainer center={CENTER} zoom={17} maxZoom={20} scrollWheelZoom={true}>
            <MapController targetPos={mapTarget} />

            {/* SATELLITE BASEMAP */}
            {layers.imagery && (
              <TileLayer
                attribution="&copy; Esri World Imagery"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={20}
              />
            )}

            {/* EXISTING MUNICIPAL GIS PARCELS (Dashed Purple) */}
            {layers.existing && existingParcels && (
              <GeoJSON
                key={'existing_' + rev}
                data={existingParcels}
                style={{
                  color: '#9333ea',
                  weight: 2,
                  dashArray: '4, 4',
                  fillColor: '#9333ea',
                  fillOpacity: 0.08
                }}
                onEachFeature={(f, l) => {
                  l.bindTooltip(`Existing GIS: ${f.properties.parcel_id} (${f.properties.recorded_area} m²)`)
                }}
              />
            )}

            {/* AI PARCELS LAYER */}
            {layers.parcels && parcels && !isEditing && (
              <GeoJSON
                key={'parcels_' + rev}
                data={parcels}
                style={f => {
                  const status = f.properties.status || 'pending'
                  const color = STATUS_COLORS[status] || '#2563eb'
                  const isLowConf = (f.properties.confidence || 1) < 0.88
                  return {
                    color: isLowConf ? '#f59e0b' : color,
                    weight: isLowConf ? 2.5 : 2,
                    dashArray: isLowConf ? '3, 3' : null,
                    fillColor: color,
                    fillOpacity: 0.18
                  }
                }}
                onEachFeature={(f, l) => {
                  l.on('click', () => {
                    handleSelectParcel(f)
                  })
                  l.bindTooltip(`${f.properties.parcel_id} (${f.properties.land_use})`)
                }}
              />
            )}

            {/* BUILDINGS ROOFTOPS LAYER */}
            {layers.buildings && buildings && (
              <GeoJSON
                key={'bldg_' + rev}
                data={buildings}
                style={{
                  color: '#c2410c',
                  weight: 1.5,
                  fillColor: '#ea580c',
                  fillOpacity: 0.65
                }}
                onEachFeature={(f, l) => {
                  l.bindTooltip(`${f.properties.building_id}: ${f.properties.building_type}`)
                }}
              />
            )}

            {/* ROADS & PATHWAYS LAYER */}
            {layers.roads && roads && (
              <GeoJSON
                key={'roads_' + rev}
                data={roads}
                style={f => ({
                  color: f.properties.road_type === 'Main Road' ? '#eab308' : (f.properties.road_type === 'Pathway' ? '#06b6d4' : '#facc15'),
                  weight: f.properties.road_type === 'Main Road' ? 4.5 : (f.properties.road_type === 'Pathway' ? 2 : 3),
                  dashArray: f.properties.road_type === 'Pathway' ? '3, 4' : null
                })}
                onEachFeature={(f, l) => {
                  l.bindTooltip(`${f.properties.road_id}: ${f.properties.road_type}`)
                }}
              />
            )}

            {/* TOPOLOGY VALIDATION ISSUES (Red circles) */}
            {layers.issues && issues.map((iss, idx) => {
              if (!iss.geometry?.coordinates) return null
              const lat = iss.geometry.coordinates[1]
              const lon = iss.geometry.coordinates[0]
              return (
                <CircleMarker
                  key={'iss_' + idx + '_' + rev}
                  center={[lat, lon]}
                  radius={8}
                  pathOptions={{
                    color: '#ef4444',
                    fillColor: '#ef4444',
                    fillOpacity: 0.85,
                    weight: 2
                  }}
                >
                  <Popup>
                    <b>{iss.issue_id} ({iss.issue_type})</b>
                    <br />
                    <span>Severity: <b>{iss.severity}</b></span>
                    <br />
                    <span>Feature: {iss.feature_id}</span>
                    <br />
                    <span style={{ fontSize: '11px', color: '#475569' }}>{iss.description}</span>
                  </Popup>
                </CircleMarker>
              )
            })}

            {/* GROUND TRUTH CHECKPOINTS (Emerald Markers) */}
            {layers.gt && groundTruthList.filter(g => g.lat && g.lon).map((g, idx) => (
              <CircleMarker
                key={'gt_' + idx + '_' + rev}
                center={[g.lat, g.lon]}
                radius={6}
                pathOptions={{
                  color: '#16a34a',
                  fillColor: '#22c55e',
                  fillOpacity: 0.9,
                  weight: 2
                }}
              >
                <Popup>
                  <b>{g.parcel_id} GNSS Checkpoint</b>
                  <br />
                  <span>Survey Area: {g.gt_area} m²</span>
                  <br />
                  <span>Accuracy: ±{g.survey_accuracy} m</span>
                  <br />
                  <span>Decision: <b>{g.decision}</b></span>
                </Popup>
              </CircleMarker>
            ))}

            {/* MAP-BASED EDITING CONTROLS ON SELECTED PARCEL */}
            {isEditing && editingCoords.length >= 3 && (
              <>
                <LeafletPolygon
                  positions={editingCoords}
                  pathOptions={{
                    color: '#0284c7',
                    weight: 3,
                    fillColor: '#38bdf8',
                    fillOpacity: 0.25,
                    dashArray: '6, 4'
                  }}
                />

                {editingCoords.map((pos, idx) => (
                  <Marker
                    key={'v_' + idx}
                    position={pos}
                    draggable={true}
                    icon={vertexIcon}
                    eventHandlers={{
                      drag: (e) => {
                        const { lat, lng } = e.target.getLatLng()
                        handleVertexDrag(idx, lat, lng)
                      },
                      click: () => {
                        handleDeleteVertex(idx)
                      }
                    }}
                  >
                    <Popup>
                      Vertex {idx + 1}
                      <br />
                      <button style={{ padding: '2px 6px', fontSize: '10px' }} onClick={() => handleDeleteVertex(idx)}>
                        Delete Vertex
                      </button>
                    </Popup>
                  </Marker>
                ))}

                {midpoints.map(mp => (
                  <Marker
                    key={'mp_' + mp.index}
                    position={[mp.lat, mp.lon]}
                    icon={midpointIcon}
                    eventHandlers={{
                      click: () => handleAddVertex(mp.index, mp.lat, mp.lon)
                    }}
                  >
                    <Popup>Click to add vertex here</Popup>
                  </Marker>
                ))}
              </>
            )}
          </MapContainer>

          {/* PARCEL INSPECTION DRAWER */}
          {selectedParcel && !isEditing && (
            <div className="parcel-drawer">
              <div className="drawer-header">
                <span className="drawer-title">PARCEL {selectedParcel.properties.parcel_id}</span>
                <button style={{ padding: '2px 6px', fontSize: '11px' }} onClick={() => setSelectedParcel(null)}>✕</button>
              </div>

              <div className="detail-grid">
                <span className="detail-label">Area:</span>
                <span className="detail-val"><b>{selectedParcel.properties.area} m²</b></span>
                <span className="detail-label">Land Use:</span>
                <span className="detail-val">{selectedParcel.properties.land_use}</span>
                <span className="detail-label">AI Confidence:</span>
                <span className="detail-val">
                  <b>{Math.round(selectedParcel.properties.confidence * 100)}%</b>
                  <span style={{ fontSize: '9px', color: '#64748b', display: 'block' }}>Boundary certainty</span>
                </span>
                <span className="detail-label">Topology Status:</span>
                <span className="detail-val" style={{ color: selectedParcel.properties.notes ? '#dc2626' : '#16a34a' }}>
                  {selectedParcel.properties.notes ? selectedParcel.properties.notes : '✓ Valid Closed Polygon'}
                </span>
                <span className="detail-label">GNSS Status:</span>
                <span className="detail-val" style={{ color: STATUS_COLORS[selectedParcel.properties.status] || '#2563eb' }}>
                  {selectedParcel.properties.status || 'Pending'}
                </span>
                <span className="detail-label">Verification:</span>
                <span className="detail-val">
                  {selectedParcel.properties.status === 'verified' ? '✓ Surveyor Verified' : 'Needs Verification'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '4px', marginTop: '8px' }}>
                <button className="btn-secondary" onClick={() => handleSelectParcel(selectedParcel)}>
                  Zoom
                </button>
                <button className="btn-primary" onClick={() => startEditingParcel(selectedParcel)}>
                  Edit
                </button>
                <button className="btn-accent" onClick={() => submitGroundTruthDecision('verified')}>
                  Verify
                </button>
                <button className="btn-danger" onClick={() => submitGroundTruthDecision('rejected')}>
                  Reject
                </button>
              </div>
            </div>
          )}

          {/* EDITING FORM DRAWER */}
          {isEditing && selectedParcel && (
            <div className="parcel-drawer">
              <div className="drawer-header">
                <span className="drawer-title">Edit Parcel {selectedParcel.properties.parcel_id}</span>
              </div>
              <div className="form-group">
                <label className="form-label">Land Use</label>
                <select value={editLandUse} onChange={e => setEditLandUse(e.target.value)}>
                  <option value="Residential">Residential</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Public">Public</option>
                  <option value="Open Space">Open Space</option>
                  <option value="Vegetation">Vegetation</option>
                </select>
              </div>
              <p style={{ fontSize: '11px', color: '#0369a1', marginBottom: '8px' }}>
                Vertices: <b>{editingCoords.length}</b>. Drag handles on the map to modify polygon shape.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <button className="btn-accent" onClick={saveEditedParcel}>Save Changes</button>
                <button className="btn-danger" onClick={cancelEditing}>Cancel</button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* BOTTOM REAL-TIME STATISTICS DOCK */}
      <StatsDock
        statistics={statistics}
        onTabChange={(tab) => setActiveTab(tab)}
      />

      {/* MODALS */}
      <ExtractionModal
        isOpen={isExtractionModalOpen}
        onClose={() => setIsExtractionModalOpen(false)}
        onStartExtraction={handleTriggerAiExtraction}
        extractionResult={extractionResult}
        isProcessing={busy}
      />

      <SurveyReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        reportData={reportData}
        statistics={statistics}
      />

      <WorkflowGuide
        isOpen={isWorkflowModalOpen}
        onClose={() => setIsWorkflowModalOpen(false)}
      />

      <SystemStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        systemStatus={systemStatus}
      />
    </>
  )
}
