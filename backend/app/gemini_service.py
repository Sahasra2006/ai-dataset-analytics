import google.generativeai as genai

from app.config import GEMINI_API_KEY


def _get_model():
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set in environment variables")
    genai.configure(api_key=GEMINI_API_KEY)
    return genai.GenerativeModel("gemini-2.5-flash")


def generate_dataset_insights(metadata: str) -> str:
    prompt = f"""You are a data analyst. Analyze this dataset metadata and sample data.

{metadata}

Provide a clear, structured explanation covering:
1. What this dataset is likely about
2. Probable business domain or use case
3. Most important columns and why
4. Data quality issues (missing values, duplicates, type issues)
5. Interesting observations or patterns

Use markdown headings and bullet points. Be concise but insightful."""

    model = _get_model()
    response = model.generate_content(prompt)
    return response.text


def chat_with_dataset(
    metadata: str,
    history: list[dict],
    user_message: str,
) -> str:
    history_text = ""
    for msg in history[-10:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        history_text += f"{role.upper()}: {content}\n"

    prompt = f"""You are a helpful dataset assistant. The user is asking questions about their dataset.

DATASET CONTEXT:
{metadata}

CONVERSATION HISTORY:
{history_text}

USER: {user_message}

Answer based on the dataset context. Be clear, accurate, and helpful. If you need to infer, say so. Support follow-up questions naturally."""

    model = _get_model()
    response = model.generate_content(prompt)
    return response.text
