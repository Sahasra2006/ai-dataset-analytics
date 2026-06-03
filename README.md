# AI Dataset Analytics Platform

A full-stack platform to upload datasets, analyze them with AI (Google Gemini), chat about your data, and generate charts and reports.

## Tech Stack

- **Frontend:** React, Tailwind CSS, React Router, Axios
- **Backend:** FastAPI, Python
- **AI:** Google Gemini API
- **Data:** Pandas, NumPy, Matplotlib, Seaborn
- **Auth:** JWT + bcrypt (no database — JSON file storage)

## Project Structure

```
Project 2/
├── backend/
│   ├── app/           # FastAPI application
│   ├── data/          # users.json, chats.json
│   ├── uploads/       # uploaded datasets (per user)
│   ├── reports/       # generated reports
│   └── exports/       # saved charts
├── frontend/          # React + Vite app
├── .env.example
└── README.md
```

## Setup

### 1. Environment variables

Copy the example file and add your keys:

```bash
cp .env.example .env
```

Edit `.env`:

- `GEMINI_API_KEY` — from [Google AI Studio](https://aistudio.google.com/apikey)
- `JWT_SECRET_KEY` — any long random string

### 2. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
# Run from the backend folder so Python can import the app package
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

> **Note:** Use Python 3.11–3.14. If `matplotlib` fails to install, run `pip install matplotlib seaborn` separately (latest versions usually work).

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

## Features

| Feature | Description |
|--------|-------------|
| Register / Login / Logout | JWT auth, passwords hashed with bcrypt |
| Upload | CSV, XLSX, JSON — stored in `uploads/` |
| Dataset overview | Rows, columns, types, missing values, stats |
| AI insights | Gemini explains domain, columns, quality, patterns |
| AI chat | Multi-turn, dataset-aware conversations |
| Charts | Bar, line, scatter, histogram, box, heatmap |
| Reports | Markdown reports saved to `reports/` |

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/datasets` | List datasets |
| POST | `/api/datasets/upload` | Upload file |
| GET | `/api/datasets/{id}` | Dataset details |
| POST | `/api/datasets/{id}/insights` | AI insights |
| GET | `/api/chat` | List chats |
| POST | `/api/chat` | Start chat |
| POST | `/api/chat/{id}/message` | Send message |
| POST | `/api/analysis/{id}/chart` | Generate chart |
| POST | `/api/analysis/{id}/report` | Generate report |

## Storage (no database)

- Users → `backend/data/users.json`
- Chats → `backend/data/chats.json`
- Files → `backend/uploads/`, `reports/`, `exports/`
