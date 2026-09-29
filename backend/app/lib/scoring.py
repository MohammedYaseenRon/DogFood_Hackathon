from app.models import RubricCriterion

SCORE_MIN = 1
SCORE_MAX = 5


def weighted_total(criteria: dict[str, float], rubric: list[RubricCriterion]) -> float:
    """Weighted mean of a score's criteria on the 1-5 scale.

    Only criteria in the rubric count, so a criterion an organizer never defined
    can't sneak into a total. Without a rubric every criterion weighs 1.
    """
    if not criteria:
        return 0.0

    if rubric:
        weights = {item.name: item.weight for item in rubric if item.name in criteria}
    else:
        weights = {name: 1.0 for name in criteria}
    total_weight = sum(weights.values())
    if total_weight == 0:
        return 0.0

    numerator = sum(float(criteria[name]) * weight for name, weight in weights.items())
    return round(numerator / total_weight, 2)


def validate_criteria(criteria: dict[str, float], rubric: list[RubricCriterion]) -> None:
    """A score must rate every rubric criterion with a whole number from 1 to 5."""
    allowed = {item.name for item in rubric}
    unknown = set(criteria.keys()) - allowed
    if unknown:
        raise ValueError(f"Unknown criteria: {', '.join(sorted(unknown))}")

    missing = allowed - set(criteria.keys())
    if missing:
        raise ValueError(f"Score every criterion. Missing: {', '.join(sorted(missing))}")

    for name, value in criteria.items():
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"Criterion {name} must be a number")
        if float(value) != int(value):
            raise ValueError(f"Criterion {name} must be a whole number")
        if value < SCORE_MIN or value > SCORE_MAX:
            raise ValueError(f"Criterion {name} must be between {SCORE_MIN} and {SCORE_MAX}")
