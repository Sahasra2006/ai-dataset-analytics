from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChatCreateRequest(BaseModel):
    dataset_id: str
    title: str | None = None


class ChatMessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


class ChartRequest(BaseModel):
    chart_type: str
    x_column: str
    y_column: str | None = None


class MLDetectRequest(BaseModel):
    target_column: str


class MLTrainRequest(BaseModel):
    target_column: str
    models: list[str] | None = None
    include_clustering: bool = True


class MLPredictRequest(BaseModel):
    model_name: str
    features: dict[str, str | int | float | bool]
