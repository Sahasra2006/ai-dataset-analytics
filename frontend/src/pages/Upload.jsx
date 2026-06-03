import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import Card from '../components/Card'

export default function Upload() {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [insights, setInsights] = useState(null)
  const [loading, setLoading] = useState(false)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) return

    setError('')
    setLoading(true)
    setResult(null)
    setInsights(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const { data } = await api.post('/datasets/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(data.dataset)
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const generateInsights = async () => {
    if (!result?.id) return
    setInsightsLoading(true)
    try {
      const { data } = await api.post(`/datasets/${result.id}/insights`)
      setInsights(data.insights)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate insights')
    } finally {
      setInsightsLoading(false)
    }
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-slate-800">Upload Dataset</h1>
      <p className="mb-8 text-slate-500">Supported formats: CSV, XLSX, JSON</p>

      <Card className="max-w-2xl">
        <form onSubmit={handleUpload} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          )}
          <div className="rounded-lg border-2 border-dashed border-slate-300 p-8 text-center">
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.json"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mx-auto block text-sm"
            />
            {file && <p className="mt-2 text-sm text-slate-600">Selected: {file.name}</p>}
          </div>
          <button
            type="submit"
            disabled={!file || loading}
            className="rounded-lg bg-primary-600 px-6 py-2.5 font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? 'Uploading...' : 'Upload'}
          </button>
        </form>
      </Card>

      {result && (
        <div className="mt-8 space-y-6">
          <Card title="Upload Summary">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Stat label="Dataset Name" value={result.name} />
              <Stat label="Rows" value={result.rows} />
              <Stat label="Columns" value={result.columns} />
              <Stat label="Duplicate Rows" value={result.duplicate_rows} />
            </div>

            <h3 className="mb-2 mt-6 font-medium text-slate-700">Column Names</h3>
            <p className="text-sm text-slate-600">{result.column_names?.join(', ')}</p>

            <h3 className="mb-2 mt-4 font-medium text-slate-700">Data Types</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2 pr-4">Column</th>
                    <th className="py-2">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(result.dtypes || {}).map(([col, type]) => (
                    <tr key={col} className="border-b border-slate-100">
                      <td className="py-2 pr-4">{col}</td>
                      <td className="py-2">{type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="mb-2 mt-4 font-medium text-slate-700">Missing Values</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2 pr-4">Column</th>
                    <th className="py-2">Missing</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(result.missing_values || {}).map(([col, count]) => (
                    <tr key={col} className="border-b border-slate-100">
                      <td className="py-2 pr-4">{col}</td>
                      <td className="py-2">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={generateInsights}
                disabled={insightsLoading}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {insightsLoading ? 'Generating AI Insights...' : 'Generate AI Insights'}
              </button>
              <button
                onClick={() => navigate(`/dataset/${result.id}`)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
              >
                View Full Overview
              </button>
            </div>
          </Card>

          {insights && (
            <Card title="Dataset Insights (AI)">
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-slate-700">
                {insights}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-800">{value}</p>
    </div>
  )
}
