from apps.campaigns.models import CustomerRecord, Audience
from apps.common.ownership import filter_customer_records_for_admin
from django.db.models import Q

OPERATOR_MAP = {
    "=": "",
    "is": "",
    "!=": "",
    "contains": "__icontains",
    "startswith": "__istartswith",
    "endswith": "__iendswith",
    ">": "__gt",
    "greater_than": "__gt",
    "<": "__lt",
    "less_than": "__lt",
    ">=": "__gte",
    "<=": "__lte",
}


class AudienceService:

    @staticmethod
    def _base_queryset(user):
        """All CustomerRecords accessible to this user."""
        return filter_customer_records_for_admin(
            CustomerRecord.objects.all(), user
        )

    @staticmethod
    def _apply_definition(queryset, audience_definition):
        """
        Apply filter conditions from audience_definition to queryset.
        Returns unfiltered queryset if no conditions defined.
        """
        from apps.campaigns.utils import normalize_column_name

        def numeric_value(value):
            try:
                return float(value)
            except (TypeError, ValueError):
                return value

        def condition_query(condition):
            field = normalize_column_name(condition["field"])
            operator = str(condition.get("operator", "=")).lower()
            value = condition.get("value")

            # Special field: source → maps to _source or __source__ in data
            if field in ("source", "_source", "__source__"):
                lookup = OPERATOR_MAP.get(operator)
                if lookup is None:
                    raise ValueError(f"Unsupported operator: {operator}")
                query_part = Q(**{f"data___source{lookup}": value}) | Q(**{f"data____source__{lookup}": value})
                return ~query_part if operator in ("!=", "is_not") else query_part

            if operator == "between":
                return (
                    Q(**{f"data__{field}__gte": numeric_value(value)})
                    & Q(**{f"data__{field}__lte": numeric_value(condition.get("value_to"))})
                )
            lookup = OPERATOR_MAP.get(operator)
            if lookup is None:
                raise ValueError(f"Unsupported operator: {operator}")
            if operator in {">", "<", ">=", "<=", "greater_than", "less_than"}:
                value = numeric_value(value)
            query_part = Q(**{f"data__{field}{lookup}": value})
            return ~query_part if operator == "!=" else query_part

        def combine(conditions, operator="AND"):
            combined = Q()
            for condition in conditions:
                part = condition_query(condition)
                combined = (
                    combined & part if operator.upper() == "AND" else combined | part
                )
            return combined

        groups = audience_definition.get("groups") or []
        base_group_ids = audience_definition.get("base_group_ids") or []
        
        if base_group_ids:
            from apps.campaigns.models import Audience
            base_groups = Audience.objects.filter(id__in=base_group_ids)
            combined_base_qs = queryset.model.objects.none()
            for bg in base_groups:
                bg_def = bg.definition or {}
                if str(bg_def.get("type", "DYNAMIC")).upper() == "STATIC":
                    combined_base_qs = combined_base_qs | queryset.model.objects.filter(id__in=bg_def.get("static_ids", []))
                else:
                    combined_base_qs = combined_base_qs | AudienceService._apply_definition(queryset.model.objects.all(), bg_def)
            queryset = queryset.filter(id__in=combined_base_qs.values("id"))

        if groups:
            query = Q()
            groups_operator = str(
                audience_definition.get("groups_operator", "OR")
            ).upper()
            for group in groups:
                group_query = combine(
                    group.get("conditions", []),
                    str(group.get("operator", "AND")),
                )
                query = (
                    query & group_query
                    if groups_operator == "AND"
                    else query | group_query
                )
        else:
            flat_conditions = audience_definition.get("conditions", [])
            if flat_conditions:
                query = combine(
                    flat_conditions,
                    str(audience_definition.get("operator", "AND")),
                )
            else:
                return queryset

        return queryset.filter(query)

    @staticmethod
    def create_audience(*, validated_data, user):
        definition = validated_data["definition"]
        seg_type = str((definition or {}).get("type", "DYNAMIC")).upper()

        # For STATIC segments: snapshot matching record IDs now
        if seg_type == "STATIC":
            if definition.get("is_group"):
                # Groups start explicitly empty
                definition = {**definition, "static_ids": []}
            else:
                base_qs = AudienceService._base_queryset(user)
                matched_ids = list(
                    AudienceService._apply_definition(base_qs, definition)
                    .values_list("id", flat=True)[:10000]
                )
                definition = {**definition, "static_ids": matched_ids}

        return Audience.objects.create(
            name=validated_data["name"],
            customer_upload=validated_data.get("customer_upload"),
            definition=definition,
            created_by=user,
        )

    @staticmethod
    def get_customers(*, user=None, audience_definition, customer_upload=None):
        """
        Return CustomerRecord queryset matching the audience definition.
        - DYNAMIC: re-evaluates conditions against all current contacts.
        - STATIC: returns only the snapshotted IDs stored at creation.
        - Falls back to upload-scoped query if user not provided (legacy).
        """
        seg_type = str((audience_definition or {}).get("type", "DYNAMIC")).upper()

        # STATIC: use snapshotted IDs
        if seg_type == "STATIC":
            static_ids = (audience_definition or {}).get("static_ids", [])
            if user:
                return AudienceService._base_queryset(user).filter(id__in=static_ids)
            if customer_upload:
                return CustomerRecord.objects.filter(
                    upload=customer_upload, id__in=static_ids
                )
            return CustomerRecord.objects.filter(id__in=static_ids)

        # DYNAMIC: apply conditions
        if user:
            base_qs = AudienceService._base_queryset(user)
        elif customer_upload:
            base_qs = CustomerRecord.objects.filter(upload=customer_upload)
        else:
            base_qs = CustomerRecord.objects.all()

        return AudienceService._apply_definition(base_qs, audience_definition)

    @staticmethod
    def preview_audience(*, user=None, audience_definition, customer_upload=None):
        return AudienceService.get_customers(
            user=user,
            customer_upload=customer_upload,
            audience_definition=audience_definition,
        )
