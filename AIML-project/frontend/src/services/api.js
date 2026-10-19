const BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api'

async function call(path, opts = {}) {
  const r = await fetch(BASE + path, opts)
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.detail || err.message || r.statusText)
  }
  return r.json()
}

const jsonPost = (body) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
})

const jsonPut = (body) => ({
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
})

export const api = {
  get: (path) => call(path),

  // Projects
  getProjects: () => call('/projects'),
  getImagery: () => call('/imagery'),
  runPipeline: () => call('/pipeline/run', { method: 'POST' }),
  createProject: (data) => call('/projects', jsonPost(data)),

  // Uploads
  upload: (file, projectId = 1, elevationType = null) => {
    const f = new FormData()
    f.append('file', file)
    f.append('project_id', projectId)
    if (elevationType) f.append('elevation_type', elevationType)
    return call('/imagery/upload', { method: 'POST', body: f })
  },
  uploadElevation: (file, elevationType = 'DSM', projectId = 1) => {
    const f = new FormData()
    f.append('file', file)
    f.append('elevation_type', elevationType)
    f.append('project_id', projectId)
    return call('/imagery/upload-elevation', { method: 'POST', body: f })
  },
  uploadExistingGis: (file) => {
    const f = new FormData()
    f.append('file', file)
    return call('/gis/upload-existing', { method: 'POST', body: f })
  },

  // AI Inference & Detection
  segment: () => call('/ai/segment', { method: 'POST' }),
  detectBuildings: () => call('/ai/detect-buildings', { method: 'POST' }),
  detectRoads: () => call('/ai/detect-roads', { method: 'POST' }),

  // Topology
  validate: () => call('/topology/validate', { method: 'POST' }),
  getIssues: () => call('/validation/issues'),

  // Parcels & Editing
  getParcels: () => call('/parcels'),
  getParcel: (id) => call(`/parcels/${id}`),
  editParcel: (id, patch) => call(`/parcels/${id}`, jsonPut(patch)),

  // Features
  getBuildings: () => call('/buildings'),
  getRoads: () => call('/roads'),

  // Ground Truth & GNSS
  groundTruth: (data) => call('/ground-truth', jsonPost(data)),
  getGroundTruth: () => call('/ground-truth'),
  getGnssSample: () => call('/gnss/sample'),

  // Existing GIS & Comparison
  getExistingParcels: () => call('/gis/existing-parcels'),
  getComparison: () => call('/gis/comparison'),

  // Statistics & Export
  getStatistics: () => call('/statistics'),
  exportLayer: (layer) => call(`/export/geojson?layer=${layer}`),
  exportCsvUrl: (layer) => `${BASE}/export/csv?layer=${layer}`,

  // System, Evaluation, Demo, Report
  getSystemStatus: () => call('/system/status'),
  getModelEvaluation: () => call('/model/evaluation'),
  loadDemoDataset: () => call('/demo/load', { method: 'POST' }),
  getSurveyReport: () => call('/survey-report'),
  sampleOrthophotoUrl: (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api') + '/imagery/sample-orthophoto'
}
