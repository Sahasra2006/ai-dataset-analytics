from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import analysis, auth, chat, datasets

app = FastAPI(
    title="AI Dataset Analytics Platform",
    description="Upload datasets, analyze with AI, chat, and generate charts/reports.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(datasets.router)
app.include_router(chat.router)
app.include_router(analysis.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
