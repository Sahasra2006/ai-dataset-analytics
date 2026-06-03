import base64
import io
import pickle
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    recall_score,
    r2_score,
    roc_auc_score,
    silhouette_score,
)
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, OrdinalEncoder, StandardScaler
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.model_selection import train_test_split

from app.dataset_service import get_ml_dir, save_ml_results


def normalize_model_name(model_name: str) -> str:
    return model_name.lower().replace(" ", "_")


def detect_problem_type(df: pd.DataFrame, target_column: str) -> str:
    if target_column not in df.columns:
        raise ValueError("Target column not found")
    target = df[target_column].dropna()
    if len(target) == 0:
        raise ValueError("Target column contains no usable values")

    if pd.api.types.is_numeric_dtype(target):
        unique_count = target.nunique()
        if unique_count <= max(10, int(len(df) * 0.05)) and np.all(np.equal(np.mod(target.dropna(), 1), 0)):
            return "classification"
        return "regression"

    return "classification"


def build_preprocessor(df: pd.DataFrame, feature_columns: list[str]) -> tuple[ColumnTransformer, list[str]]:
    features = df[feature_columns]
    numeric_features = features.select_dtypes(include=[np.number]).columns.tolist()
    categorical_features = features.select_dtypes(exclude=[np.number]).columns.tolist()

    numeric_transformer = Pipeline(
        [
            ("imputer", SimpleImputer(strategy="mean")),
            ("scaler", StandardScaler()),
        ]
    )
    categorical_transformer = Pipeline(
        [
            ("imputer", SimpleImputer(strategy="most_frequent", fill_value="missing")),
            ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]
    )

    preprocessor = ColumnTransformer(
        [
            ("num", numeric_transformer, numeric_features),
            ("cat", categorical_transformer, categorical_features),
        ],
        remainder="drop",
    )

    processed_feature_names = []
    if numeric_features:
        processed_feature_names.extend(numeric_features)
    if categorical_features:
        encoder = categorical_transformer.named_steps["encoder"]
        encoder.fit(features[categorical_features].fillna("missing"))
        encoded_names = encoder.get_feature_names_out(categorical_features)
        processed_feature_names.extend(encoded_names.tolist())

    return preprocessor, processed_feature_names


def encode_target(target: pd.Series, problem_type: str):
    if problem_type != "classification":
        return target.astype(float).to_numpy(), None

    if pd.api.types.is_numeric_dtype(target) and not pd.api.types.is_float_dtype(target):
        return target.astype(int).to_numpy(), None

    encoder = OrdinalEncoder(dtype=int)
    encoded = encoder.fit_transform(target.astype(str).to_numpy().reshape(-1, 1)).ravel()
    return encoded, encoder


def evaluate_regression(y_true, y_pred) -> dict:
    mse = float(mean_squared_error(y_true, y_pred))
    rmse = float(np.sqrt(mse))
    return {
        "mse": mse,
        "rmse": rmse,
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "r2": float(r2_score(y_true, y_pred)),
    }


def evaluate_classification(y_true, y_pred, y_score=None) -> dict:
    metrics = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, average="weighted", zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, average="weighted", zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, average="weighted", zero_division=0)),
    }
    if y_score is not None and len(np.unique(y_true)) == 2:
        try:
            metrics["roc_auc"] = float(roc_auc_score(y_true, y_score))
        except Exception:
            metrics["roc_auc"] = None
    return metrics


def can_stratify(y: np.ndarray) -> bool:
    values, counts = np.unique(y, return_counts=True)
    return len(values) > 1 and np.all(counts >= 2)


def get_feature_importance(pipeline: Pipeline, feature_names: list[str]) -> list[dict] | None:
    model = pipeline.named_steps["model"]
    if hasattr(model, "feature_importances_"):
        importances = model.feature_importances_
    elif hasattr(model, "coef_"):
        coeffs = model.coef_
        importances = np.mean(np.abs(coeffs), axis=0).ravel()
    else:
        return None

    if len(importances) != len(feature_names):
        return None

    importance_pairs = sorted(
        zip(feature_names, importances), key=lambda item: item[1], reverse=True
    )
    return [{"feature": name, "importance": float(value)} for name, value in importance_pairs]


def build_metrics_chart(metrics: dict, problem_type: str) -> str:
    if not metrics:
        return ""

    primary = "r2" if problem_type == "regression" else "f1"
    chart_values = {name: values.get(primary) for name, values in metrics.items() if values.get(primary) is not None}
    if not chart_values:
        return ""

    fig, ax = plt.subplots(figsize=(6, 3))
    model_names = list(chart_values.keys())
    scores = [chart_values[name] for name in model_names]
    ax.bar(model_names, scores, color="#2563eb")
    ax.set_ylabel(primary.upper())
    ax.set_title(f"Model comparison ({primary.upper()})")
    ax.set_xticks(range(len(model_names)))
    ax.set_xticklabels(model_names, rotation=45, ha="right")
    plt.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight")
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode()


def build_feature_importance_chart(feature_importance: list[dict]) -> str:
    if not feature_importance:
        return ""
    names = [row["feature"] for row in feature_importance[:20]]
    values = [row["importance"] for row in feature_importance[:20]]
    fig, ax = plt.subplots(figsize=(6, 3))
    ax.barh(names[::-1], values[::-1], color="#10b981")
    ax.set_title("Feature importance")
    ax.set_xlabel("Importance")
    plt.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight")
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode()


def train_models_for_dataset(
    user_id: str,
    dataset_id: str,
    df: pd.DataFrame,
    target_column: str,
    selected_models: list[str] | None = None,
    include_clustering: bool = True,
) -> dict:
    if target_column not in df.columns:
        raise ValueError("Target column not found")

    problem_type = detect_problem_type(df, target_column)
    feature_columns = [col for col in df.columns if col != target_column]
    if not feature_columns:
        raise ValueError("No feature columns available for training")

    preprocessor, processed_feature_names = build_preprocessor(df, feature_columns)
    raw_feature_names = feature_columns
    y_raw = df[target_column]
    y_encoded, target_encoder = encode_target(y_raw, problem_type)
    stratify_values = y_encoded if problem_type == "classification" and can_stratify(y_encoded) else None
    X_train, X_test, y_train, y_test = train_test_split(
        df[feature_columns],
        y_encoded,
        test_size=0.2,
        random_state=42,
        stratify=stratify_values,
    )

    selected_models = selected_models or []
    model_names = []
    results = {}

    if problem_type == "regression":
        supervised_builders = {
            "Linear Regression": LinearRegression,
            "Decision Tree": DecisionTreeRegressor,
            "Random Forest": RandomForestRegressor,
            "KNN": KNeighborsRegressor,
        }
    else:
        supervised_builders = {
            "Decision Tree": DecisionTreeClassifier,
            "Random Forest": RandomForestClassifier,
            "Logistic Regression": LogisticRegression,
            "KNN": KNeighborsClassifier,
        }

    for name, builder in supervised_builders.items():
        if name not in selected_models:
            continue
        model_kwargs = {}
        if name == "KNN":
            k = min(5, max(1, len(X_train)))
            model_kwargs["n_neighbors"] = k
        if name == "Logistic Regression":
            model_kwargs["max_iter"] = 1000

        pipeline = Pipeline(
            [
                ("preprocessor", preprocessor),
                ("model", builder(**model_kwargs)),
            ]
        )
        try:
            pipeline.fit(X_train, y_train)
        except Exception as exc:
            results[name] = {
                "problem_type": problem_type,
                "metrics": {},
                "feature_importance": None,
                "feature_names": raw_feature_names,
                "error": str(exc),
            }
            model_names.append(name)
            continue

        try:
            y_pred = pipeline.predict(X_test)
        except Exception as exc:
            results[name] = {
                "problem_type": problem_type,
                "metrics": {},
                "feature_importance": None,
                "feature_names": raw_feature_names,
                "error": str(exc),
            }
            model_names.append(name)
            continue

        y_score = None
        if problem_type == "classification" and hasattr(pipeline.named_steps["model"], "predict_proba") and len(np.unique(y_test)) == 2:
            try:
                y_score = pipeline.predict_proba(X_test)[:, 1]
            except Exception:
                y_score = None

        score = (
            evaluate_classification(y_test, y_pred, y_score)
            if problem_type == "classification"
            else evaluate_regression(y_test, y_pred)
        )
        importance = get_feature_importance(pipeline, processed_feature_names)
        results[name] = {
            "problem_type": problem_type,
            "metrics": score,
            "feature_importance": importance,
            "feature_names": raw_feature_names,
        }
        model_names.append(name)
        save_model_pickle(user_id, dataset_id, name, pipeline, problem_type, raw_feature_names, target_encoder)

    clustering_result = None
    if include_clustering and len(df) > 1:
        n_clusters = min(3, max(1, len(df) - 1))
        kmeans = Pipeline(
            [("preprocessor", preprocessor), ("model", KMeans(n_clusters=n_clusters, random_state=42))]
        )
        kmeans.fit(df[feature_columns])
        X_processed = kmeans.named_steps["preprocessor"].transform(df[feature_columns])
        labels = kmeans.named_steps["model"].labels_
        n_samples = X_processed.shape[0]
        n_labels = len(np.unique(labels))
        silhouette = None
        if 2 <= n_labels < n_samples:
            silhouette = float(silhouette_score(X_processed, labels))
        clustering_metrics = {
            "inertia": float(kmeans.named_steps["model"].inertia_),
            "silhouette": silhouette,
        }
        results["K-Means Clustering"] = {
            "problem_type": "clustering",
            "metrics": clustering_metrics,
            "feature_importance": None,
            "feature_names": raw_feature_names,
        }
        save_model_pickle(user_id, dataset_id, "K-Means Clustering", kmeans, "clustering", raw_feature_names, None)
        model_names.append("K-Means Clustering")

    best_model = determine_best_model(results, problem_type)
    plots = {
        "comparison_chart": build_metrics_chart({name: values["metrics"] for name, values in results.items() if values["problem_type"] != "clustering"}, problem_type),
        "feature_importance_chart": build_feature_importance_chart(results[best_model].get("feature_importance", [])) if results.get(best_model) else "",
    }

    response = {
        "problem_type": problem_type,
        "target_column": target_column,
        "feature_columns": feature_columns,
        "model_names": model_names,
        "best_model": best_model,
        "results": results,
        "plots": plots,
        "target_classes": target_encoder.categories_[0].tolist() if target_encoder is not None else None,
    }
    save_ml_results(user_id, dataset_id, response)
    return response


def determine_best_model(results: dict, problem_type: str) -> str:
    best_name = None
    best_score = float("-inf")

    for name, info in results.items():
        metrics = info["metrics"]
        if info["problem_type"] == "clustering":
            score = metrics.get("silhouette") or metrics.get("inertia")
        elif problem_type == "regression":
            score = metrics.get("r2", float("-inf"))
        else:
            score = metrics.get("f1", float("-inf"))

        if score is None:
            continue
        if score > best_score:
            best_score = score
            best_name = name

    return best_name or next(iter(results.keys()))


def save_model_pickle(user_id: str, dataset_id: str, model_name: str, pipeline, problem_type: str, feature_names: list[str], target_encoder):
    model_path = get_ml_dir(user_id, dataset_id) / f"{normalize_model_name(model_name)}.pkl"
    payload = {
        "pipeline": pipeline,
        "problem_type": problem_type,
        "feature_names": feature_names,
        "target_encoder": target_encoder,
        "model_name": model_name,
    }
    with open(model_path, "wb") as f:
        pickle.dump(payload, f)


def load_model(user_id: str, dataset_id: str, model_name: str) -> dict:
    model_path = get_ml_dir(user_id, dataset_id) / f"{normalize_model_name(model_name)}.pkl"
    if not model_path.exists():
        raise FileNotFoundError("Model file not found")
    with open(model_path, "rb") as f:
        return pickle.load(f)


def predict_model(user_id: str, dataset_id: str, model_name: str, features: dict) -> dict:
    model_data = load_model(user_id, dataset_id, model_name)
    pipeline = model_data["pipeline"]
    feature_names = model_data["feature_names"]
    if set(features.keys()) != set(feature_names):
        raise ValueError("Feature values must include all model features")
    values = [features[name] for name in feature_names]
    df = pd.DataFrame([values], columns=feature_names)
    prediction = pipeline.predict(df)
    if model_data["problem_type"] == "classification" and model_data["target_encoder"] is not None:
        decoded = model_data["target_encoder"].inverse_transform(prediction.reshape(-1, 1)).ravel()[0]
        return {"prediction": decoded}
    return {"prediction": prediction[0].item() if hasattr(prediction[0], "item") else prediction[0]}


def export_model_path(user_id: str, dataset_id: str, model_name: str) -> Path:
    model_path = get_ml_dir(user_id, dataset_id) / f"{normalize_model_name(model_name)}.pkl"
    if not model_path.exists():
        raise FileNotFoundError("Model export file not found")
    return model_path
