from pydantic import BaseModel


class TagMasteryScore(BaseModel):
    user_id: str
    tag_id: str
    tag_name: str
    resolved_count: int = 0
    total_count: int = 0

    @property
    def mastery_score(self) -> float:
        if self.total_count == 0:
            return 0.0
        return self.resolved_count / self.total_count


class UserProgress(BaseModel):
    user_id: str
    streak_days: int = 0
    total_captures: int = 0
    total_resolved: int = 0
    tag_scores: list[TagMasteryScore] = []
