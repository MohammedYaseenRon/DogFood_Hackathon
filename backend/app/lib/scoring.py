from app.models import RubricCriterion


def weighted_total(criteria: dict[str, float], rubric: list[RubricCriterion]) -> float:
    if not criteria:
        return 0.0

    weights = {item.name: item.weight for item in rubric}
    total_weight = sum(weights.get(name, 1.0) for name in criteria)
    if total_weight == 0:
        return 0.0

    numerator = sum(float(criteria[name]) * weights.get(name, 1.0) for name in criteria)
    return round(numerator / total_weight, 2)


def validate_criteria(criteria: dict[str, float], rubric: list[RubricCriterion]) -> None:
    allowed = {item.name for item in rubric}
    unknown = set(criteria.keys()) - allowed
    if unknown:
        raise ValueError(f"Unknown criteria: {', '.join(sorted(unknown))}")

    for name, value in criteria.items():
        if not isinstance(value, (int, float)):
            raise ValueError(f"Criterion {name} must be numeric")
        if value < 1 or value > 5:
            raise ValueError(f"Criterion {name} must be between 1 and 5")
