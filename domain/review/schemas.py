from pydantic import BaseModel

from .models import ReviewRating


class ReviewCreate(BaseModel):
    artifact_id: str
    rating: ReviewRating


class ReviewOut(BaseModel):
    id: str
    artifact_id: str
    rating: ReviewRating
    created_at: str
