from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.dataset_service import build_metadata_for_ai, find_dataset, get_dataset_path, load_dataframe
from app.gemini_service import chat_with_dataset
from app.schemas import ChatCreateRequest, ChatMessageRequest
from app.storage import create_chat, delete_chat, find_chat, get_user_chats, update_chat

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.get("")
def list_chats(user: dict = Depends(get_current_user)):
    chats = get_user_chats(user["id"])
    summary = [
        {
            "id": c["id"],
            "title": c["title"],
            "dataset_id": c["dataset_id"],
            "updated_at": c.get("updated_at"),
            "message_count": len(c.get("messages", [])),
        }
        for c in chats
    ]
    summary.sort(key=lambda x: x.get("updated_at") or "", reverse=True)
    return {"chats": summary}


@router.get("/{chat_id}")
def get_chat(chat_id: str, user: dict = Depends(get_current_user)):
    chat = find_chat(chat_id, user["id"])
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat


@router.post("")
def start_chat(body: ChatCreateRequest, user: dict = Depends(get_current_user)):
    ds = find_dataset(user["id"], body.dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    title = body.title or f"Chat about {ds['name']}"
    chat = create_chat(user["id"], body.dataset_id, title)
    return chat


@router.post("/{chat_id}/message")
def send_message(
    chat_id: str,
    body: ChatMessageRequest,
    user: dict = Depends(get_current_user),
):
    chat = find_chat(chat_id, user["id"])
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    ds = find_dataset(user["id"], chat["dataset_id"])
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    file_path = get_dataset_path(user["id"], chat["dataset_id"])
    if not file_path:
        raise HTTPException(status_code=404, detail="Dataset file not found")

    try:
        df = load_dataframe(file_path)
        metadata = build_metadata_for_ai(df, ds["name"])
        history = chat.get("messages", [])
        reply = chat_with_dataset(metadata, history, body.message)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")

    chat["messages"].append({"role": "user", "content": body.message})
    chat["messages"].append({"role": "assistant", "content": reply})
    update_chat(chat)

    return {"reply": reply, "chat": chat}


@router.delete("/{chat_id}")
def remove_chat(chat_id: str, user: dict = Depends(get_current_user)):
    if not delete_chat(chat_id, user["id"]):
        raise HTTPException(status_code=404, detail="Chat not found")
    return {"message": "Chat deleted"}
