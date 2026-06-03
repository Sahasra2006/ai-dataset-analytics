import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import Card from '../components/Card'

export default function Dashboard() {
  const [datasets, setDatasets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/datasets')
      .then((res) => setDatasets(res.data.datasets || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id) => {
    if (!confirm('Delete this dataset?')) return
    await api.delete(`/datasets/${id}`)
    setDatasets((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="mt-1 text-slate-500">Manage and explore your datasets</p>
        </div>
        <Link
          to="/upload"
          className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700"
        >
          + Upload Dataset
        </Link>
      </div>

      {loading ? (
        <p className="text-slate-500">Loading datasets...</p>
      ) : datasets.length === 0 ? (
        <Card>
          <p className="text-slate-500">No datasets yet. Upload your first CSV, XLSX, or JSON file.</p>
          <Link to="/upload" className="mt-4 inline-block text-primary-600 hover:underline">
            Go to Upload →
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {datasets.map((ds) => (
            <Card key={ds.id}>
              <h3 className="font-semibold text-slate-800">{ds.name}</h3>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
                <span>Rows: {ds.rows}</span>
                <span>Columns: {ds.columns}</span>
                <span className="col-span-2">Duplicates: {ds.duplicate_rows}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to={`/dataset/${ds.id}`}
                  className="rounded-lg bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700 hover:bg-primary-100"
                >
                  Overview
                </Link>
                <Link
                  to={`/chat?dataset=${ds.id}`}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Chat
                </Link>
                <button
                  onClick={() => handleDelete(ds.id)}
                  className="rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
