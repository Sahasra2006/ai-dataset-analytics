import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../api/client'
import Card from '../components/Card'

const CHART_TYPES = ['bar', 'line', 'scatter', 'histogram', 'box', 'heatmap']
const SUPERVISED_MODELS = [
  'Linear Regression',
  'Logistic Regression',
  'Decision Tree',
  'Random Forest',
  'KNN',
]

export default function DatasetOverview() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [insights, setInsights] = useState(null)
  const [report, setReport] = useState(null)
  const [chart, setChart] = useState(null)
  const [chartType, setChartType] = useState('bar')
  const [xColumn, setXColumn] = useState('')
  const [yColumn, setYColumn] = useState('')
  const [loading, setLoading] = useState(true)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [chartLoading, setChartLoading] = useState(false)
  const [mlLoading, setMlLoading] = useState(false)
  const [predictionLoading, setPredictionLoading] = useState(false)
  const [mlTarget, setMlTarget] = useState('')
  const [problemType, setProblemType] = useState('')
  const [selectedModels, setSelectedModels] = useState([])
  const [includeClustering, setIncludeClustering] = useState(true)
  const [mlResults, setMlResults] = useState(null)
  const [selectedPredictModel, setSelectedPredictModel] = useState('')
  const [predictInputs, setPredictInputs] = useState({})
  const [prediction, setPrediction] = useState(null)
  const [mlError, setMlError] = useState('')

  useEffect(() => {
    Promise.all([
      api.get(`/datasets/${id}`),
      api.get(`/analysis/${id}/overview`),
      api.get(`/datasets/${id}/ml/results`).catch(() => null),
    ])
      .then(([dsRes, overviewRes, mlResultsRes]) => {
        setData({ ...dsRes.data, overview: overviewRes.data.overview })
        setInsights(dsRes.data.ai_insights)
        if (dsRes.data.column_names?.length) {
          setXColumn(dsRes.data.column_names[0])
          setYColumn(dsRes.data.column_names[1] || dsRes.data.column_names[0])
          setMlTarget(dsRes.data.column_names[0])
        }
        if (mlResultsRes?.data?.results) {
          setMlResults(mlResultsRes.data.results)
          setSelectedPredictModel(mlResultsRes.data.results.best_model || '')
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!mlTarget || !data?.column_names) {
      return
    }
    const detect = async () => {
      try {
        const { data: detectData } = await api.post(`/datasets/${id}/ml/detect`, { target_column: mlTarget })
        setProblemType(detectData.problem_type)
        if (detectData.problem_type === 'classification') {
          setSelectedModels(['Logistic Regression', 'Decision Tree', 'Random Forest', 'KNN'])
        } else if (detectData.problem_type === 'regression') {
          setSelectedModels(['Linear Regression', 'Decision Tree', 'Random Forest', 'KNN'])
        }
      } catch (err) {
        setProblemType('')
      }
    }
    detect()
  }, [id, mlTarget, data?.column_names])

  const generateInsights = async () => {
    setInsightsLoading(true)
    try {
      const { data } = await api.post(`/datasets/${id}/insights`)
      setInsights(data.insights)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to generate insights')
    } finally {
      setInsightsLoading(false)
    }
  }

  const generateChart = async () => {
    setChartLoading(true)
    try {
      const { data } = await api.post(`/analysis/${id}/chart`, {
        chart_type: chartType,
        x_column: xColumn,
        y_column: yColumn || null,
      })
      setChart(data.image_base64)
    } catch (err) {
      alert(err.response?.data?.detail || 'Chart generation failed')
    } finally {
      setChartLoading(false)
    }
  }

  const generateReport = async () => {
    try {
      const { data } = await api.post(`/analysis/${id}/report`)
      setReport(data.content)
    } catch (err) {
      alert(err.response?.data?.detail || 'Report generation failed')
    }
  }

  const handleTrainML = async () => {
    if (!mlTarget) return
    setMlError('')
    setMlLoading(true)
    try {
      const { data } = await api.post(`/datasets/${id}/ml/train`, {
        target_column: mlTarget,
        models: selectedModels,
        include_clustering: includeClustering,
      })
      setMlResults(data)
      setSelectedPredictModel(data.best_model || '')
      setPrediction(null)
    } catch (err) {
      setMlResults(null)
      setMlError(err.response?.data?.detail || 'ML training failed')
    } finally {
      setMlLoading(false)
    }
  }

  const updatePredictionInput = (column, value) => {
    setPredictInputs((prev) => ({ ...prev, [column]: value }))
  }

  const parseFeatureValue = (column, rawValue) => {
    const dtype = data?.overview?.dtypes?.[column] || data?.dtypes?.[column] || ''
    if (dtype.includes('int') || dtype.includes('float') || dtype.includes('double') || dtype.includes('number')) {
      const num = Number(rawValue)
      return Number.isNaN(num) ? rawValue : num
    }
    return rawValue
  }

  const handlePredict = async () => {
    if (!selectedPredictModel || !mlResults) return
    setPredictionLoading(true)
    setPrediction(null)
    try {
      const featureValues = {}
      const features = mlResults.feature_columns || []
      for (const column of features) {
        featureValues[column] = parseFeatureValue(column, predictInputs[column] ?? '')
      }
      const { data } = await api.post(`/datasets/${id}/ml/predict`, {
        model_name: selectedPredictModel,
        features: featureValues,
      })
      setPrediction(data.prediction)
    } catch (err) {
      setPrediction(err.response?.data?.detail || 'Prediction failed')
    } finally {
      setPredictionLoading(false)
    }
  }

  const handleExportModel = (modelName) => {
    window.open(`/api/datasets/${id}/ml/export/${encodeURIComponent(modelName)}`, '_blank')
  }

  if (loading) return <p className="text-slate-500">Loading dataset...</p>
  if (!data) return <p className="text-red-600">Dataset not found</p>

  const overview = data.overview || data
  const columns = data.column_names || []
  const featureColumns = columns.filter((col) => col !== mlTarget)

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{data.name}</h1>
          <p className="mt-1 text-slate-500">Dataset overview and analysis</p>
        </div>
        <Link
          to={`/chat?dataset=${id}`}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Chat with AI
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Dataset Summary">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-slate-500">Rows</span><p className="font-semibold">{overview.rows ?? data.rows}</p></div>
            <div><span className="text-slate-500">Columns</span><p className="font-semibold">{overview.columns ?? data.columns}</p></div>
            <div><span className="text-slate-500">Duplicates</span><p className="font-semibold">{overview.duplicate_rows ?? data.duplicate_rows}</p></div>
            <div><span className="text-slate-500">Filename</span><p className="font-semibold truncate">{data.filename}</p></div>
          </div>
        </Card>

        <Card title="Column Information">
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2">Column</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Missing</th>
                </tr>
              </thead>
              <tbody>
                {columns.map((col) => (
                  <tr key={col} className="border-b border-slate-100">
                    <td className="py-2">{col}</td>
                    <td className="py-2">{(overview.dtypes || data.dtypes)?.[col]}</td>
                    <td className="py-2">{(overview.missing_values || data.missing_values)?.[col] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {(overview.statistics || data.statistics) && Object.keys(overview.statistics || data.statistics).length > 0 && (
        <Card title="Statistics" className="mt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2 pr-4">Column</th>
                  <th className="py-2 pr-4">Mean</th>
                  <th className="py-2 pr-4">Median</th>
                  <th className="py-2 pr-4">Std</th>
                  <th className="py-2 pr-4">Min</th>
                  <th className="py-2">Max</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(overview.statistics || data.statistics).map(([col, stat]) => (
                  <tr key={col} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium">{col}</td>
                    <td className="py-2 pr-4">{stat.mean?.toFixed(2)}</td>
                    <td className="py-2 pr-4">{stat.median?.toFixed(2)}</td>
                    <td className="py-2 pr-4">{stat.std?.toFixed(2)}</td>
                    <td className="py-2 pr-4">{stat.min?.toFixed(2)}</td>
                    <td className="py-2">{stat.max?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title="Machine Learning" className="mt-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Target column</label>
            <select
              value={mlTarget}
              onChange={(e) => setMlTarget(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              {columns.map((col) => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Detected problem type</label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {problemType ? problemType.toUpperCase() : 'Select target column'}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <fieldset className="space-y-2 rounded-lg border border-slate-200 p-4">
            <legend className="text-sm font-medium text-slate-700">Supervised models</legend>
            {SUPERVISED_MODELS.map((model) => {
              const disabled = (model === 'Linear Regression' && problemType === 'classification') || (model === 'Logistic Regression' && problemType === 'regression')
              return (
                <label key={model} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedModels.includes(model)}
                    disabled={Boolean(disabled)}
                    onChange={() => {
                      setSelectedModels((prev) =>
                        prev.includes(model) ? prev.filter((name) => name !== model) : [...prev, model],
                      )
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className={disabled ? 'text-slate-400' : ''}>{model}</span>
                </label>
              )
            })}
          </fieldset>
          <div className="rounded-lg border border-slate-200 p-4">
            <label className="mb-2 block text-sm font-medium text-slate-700">Clustering</label>
            <div className="flex items-center gap-3">
              <input
                id="clustering"
                type="checkbox"
                checked={includeClustering}
                onChange={(e) => setIncludeClustering(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="clustering" className="text-sm text-slate-700">Include K-Means clustering</label>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              Automatic preprocessing handles missing values, encoding, scaling, and train-test splitting.
            </p>
          </div>
        </div>

        {mlError && <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{mlError}</div>}

        <button
          onClick={handleTrainML}
          disabled={mlLoading || !mlTarget}
          className="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {mlLoading ? 'Training models...' : 'Train Models'}
        </button>

        {mlResults && (
          <div className="mt-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Best model</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{mlResults.best_model}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Problem type</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{mlResults.problem_type}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Features</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{mlResults.feature_columns.length}</p>
              </div>
            </div>

            <Card title="Model Comparison">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="py-2">Model</th>
                      <th className="py-2">Primary metric</th>
                      <th className="py-2">Details</th>
                      <th className="py-2">Export</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(mlResults.results).map(([modelName, result]) => (
                      <tr key={modelName} className="border-b border-slate-100">
                        <td className="py-2 font-medium">{modelName}</td>
                        <td className="py-2">
                          {result.problem_type === 'regression' && `R2 ${result.metrics.r2?.toFixed(2)}`}
                          {result.problem_type === 'classification' && `F1 ${result.metrics.f1?.toFixed(2)}`}
                          {result.problem_type === 'clustering' && `Silhouette ${result.metrics.silhouette?.toFixed(2) ?? 'N/A'}`}
                        </td>
                        <td className="py-2 text-slate-600">
                          {Object.entries(result.metrics).map(([k, v]) => (
                            <div key={k}>{k}: {v === null ? 'N/A' : typeof v === 'number' ? v.toFixed(2) : v}</div>
                          ))}
                        </td>
                        <td className="py-2">
                          <button
                            onClick={() => handleExportModel(modelName)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                          >
                            Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {mlResults.plots?.comparison_chart && (
              <Card title="Comparison Chart">
                <img src={`data:image/png;base64,${mlResults.plots.comparison_chart}`} alt="Model comparison chart" className="w-full rounded-lg border" />
              </Card>
            )}

            {mlResults.plots?.feature_importance_chart && (
              <Card title="Feature Importance">
                <img src={`data:image/png;base64,${mlResults.plots.feature_importance_chart}`} alt="Feature importance" className="w-full rounded-lg border" />
              </Card>
            )}

            <Card title="Prediction Interface">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Model</label>
                  <select
                    value={selectedPredictModel}
                    onChange={(e) => setSelectedPredictModel(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  >
                    {Object.keys(mlResults.results).map((modelName) => (
                      <option key={modelName} value={modelName}>{modelName}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handlePredict}
                    disabled={predictionLoading || !selectedPredictModel}
                    className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    {predictionLoading ? 'Predicting...' : 'Predict'}
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {featureColumns.map((col) => (
                  <div key={col}>
                    <label className="mb-2 block text-sm font-medium text-slate-700">{col}</label>
                    <input
                      type="text"
                      value={predictInputs[col] ?? ''}
                      onChange={(e) => updatePredictionInput(col, e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    />
                  </div>
                ))}
              </div>
              {prediction !== null && (
                <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
                  <span className="font-medium">Prediction:</span> {prediction}
                </div>
              )}
            </Card>
          </div>
        )}
      </Card>

      <Card title="Dataset Insights (AI)" className="mt-6">
        {insights ? (
          <div className="whitespace-pre-wrap text-sm text-slate-700">{insights}</div>
        ) : (
          <p className="text-sm text-slate-500">No AI insights yet.</p>
        )}
        <button
          onClick={generateInsights}
          disabled={insightsLoading}
          className="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {insightsLoading ? 'Generating...' : insights ? 'Regenerate Insights' : 'Generate Insights'}
        </button>
      </Card>

      <Card title="Generate Chart" className="mt-6">
        <div className="flex flex-wrap gap-4">
          <select value={chartType} onChange={(e) => setChartType(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
            {CHART_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select value={xColumn} onChange={(e) => setXColumn(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
            {columns.map((c) => <option key={c} value={c}>{c} (X)</option>)}
          </select>
          <select value={yColumn} onChange={(e) => setYColumn(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
            {columns.map((c) => <option key={c} value={c}>{c} (Y)</option>)}
          </select>
          <button
            onClick={generateChart}
            disabled={chartLoading}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {chartLoading ? 'Generating...' : 'Generate Chart'}
          </button>
        </div>
        {chart && (
          <img
            src={`data:image/png;base64,${chart}`}
            alt="Generated chart"
            className="mt-4 max-w-full rounded-lg border"
          />
        )}
      </Card>

      <Card title="Report" className="mt-6">
        <button
          onClick={generateReport}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700"
        >
          Generate Report
        </button>
        {report && (
          <pre className="mt-4 max-h-96 overflow-auto rounded-lg bg-slate-50 p-4 text-sm whitespace-pre-wrap">
            {report}
          </pre>
        )}
      </Card>
    </div>
  )
}
