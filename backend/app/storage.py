import json
import uuid
from pathlib import Path
from typing import Any

from app.config import CHATS_FILE, USERS_FILE


def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str)


# --- Users ---

def get_users() -> list[dict]:
    return _read_json(USERS_FILE, [])


def save_users(users: list[dict]) -> None:
    _write_json(USERS_FILE, users)


def find_user_by_email(email: str) -> dict | None:
    email = email.lower().strip()
    for user in get_users():
        if user.get("email", "").lower() == email:
            return user
    return None


def find_user_by_id(user_id: str) -> dict | None:
    for user in get_users():
        if user.get("id") == user_id:
            return user
    return None


def create_user(email: str, hashed_password: str, name: str) -> dict:
    users = get_users()
    user = {
        "id": str(uuid.uuid4()),
        "email": email.lower().strip(),
        "name": name.strip(),
        "password": hashed_password,
    }
    users.append(user)
    save_users(users)
    return user


# --- Chats ---

def get_chats() -> list[dict]:
    return _read_json(CHATS_FILE, [])


def save_chats(chats: list[dict]) -> None:
    _write_json(CHATS_FILE, chats)


def get_user_chats(user_id: str) -> list[dict]:
    return [c for c in get_chats() if c.get("user_id") == user_id]


def find_chat(chat_id: str, user_id: str) -> dict | None:
    for chat in get_chats():
        if chat.get("id") == chat_id and chat.get("user_id") == user_id:
            return chat
    return None


def create_chat(user_id: str, dataset_id: str, title: str) -> dict:
    chats = get_chats()
    chat = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "dataset_id": dataset_id,
        "title": title,
        "messages": [],
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    chats.append(chat)
    save_chats(chats)
    return chat


def update_chat(chat: dict) -> dict:
    chats = get_chats()
    chat["updated_at"] = _now_iso()
    for i, c in enumerate(chats):
        if c["id"] == chat["id"]:
            chats[i] = chat
            break
    save_chats(chats)
    return chat


def delete_chat(chat_id: str, user_id: str) -> bool:
    chats = get_chats()
    new_chats = [c for c in chats if not (c["id"] == chat_id and c["user_id"] == user_id)]
    if len(new_chats) == len(chats):
        return False
    save_chats(new_chats)
    return True


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
