import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../api/client'
import Card from '../components/Card'

const METRIC_LABELS = {
  r2: 'R²',
  rmse: 'RMSE',
  mae: 'MAE',
  mse: 'MSE',
  accuracy: 'Accuracy',
  precision: 'Precision',
  recall: 'Recall',
  f1: 'F1 Score',
  silhouette_score: 'Silhouette',
  inertia: 'Inertia'
}

const PROBLEM_METRICS = {
  regression: ['r2', 'rmse', 'mae', 'mse'],
  classification: ['accuracy', 'precision', 'recall', 'f1'],
  clustering: ['silhouette_score', 'inertia']
}

const getProblemLabel = (type) => {
  if (type === 'regression') return 'Regression'
  if (type === 'classification') return 'Classification'
  if (type === 'clustering') return 'Clustering'
  return 'Unknown'
}

export default function MLModels() {
  const { datasetId } = useParams()
  const navigate = useNavigate()
  const [allDatasets, setAllDatasets] = useState([])
  const [datasetsLoading, setDatasetsLoading] = useState(false)
  const [dataset, setDataset] = useState(null)
  const [loading, setLoading] = useState(true)
  const [target, setTarget] = useState('')
  const [problem, setProblem] = useState(null)
  const [modelOptions, setModelOptions] = useState([])
  const [selectedModel, setSelectedModel] = useState('')
  const [training, setTraining] = useState(false)
  const [latestResult, setLatestResult] = useState(null)
  const [modelHistory, setModelHistory] = useState([])
  const [resultsLoading, setResultsLoading] = useState(false)
  const [error, setError] = useState(null)

  // Load datasets list when no datasetId is provided
  useEffect(() => {
    if (!datasetId) {
      setDatasetsLoading(true)
      api
        .get('/datasets')
        .then((res) => setAllDatasets(res.data.datasets || []))
        .catch(console.error)
        .finally(() => setDatasetsLoading(false))
    }
  }, [datasetId])

  useEffect(() => {
    if (!datasetId) {
      setLoading(false)
      return
    }
    let mounted = true
    setLoading(true)
    api
      .get(`/datasets/${datasetId}`)
      .then((res) => mounted && setDataset(res.data))
      .catch((e) => mounted && setError(e?.response?.data?.detail || e.message))
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [datasetId])

  useEffect(() => {
    if (dataset?.column_names?.length === 1 && !target) {
      handleTargetChange(dataset.column_names[0])
    }
    // For 50_Startups dataset default to Profit if available
    if (!target && (dataset?.name?.includes('50_Startups') || dataset?.filename?.includes('50_Startups') || (dataset?.column_names || []).includes('Profit'))) {
      if ((dataset?.column_names || []).includes('Profit')) handleTargetChange('Profit')
    }
  }, [dataset])

  useEffect(() => {
    if (datasetId) {
    fetchResults()
    }
  }, [datasetId])

  const buildModelOptions = (problemType) => {
    const baseModels = []
    if (problemType === 'regression') {
      baseModels.push('Linear Regression', 'Decision Tree', 'Random Forest', 'KNN')
    } else if (problemType === 'classification') {
      baseModels.push('Logistic Regression', 'Decision Tree', 'Random Forest', 'KNN')
    }
    // Always include K-Means Clustering as an option
    baseModels.push('K-Means Clustering')
    return baseModels
  }

  const mergeHistory = (resultData, trainingTimeMs) => {
    if (!resultData?.results) return
    const entries = Object.entries(resultData.results)
    setModelHistory((current) => {
      const next = [...current]
      entries.forEach(([name, info]) => {
        // skip common metadata keys that may be present in results
        const skipKeys = new Set(['problem_type', 'target_column', 'feature_columns', 'model_name'])
        if (skipKeys.has(name)) return
        const index = next.findIndex((item) => item.name === name)
        const item = {
          name,
          problem_type: info?.problem_type || resultData.problem_type || 'unknown',
          metrics: info?.metrics || {},
          training_time: info?.training_time || info?.training_time_ms || trainingTimeMs || null,
          best: resultData.best_model === name,
          feature_names: info?.feature_names || [],
          feature_importance: info?.feature_importance || [],
          // mark as trained if there are metrics, feature names, or a training time
          trained: Boolean((info?.metrics && Object.keys(info.metrics).length) || (info?.feature_names && info.feature_names.length) || info?.training_time || trainingTimeMs)
        }
        if (index >= 0) next[index] = item
        else next.push(item)
      })
      return next
    })
  }

  const fetchResults = async () => {
    if (!datasetId) return
    setResultsLoading(true)
    try {
      const res = await api.get(`/datasets/${datasetId}/ml/results`)
      if (res?.data) {
        const data = res.data
        setLatestResult(data)
        mergeHistory(data, null)
        // ensure selected model points to best model from latest results if available
        if (data.best_model) setSelectedModel(data.best_model)
      }
    } catch (e) {
      // ignore if no results are available yet
    } finally {
      setResultsLoading(false)
    }
  }

  const handleTargetChange = async (value) => {
    setTarget(value)
    setError(null)
    setProblem(null)
    setModelOptions([])
    setSelectedModel('')

    if (!value) return
    try {
      const res = await api.post(`/datasets/${datasetId}/ml/detect`, { target_column: value })
      let problemType = res?.data?.problem_type || 'unknown'
      // avoid suggesting regression for categorical dtype columns
      const dtype = dataset?.dtypes?.[value]
      const numericTypes = ['int64', 'float64', 'int32', 'float32', 'number']
      if (dtype && !numericTypes.includes(dtype) && problemType === 'regression') {
        problemType = 'classification'
      }
      setProblem(problemType)
      const options = buildModelOptions(problemType)
      setModelOptions(options)
      setSelectedModel(options[0] || '')
    } catch (e) {
      setError(e?.response?.data?.detail || e.message)
    }
  }

  const runTrain = async () => {
    if (!target) return setError('Select a target column')
    if (!selectedModel) return setError('Select a model to train')
    setError(null)
    setTraining(true)
    const startTime = Date.now()
    try {
      const body = {
        target_column: target,
        models: [selectedModel],
        include_clustering: selectedModel === 'K-Means Clustering'
      }
      const res = await api.post(`/datasets/${datasetId}/ml/train`, body)
      const data = res?.data || {}
      const trainingTimeMs = Date.now() - startTime
      setLatestResult(data)
      mergeHistory(data, trainingTimeMs)
      // if the run reports a best model, select it for prediction; otherwise prefer the first result
      const firstResultName = Object.keys(data.results || {})[0]
      const pick = data.best_model || firstResultName || selectedModel
      if (pick) setSelectedModel(pick)
      setProblem(data.problem_type || problem)
    } catch (e) {
      console.log("TRAIN ERROR:", e.response?.data)
      setError(JSON.stringify(e.response?.data) || e.message)
    } finally {
      setTraining(false)
    }
  }

  const exportModel = async (modelName) => {
    try {
      const resp = await api.get(`/datasets/${datasetId}/ml/export/${encodeURIComponent(modelName)}`, { responseType: 'blob' })
      const blob = new Blob([resp.data])
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${modelName}.pkl`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      setError(e?.response?.data?.detail || e.message)
    }
  }

  const formatDuration = (ms) => {
    if (ms === null || ms === undefined) return '—'
    const seconds = Math.round(ms / 1000)
    return seconds < 60 ? `${seconds}s` : `${Math.round(seconds / 60)}m`
  }

  const formatMetricValue = (key, value) => {
    if (typeof value === 'number') {
      if (['r2', 'accuracy', 'precision', 'recall', 'f1', 'silhouette_score'].includes(key)) {
        return Number(value).toFixed(3)
      }
      if (['rmse', 'mae', 'mse', 'inertia'].includes(key)) {
        return Number(value).toFixed(2)
      }
    }
    return String(value)
  }

  const renderMetricLines = (metrics = {}, problemType = '') => {
    if (!metrics || Object.keys(metrics).length === 0) return 'No metrics available.'
    const keys = PROBLEM_METRICS[problemType] || Object.keys(metrics)
    const lines = keys
      .filter((key) => metrics[key] !== undefined && metrics[key] !== null)
      .map((key) => `${METRIC_LABELS[key] || key}: ${formatMetricValue(key, metrics[key])}`)
    return lines.length ? lines.join('\n') : 'No metrics available.'
  }

  // Show dataset selector if no datasetId is provided
  if (!datasetId) {
    return (
      <div className="space-y-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Train ML Model</h1>
          <p className="mt-2 text-slate-600">Select a dataset to start building and training machine learning models.</p>
        </div>

        {datasetsLoading ? (
          <p className="text-slate-500">Loading datasets...</p>
        ) : allDatasets.length === 0 ? (
          <Card>
            <p className="text-slate-500">No datasets available. Upload a dataset first to train models.</p>
            <Link to="/upload" className="mt-4 inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700">
              Upload Dataset →
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {allDatasets.map((ds) => (
              <Card key={ds.id}>
                <h3 className="font-semibold text-slate-800">{ds.name}</h3>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
                  <span>Rows: {ds.rows}</span>
                  <span>Columns: {ds.columns}</span>
                </div>
                <button
                  onClick={() => navigate(`/ml/${ds.id}`)}
                  className="mt-4 w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
                >
                  Select & Train Models
                </button>
              </Card>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (loading) return <p className="text-slate-500">Loading dataset...</p>
  if (!dataset) return <p className="text-red-600">Dataset not found.</p>

  const targetOptions = dataset.column_names || []
  const singleTarget = targetOptions.length === 1
  // only show trained models in the comparison
  const comparisonRows = [...modelHistory].filter((m) => m.trained)
  
  // Determine actual best model by metrics
  const getBestModel = (rows) => {
    if (rows.length === 0) return null
    const metricsForComparison = (item) => {
      const metrics = item.metrics || {}
      if (item.problem_type === 'regression') {
        return metrics.r2 ?? -Infinity
      } else if (item.problem_type === 'classification') {
        // prefer F1 if available, otherwise accuracy
        return metrics.f1 ?? metrics.accuracy ?? -Infinity
      } else if (item.problem_type === 'clustering') {
        return metrics.silhouette_score ?? -Infinity
      }
      return -Infinity
    }
    return rows.reduce((best, current) => {
      return metricsForComparison(current) > metricsForComparison(best) ? current : best
    })
  }
  
  const bestModelForComparison = getBestModel(comparisonRows)
  // Update comparisonRows sort to place best at top
  const sortedComparisonRows = comparisonRows.map((row) => ({
    ...row,
    isBest: bestModelForComparison && row.name === bestModelForComparison.name
  })).sort((a, b) => (a.isBest === b.isBest ? 0 : a.isBest ? -1 : 1))

  return (
    <div className="space-y-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">AutoML Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Train, compare, evaluate, predict, and export models from one clean, responsive dashboard.</p>
        </div>
        <Link to="/dashboard" className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
          ← Back to dashboard
        </Link>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-red-700">{error}</div>}

      <div className="w-[75%] mx-auto">
        <div className="space-y-4">
          <Card>
            <h2 className="text-xl font-semibold text-slate-800">Select Target Column</h2>
            <p className="mt-1 text-sm text-slate-500">The dataset will automatically detect the problem type once a target is selected.</p>
            <div className="mt-4">
              {singleTarget ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800">{targetOptions[0]}</div>
              ) : (
                <select value={target} onChange={(e) => handleTargetChange(e.target.value)} className="w-full rounded-lg border px-3 py-2">
                  <option value="">— Select column —</option>
                  {targetOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Detected problem</div>
                <div className="mt-2 text-lg font-semibold text-slate-800">{problem || 'Awaiting target selection'}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Model options</div>
                <div className="mt-2 text-lg font-semibold text-slate-800">{modelOptions.length ? modelOptions.join(', ') : 'Select a target'}</div>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-xl font-semibold text-slate-800">Select Model</h2>
            <p className="mt-1 text-sm text-slate-500">Choose the model to train. You can train multiple models sequentially.</p>
            <div className="mt-4">
              <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="w-full rounded-lg border px-3 py-2">
                <option value="">— Select model —</option>
                {(modelOptions.length ? modelOptions : ['Decision Tree', 'Random Forest', 'Logistic Regression', 'Linear Regression', 'KNN']).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <button
              onClick={runTrain}
              disabled={training || !selectedModel}
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {training ? 'Training…' : 'Train model'}
            </button>
          </Card>

          <Card>
            <h2 className="text-xl font-semibold text-slate-800">Training Results</h2>
            {resultsLoading && <p className="mt-2 text-slate-500">Loading latest results…</p>}
            {!latestResult && !resultsLoading && <p className="mt-2 text-slate-500">No models trained yet. Start with a target and model selection.</p>}
            {latestResult && (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    
                    
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Problem type</div>
                    <div className="mt-2 text-lg font-semibold text-slate-800">{latestResult.problem_type || problem || '—'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Models trained</div>
                    <div className="mt-2 text-lg font-semibold text-slate-800">{Object.keys(latestResult.results || {}).length}</div>
                  </div>
                </div>
                <div className="grid gap-4">
                  {latestResult.plots?.comparison_chart && (
                    <img src={`data:image/png;base64,${latestResult.plots.comparison_chart}`} alt="Model comparison" className="w-full rounded border" />
                  )}
                  {latestResult.plots?.feature_importance_chart && (
                    <img src={`data:image/png;base64,${latestResult.plots.feature_importance_chart}`} alt="Feature importance" className="w-full rounded border" />
                  )}
                </div>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-xl font-semibold text-slate-800">Model Comparison</h2>
            {modelHistory.length === 0 ? (
              <p className="mt-2 text-slate-500">No trained models to compare yet.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm text-slate-700">
                  <thead className="border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Model</th>
                      <th className="px-3 py-2">Problem</th>
                      <th className="px-3 py-2">Training time</th>
                      <th className="px-3 py-2">Metrics</th>
                      
                      <th className="px-3 py-2">Export</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedComparisonRows.map((item) => (
                      <tr key={item.name} className="border-b border-slate-200">
                        <td className="px-3 py-3 font-medium text-slate-800">{item.name}</td>
                        <td className="px-3 py-3">{item.problem_type || '—'}</td>
                        <td className="px-3 py-3">{formatDuration(item.training_time)}</td>
                        <td className="px-3 py-3 whitespace-pre-line text-slate-700">{renderMetricLines(item.metrics, item.problem_type)}</td>
              
                        <td className="px-3 py-3">
                          <button
                            onClick={() => exportModel(item.name)}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                          >
                            Export
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-xl font-semibold text-slate-800">Predict</h2>
            {comparisonRows.length === 0 ? (
              <p className="mt-2 text-slate-500">Train at least one model before using the prediction interface.</p>
            ) : (
              <PredictForm
                datasetId={datasetId}
                modelHistory={modelHistory}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

function PredictForm({ datasetId, modelHistory, selectedModel, setSelectedModel }) {
  const [inputs, setInputs] = useState({})
  const [output, setOutput] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const activeName = selectedModel || modelHistory.find((m) => m.best)?.name || modelHistory[0]?.name || ''
    const features = modelHistory.find((item) => item.name === activeName)?.feature_names || []
    const init = {}
    features.forEach((f) => { init[f] = '' })
    setInputs(init)
  }, [modelHistory, selectedModel])

  const handleChange = (key, value) => setInputs((prev) => ({ ...prev, [key]: value }))

  const submit = async () => {
    const modelName = selectedModel || modelHistory.find((m) => m.best)?.name || modelHistory[0]?.name
    if (!modelName) {
      setOutput('Please select a model before predicting.')
      return
    }
    setLoading(true)
    setOutput(null)
    try {
      const res = await api.post(`/datasets/${datasetId}/ml/predict`, { model_name: modelName, features: inputs })
      setOutput(res?.data?.prediction ?? 'No prediction returned')
    } catch (e) {
      setOutput(e?.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }

  const activeModel = modelHistory.find((item) => item.name === (selectedModel || modelHistory.find((m) => m.best)?.name)) || modelHistory[0]

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-slate-600">Model</label>
        {/* show a dropdown of only trained models */}
        <select
          value={selectedModel || activeModel?.name || ''}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
        >
          {modelHistory.filter((m) => m.trained).map((m) => (
            <option key={m.name} value={m.name}>{m.name}</option>
          ))}
        </select>
      </div>

      {activeModel?.feature_names?.length ? (
        <div className="grid grid-cols-2 gap-4">
          {activeModel.feature_names.map((field) => (
            <div key={field}>
              <label className="block text-xs text-slate-600">{field}</label>
              <input
                value={inputs[field] ?? ''}
                onChange={(e) => handleChange(field, e.target.value)}
                className="mt-1 w-80 rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No feature inputs available for this model.</p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button onClick={submit} disabled={loading} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-400">
          {loading ? 'Predicting…' : 'Predict'}
        </button>
        {output !== null && <div className="text-sm text-slate-700">Result: <strong className="text-slate-900">{String(output)}</strong></div>}
      </div>
    </div>
  )
}
