from fastapi import APIRouter, Depends, HTTPException

from app.analysis_service import generate_chart, generate_report
from app.auth import get_current_user
from app.dataset_service import find_dataset, get_dataset_path, load_dataframe, analyze_dataframe
from app.schemas import ChartRequest

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


@router.get("/{dataset_id}/overview")
def dataset_overview(dataset_id: str, user: dict = Depends(get_current_user)):
    ds = find_dataset(user["id"], dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    file_path = get_dataset_path(user["id"], dataset_id)
    if not file_path:
        raise HTTPException(status_code=404, detail="Dataset file not found")

    df = load_dataframe(file_path)
    overview = analyze_dataframe(df)
    return {
        "dataset": ds,
        "overview": overview,
    }


@router.post("/{dataset_id}/chart")
def create_chart(
    dataset_id: str,
    body: ChartRequest,
    user: dict = Depends(get_current_user),
):
    if not find_dataset(user["id"], dataset_id):
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        result = generate_chart(
            user["id"],
            dataset_id,
            body.chart_type,
            body.x_column,
            body.y_column,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chart generation failed: {str(e)}")

    return result


@router.post("/{dataset_id}/report")
def create_report(dataset_id: str, user: dict = Depends(get_current_user)):
    ds = find_dataset(user["id"], dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        result = generate_report(user["id"], dataset_id, ds["name"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")

    return result
