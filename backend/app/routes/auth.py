from fastapi import APIRouter, HTTPException, status

from app.auth import create_access_token, hash_password, verify_password
from app.schemas import LoginRequest, RegisterRequest
from app.storage import create_user, find_user_by_email

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register")
def register(body: RegisterRequest):
    if find_user_by_email(body.email):
        raise HTTPException(status_code=400, detail="Email already registered")

    user = create_user(body.email, hash_password(body.password), body.name)
    token = create_access_token(user["id"], user["email"])
    return {
        "message": "Registration successful",
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user["id"], "email": user["email"], "name": user["name"]},
    }


@router.post("/login")
def login(body: LoginRequest):
    user = find_user_by_email(body.email)
    if not user or not verify_password(body.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user["id"], user["email"])
    return {
        "message": "Login successful",
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user["id"], "email": user["email"], "name": user["name"]},
    }


@router.post("/logout")
def logout():
    return {"message": "Logged out successfully. Please remove the token on the client."}
