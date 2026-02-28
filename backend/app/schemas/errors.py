from pydantic import BaseModel
from typing import Dict, Any, Optional


class ErrorDetail(BaseModel):
    code: str
    message: str
    domain: str
    status: int
    details: Optional[Dict[str, Any]] = None


class ErrorResponse(BaseModel):
    error: ErrorDetail
