from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.auth import get_current_user
from app.dataset_service import (
    analyze_dataframe,
    build_metadata_for_ai,
    delete_dataset,
    find_dataset,
    get_dataset_path,
    list_user_datasets,
    load_dataframe,
    load_ml_results,
    save_uploaded_file,
    update_dataset_insights,
)
from app.gemini_service import generate_dataset_insights
from app.ml_service import (
    detect_problem_type,
    export_model_path,
    predict_model,
    train_models_for_dataset,
)
from app.schemas import (
    ChartRequest,
    MLDetectRequest,
    MLPredictRequest,
    MLTrainRequest,
)

router = APIRouter(prefix="/api/datasets", tags=["datasets"])

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".json"}


@router.get("")
def get_datasets(user: dict = Depends(get_current_user)):
    return {"datasets": list_user_datasets(user["id"])}


@router.get("/{dataset_id}")
def get_dataset(dataset_id: str, user: dict = Depends(get_current_user)):
    ds = find_dataset(user["id"], dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    file_path = get_dataset_path(user["id"], dataset_id)
    if file_path:
        df = load_dataframe(file_path)
        overview = analyze_dataframe(df)
        ds = {**ds, **overview}

    return ds


@router.post("/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="File is empty")

    try:
        record = save_uploaded_file(user["id"], file.filename, content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process file: {str(e)}")

    return {"message": "Upload successful", "dataset": record}


@router.post("/{dataset_id}/insights")
def generate_insights(dataset_id: str, user: dict = Depends(get_current_user)):
    ds = find_dataset(user["id"], dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    file_path = get_dataset_path(user["id"], dataset_id)
    if not file_path:
        raise HTTPException(status_code=404, detail="Dataset file not found")

    try:
        df = load_dataframe(file_path)
        metadata = build_metadata_for_ai(df, ds["name"])
        insights = generate_dataset_insights(metadata)
        update_dataset_insights(user["id"], dataset_id, insights)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI insights failed: {str(e)}")

    return {"insights": insights}


@router.get("/{dataset_id}/ml/results")
def get_ml_results(dataset_id: str, user: dict = Depends(get_current_user)):
    ds = find_dataset(user["id"], dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    results = load_ml_results(user["id"], dataset_id)
    if not results:
        raise HTTPException(status_code=404, detail="No ML results available")
    return {"results": results}


@router.post("/{dataset_id}/ml/detect")
def detect_ml_problem(dataset_id: str, body: MLDetectRequest, user: dict = Depends(get_current_user)):
    ds = find_dataset(user["id"], dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    file_path = get_dataset_path(user["id"], dataset_id)
    if not file_path:
        raise HTTPException(status_code=404, detail="Dataset file not found")

    df = load_dataframe(file_path)
    try:
        problem_type = detect_problem_type(df, body.target_column)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"problem_type": problem_type}


@router.post("/{dataset_id}/ml/train")
def train_ml_models(dataset_id: str, body: MLTrainRequest, user: dict = Depends(get_current_user)):
    ds = find_dataset(user["id"], dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    file_path = get_dataset_path(user["id"], dataset_id)
    if not file_path:
        raise HTTPException(status_code=404, detail="Dataset file not found")

    df = load_dataframe(file_path)
    try:
        results = train_models_for_dataset(
            user["id"],
            dataset_id,
            df,
            body.target_column,
            selected_models=body.models,
            include_clustering=body.include_clustering,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ML training failed: {str(e)}")

    return results


@router.post("/{dataset_id}/ml/predict")
def predict_with_model(dataset_id: str, body: MLPredictRequest, user: dict = Depends(get_current_user)):
    ds = find_dataset(user["id"], dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        result = predict_model(user["id"], dataset_id, body.model_name, body.features)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

    return result


@router.get("/{dataset_id}/ml/export/{model_name}")
def export_ml_model(dataset_id: str, model_name: str, user: dict = Depends(get_current_user)):
    ds = find_dataset(user["id"], dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        path = export_model_path(user["id"], dataset_id, model_name)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return FileResponse(path, filename=path.name, media_type="application/octet-stream")


@router.delete("/{dataset_id}")
def remove_dataset(dataset_id: str, user: dict = Depends(get_current_user)):
    if not delete_dataset(user["id"], dataset_id):
        raise HTTPException(status_code=404, detail="Dataset not found")
    return {"message": "Dataset deleted"}
