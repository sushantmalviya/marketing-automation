from .equals import (
    EqualsCondition
)

from .marketing import (
    AndCondition,
    BooleanCompareCondition,
    ContainsCondition,
    DateCompareCondition,
    EmptyCondition,
    ExistsCondition,
    NotCondition,
    NotContainsCondition,
    NotEqualsCondition,
    OrCondition,
    CommunicationEventCondition,
)


CONDITION_REGISTRY = {

    "EQUALS":
        EqualsCondition(),

    "NOT_EQUALS":
        NotEqualsCondition(),

    "CONTAINS":
        ContainsCondition(),

    "NOT_CONTAINS":
        NotContainsCondition(),

    "EXISTS":
        ExistsCondition(),

    "EMPTY":
        EmptyCondition(),

    "DATE_COMPARE":
        DateCompareCondition(),

    "BOOLEAN_COMPARE":
        BooleanCompareCondition(),

    "AND":
        AndCondition(),

    "OR":
        OrCondition(),

    "NOT":
        NotCondition(),

    "ConditionSplit":
        CommunicationEventCondition(),
}
