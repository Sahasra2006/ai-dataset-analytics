import json
import uuid
from pathlib import Path

import numpy as np
import pandas as pd

from app.config import UPLOADS_DIR


def load_dataframe(file_path: Path) -> pd.DataFrame:
    suffix = file_path.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(file_path)
    if suffix in (".xlsx", ".xls"):
        return pd.read_excel(file_path)
    if suffix == ".json":
        return pd.read_json(file_path)
    raise ValueError(f"Unsupported file type: {suffix}")


def get_user_upload_dir(user_id: str) -> Path:
    path = UPLOADS_DIR / user_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def list_user_datasets(user_id: str) -> list[dict]:
    meta_file = get_user_upload_dir(user_id) / "datasets_meta.json"
    if not meta_file.exists():
        return []
    with open(meta_file, "r", encoding="utf-8") as f:
        return json.load(f)


def save_datasets_meta(user_id: str, datasets: list[dict]) -> None:
    meta_file = get_user_upload_dir(user_id) / "datasets_meta.json"
    with open(meta_file, "w", encoding="utf-8") as f:
        json.dump(datasets, f, indent=2, default=str)


def find_dataset(user_id: str, dataset_id: str) -> dict | None:
    for ds in list_user_datasets(user_id):
        if ds["id"] == dataset_id:
            return ds
    return None


def get_dataset_path(user_id: str, dataset_id: str) -> Path | None:
    ds = find_dataset(user_id, dataset_id)
    if not ds:
        return None
    path = Path(ds["file_path"])
    return path if path.exists() else None


def get_ml_dir(user_id: str, dataset_id: str) -> Path:
    path = get_user_upload_dir(user_id) / "ml_models" / dataset_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_ml_results(user_id: str, dataset_id: str, results: dict) -> None:
    ml_dir = get_ml_dir(user_id, dataset_id)
    metadata_file = ml_dir / "ml_results.json"
    with open(metadata_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, default=str)


def load_ml_results(user_id: str, dataset_id: str) -> dict | None:
    ml_dir = get_ml_dir(user_id, dataset_id)
    metadata_file = ml_dir / "ml_results.json"
    if not metadata_file.exists():
        return None
    with open(metadata_file, "r", encoding="utf-8") as f:
        return json.load(f)


def analyze_dataframe(df: pd.DataFrame) -> dict:
    missing = df.isnull().sum().to_dict()
    dtypes = {col: str(dtype) for col, dtype in df.dtypes.items()}

    stats = {}
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        series = df[col].dropna()
        if len(series) == 0:
            continue
        stats[col] = {
            "mean": float(series.mean()),
            "median": float(series.median()),
            "std": float(series.std()) if len(series) > 1 else 0.0,
            "min": float(series.min()),
            "max": float(series.max()),
        }

    sample_rows = df.head(5).replace({np.nan: None}).to_dict(orient="records")

    return {
        "rows": int(len(df)),
        "columns": int(len(df.columns)),
        "column_names": list(df.columns.astype(str)),
        "dtypes": dtypes,
        "missing_values": {k: int(v) for k, v in missing.items()},
        "duplicate_rows": int(df.duplicated().sum()),
        "statistics": stats,
        "sample_rows": sample_rows,
    }


def build_metadata_for_ai(df: pd.DataFrame, name: str) -> str:
    overview = analyze_dataframe(df)
    lines = [
        f"Dataset Name: {name}",
        f"Rows: {overview['rows']}, Columns: {overview['columns']}",
        f"Columns: {', '.join(overview['column_names'])}",
        f"Data Types: {json.dumps(overview['dtypes'])}",
        f"Missing Values: {json.dumps(overview['missing_values'])}",
        f"Duplicate Rows: {overview['duplicate_rows']}",
        f"Sample Rows (first 5):\n{json.dumps(overview['sample_rows'], indent=2)}",
    ]
    if overview["statistics"]:
        lines.append(f"Numeric Statistics: {json.dumps(overview['statistics'], indent=2)}")
    return "\n".join(lines)


def save_uploaded_file(user_id: str, filename: str, content: bytes) -> dict:
    dataset_id = str(uuid.uuid4())
    user_dir = get_user_upload_dir(user_id)
    safe_name = f"{dataset_id}_{Path(filename).name}"
    file_path = user_dir / safe_name
    file_path.write_bytes(content)

    df = load_dataframe(file_path)
    overview = analyze_dataframe(df)
    display_name = Path(filename).stem

    record = {
        "id": dataset_id,
        "name": display_name,
        "filename": filename,
        "file_path": str(file_path),
        "rows": overview["rows"],
        "columns": overview["columns"],
        "column_names": overview["column_names"],
        "dtypes": overview["dtypes"],
        "missing_values": overview["missing_values"],
        "duplicate_rows": overview["duplicate_rows"],
        "statistics": overview["statistics"],
        "ai_insights": None,
    }

    datasets = list_user_datasets(user_id)
    datasets.append(record)
    save_datasets_meta(user_id, datasets)
    return record


def delete_dataset(user_id: str, dataset_id: str) -> bool:
    datasets = list_user_datasets(user_id)
    target = None
    for ds in datasets:
        if ds["id"] == dataset_id:
            target = ds
            break
    if not target:
        return False

    path = Path(target["file_path"])
    if path.exists():
        path.unlink()

    datasets = [d for d in datasets if d["id"] != dataset_id]
    save_datasets_meta(user_id, datasets)
    return True


def update_dataset_insights(user_id: str, dataset_id: str, insights: str) -> None:
    datasets = list_user_datasets(user_id)
    for ds in datasets:
        if ds["id"] == dataset_id:
            ds["ai_insights"] = insights
            break
    save_datasets_meta(user_id, datasets)
