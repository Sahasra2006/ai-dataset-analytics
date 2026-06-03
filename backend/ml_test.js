const fs = require('fs')
const crypto = require('crypto')
const fetch = global.fetch || require('node-fetch')

const DATA_USERS = 'data/users.json'
const BASE = 'http://127.0.0.1:8000/api'

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function createJWT(userId, email, secret) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 // 1h
  const payload = { sub: userId, email, exp }
  const toSign = base64url(JSON.stringify(header)) + '.' + base64url(JSON.stringify(payload))
  const sig = crypto.createHmac('sha256', secret).update(toSign).digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return toSign + '.' + sig
}

async function run() {
  if (!fs.existsSync(DATA_USERS)) {
    console.error('users.json not found')
    process.exit(1)
  }
  const users = JSON.parse(fs.readFileSync(DATA_USERS, 'utf8'))
  const user = users[0]
  console.log('Using user', user.email, user.id)
  const secret = process.env.JWT_SECRET_KEY || 'change-me-in-production'
  const token = createJWT(user.id, user.email, secret)
  const headers = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }

  // list datasets
  console.log('\nListing datasets...')
  let r = await fetch(`${BASE}/datasets`, { headers })
  if (!r.ok) { console.error('List failed', r.status); process.exit(1) }
  const list = await r.json()
  const datasets = list.datasets || []
  console.log('Found', datasets.length, 'datasets')
  if (datasets.length === 0) { console.error('No datasets'); process.exit(1) }
  const ds = datasets[0]
  console.log('Selected dataset', ds.id, ds.name)

  // details
  r = await fetch(`${BASE}/datasets/${ds.id}`, { headers })
  if (!r.ok) { console.error('Get ds failed', r.status); console.error(await r.text()); process.exit(1) }
  const dfull = await r.json()
  console.log('Columns:', dfull.column_names)
  const colnames = dfull.column_names || []
  let target = null
  for (const c of colnames) {
    const dtype = (dfull.dtypes && dfull.dtypes[c]) || ''
    if (dtype.includes('int') || dtype.includes('float') || dtype.includes('number')) { target = c; break }
  }
  if (!target && colnames.length) target = colnames[colnames.length-1]
  console.log('Chosen target:', target)

  // detect
  console.log('\nDetecting...')
  r = await fetch(`${BASE}/datasets/${ds.id}/ml/detect`, { method: 'POST', headers, body: JSON.stringify({ target_column: target }) })
  console.log('Detect status', r.status)
  const det = await r.json()
  console.log('Detect response', det)

  // train
  const ptype = det.problem_type
  const models = ptype === 'regression' ? ['Linear Regression','Random Forest'] : ['Random Forest','Decision Tree']
  console.log('\nTraining models', models)
  r = await fetch(`${BASE}/datasets/${ds.id}/ml/train`, { method: 'POST', headers, body: JSON.stringify({ target_column: target, models, include_clustering: true }) })
  console.log('Train status', r.status)
  if (!r.ok) { console.error('Train failed', await r.text()); process.exit(1) }
  const trainRes = await r.json()
  console.log('Train response keys', Object.keys(trainRes))

  // metrics
  console.log('\nMetrics:')
  for (const [name, info] of Object.entries(trainRes.results || {})) {
    console.log('\nModel', name)
    const m = info.metrics || {}
    console.log(' accuracy', m.accuracy)
    console.log(' precision', m.precision)
    console.log(' recall', m.recall)
    console.log(' f1', m.f1)
    console.log(' rmse', m.rmse || (m.mse ? Math.sqrt(m.mse) : undefined))
  }

  const best = trainRes.best_model
  console.log('\nBest model', best)

  // predict using sample row if available
  const sample = (dfull.sample_rows && dfull.sample_rows[0]) || null
  const feature_names = (trainRes.results && trainRes.results[best] && trainRes.results[best].feature_names) || []
  const features = {}
  if (sample) {
    for (const f of feature_names) features[f] = (f in sample) ? sample[f] : 0
  } else {
    for (const f of feature_names) features[f] = 0
  }
  console.log('\nPredict features sample:', Object.fromEntries(Object.entries(features).slice(0,8)))
  r = await fetch(`${BASE}/datasets/${ds.id}/ml/predict`, { method: 'POST', headers, body: JSON.stringify({ model_name: best, features }) })
  console.log('Predict status', r.status)
  const pred = await r.json()
  console.log('Predict response', pred)

  // results endpoint
  r = await fetch(`${BASE}/datasets/${ds.id}/ml/results`, { headers })
  console.log('\nResults status', r.status)
  const resres = await r.json()
  console.log('Results keys', Object.keys(resres))

  console.log('\nDone')
}

run().catch(e=>{ console.error('ERROR', e); process.exit(1) })
