import base64
import io
import uuid
from datetime import datetime, timezone
from pathlib import Path

import matplotlib
import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns

from app.config import EXPORTS_DIR, REPORTS_DIR
from app.dataset_service import analyze_dataframe, get_dataset_path, load_dataframe

matplotlib.use("Agg")
sns.set_theme(style="whitegrid")


def generate_chart(
    user_id: str,
    dataset_id: str,
    chart_type: str,
    x_column: str,
    y_column: str | None = None,
) -> dict:
    file_path = get_dataset_path(user_id, dataset_id)
    if not file_path:
        raise ValueError("Dataset not found")

    df = load_dataframe(file_path)
    if x_column not in df.columns:
        raise ValueError(f"Column '{x_column}' not found")
    if y_column and y_column not in df.columns:
        raise ValueError(f"Column '{y_column}' not found")

    fig, ax = plt.subplots(figsize=(10, 6))

    if chart_type == "bar":
        if y_column:
            grouped = df.groupby(x_column)[y_column].mean().head(20)
            grouped.plot(kind="bar", ax=ax)
        else:
            df[x_column].value_counts().head(20).plot(kind="bar", ax=ax)
    elif chart_type == "line":
        if not y_column:
            raise ValueError("Line chart requires y_column")
        plot_df = df[[x_column, y_column]].dropna().head(500)
        ax.plot(plot_df[x_column], plot_df[y_column])
    elif chart_type == "scatter":
        if not y_column:
            raise ValueError("Scatter chart requires y_column")
        plot_df = df[[x_column, y_column]].dropna().head(1000)
        ax.scatter(plot_df[x_column], plot_df[y_column], alpha=0.6)
    elif chart_type == "histogram":
        df[x_column].dropna().hist(ax=ax, bins=30, edgecolor="black")
    elif chart_type == "box":
        if y_column:
            df.boxplot(column=y_column, by=x_column, ax=ax)
        else:
            df.boxplot(column=x_column, ax=ax)
    elif chart_type == "heatmap":
        numeric = df.select_dtypes(include="number")
        if numeric.shape[1] < 2:
            raise ValueError("Need at least 2 numeric columns for heatmap")
        sns.heatmap(numeric.corr(), annot=True, fmt=".2f", cmap="coolwarm", ax=ax)
    else:
        raise ValueError(f"Unsupported chart type: {chart_type}")

    ax.set_title(f"{chart_type.title()} Chart")
    plt.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=100, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    image_b64 = base64.b64encode(buf.read()).decode("utf-8")

    chart_id = str(uuid.uuid4())
    user_exports = EXPORTS_DIR / user_id
    user_exports.mkdir(parents=True, exist_ok=True)
    chart_path = user_exports / f"{chart_id}.png"
    chart_path.write_bytes(base64.b64decode(image_b64))

    return {
        "chart_id": chart_id,
        "chart_type": chart_type,
        "x_column": x_column,
        "y_column": y_column,
        "image_base64": image_b64,
        "saved_path": str(chart_path),
    }


def generate_report(user_id: str, dataset_id: str, dataset_name: str) -> dict:
    file_path = get_dataset_path(user_id, dataset_id)
    if not file_path:
        raise ValueError("Dataset not found")

    df = load_dataframe(file_path)
    overview = analyze_dataframe(df)

    lines = [
        f"# Dataset Report: {dataset_name}",
        f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        "",
        "## Summary",
        f"- Rows: {overview['rows']}",
        f"- Columns: {overview['columns']}",
        f"- Duplicate Rows: {overview['duplicate_rows']}",
        "",
        "## Columns",
    ]
    for col in overview["column_names"]:
        dtype = overview["dtypes"].get(col, "unknown")
        missing = overview["missing_values"].get(col, 0)
        lines.append(f"- **{col}** ({dtype}) — missing: {missing}")

    if overview["statistics"]:
        lines.extend(["", "## Numeric Statistics", ""])
        for col, stat in overview["statistics"].items():
            lines.append(f"### {col}")
            for key, val in stat.items():
                lines.append(f"- {key}: {val:.4f}" if isinstance(val, float) else f"- {key}: {val}")

    content = "\n".join(lines)

    user_reports = REPORTS_DIR / user_id
    user_reports.mkdir(parents=True, exist_ok=True)
    report_id = str(uuid.uuid4())
    report_path = user_reports / f"{report_id}.md"
    report_path.write_text(content, encoding="utf-8")

    return {
        "report_id": report_id,
        "content": content,
        "saved_path": str(report_path),
    }
