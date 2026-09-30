import re
import difflib


class SmartColumnResolver:
    """
    Intelligent multi-tier column resolver that maps arbitrary CSV header names
    and data sample values to canonical field names: 'name', 'email', 'phone'.
    """

    # Core Regex Stems
    EMAIL_REGEX = re.compile(r"\b(e?mail|e[\s_]?mail|email[\s_]?addr(ess)?|mail[\s_]?id)\b", re.IGNORECASE)
    PHONE_REGEX = re.compile(
        r"\b(phone|mobile|mob|cell|tel|telephone|contact[\s_]?(no|num|number)?|ph[\s_]?(no|num)?|phone[\s_]?no|mobile[\s_]?no|number|whatsapp)\b",
        re.IGNORECASE,
    )
    FIRST_NAME_REGEX = re.compile(r"\b(first[\s_]?name|fname|given[\s_]?name)\b", re.IGNORECASE)
    LAST_NAME_REGEX = re.compile(r"\b(last[\s_]?name|lname|surname|family[\s_]?name)\b", re.IGNORECASE)
    NAME_REGEX = re.compile(
        r"\b(name|full[\s_]?name|cust(omer)?[\s_]?name|client[\s_]?name|user[\s_]?name|person[\s_]?name|lead[\s_]?name|member[\s_]?name|applicant[\s_]?name)\b",
        re.IGNORECASE,
    )

    # Data value patterns for Tier 3 auto-detection
    EMAIL_VALUE_REGEX = re.compile(r"^[\w\.-]+@[\w\.-]+\.\w+$")
    PHONE_VALUE_REGEX = re.compile(r"^\+?[0-9\s\-\(\)]{7,18}$")

    @classmethod
    def clean_header(cls, text: str) -> str:
        if not text:
            return ""
        s = str(text).strip().lower()
        s = re.sub(r"[^\w\s_]", "", s)
        s = re.sub(r"[\s_]+", " ", s).strip()
        return s

    @classmethod
    def resolve_header(cls, header: str, sample_values: list = None) -> str:
        """
        Resolves a single column header string (and optional sample cell values)
        to a canonical key ('name', 'email', 'phone') or a clean snake_case string.
        """
        raw_header = str(header).strip()
        cleaned = cls.clean_header(raw_header)

        if not cleaned:
            return "unnamed_column"

        # Tier 1 & 2: Direct STEM and Regex matching
        if cls.FIRST_NAME_REGEX.search(cleaned):
            return "first_name"

        if cls.LAST_NAME_REGEX.search(cleaned):
            return "last_name"

        if cls.EMAIL_REGEX.search(cleaned) or cleaned in ("email", "mail", "e-mail"):
            return "email"

        if cls.PHONE_REGEX.search(cleaned) or cleaned in ("phone", "mobile", "number", "tel", "contact"):
            return "phone"

        if cls.NAME_REGEX.search(cleaned) or cleaned in ("name", "fullname", "person"):
            return "name"

        # Check Fuzzy Similarity against key target words
        target_maps = {
            "email": ["email", "emailaddress", "mailid"],
            "phone": ["phonenumber", "mobilenumber", "contactnumber", "cellphone"],
            "name": ["customername", "fullname", "personname", "username"],
        }
        for target_key, aliases in target_maps.items():
            for alias in aliases:
                ratio = difflib.SequenceMatcher(None, cleaned.replace(" ", ""), alias).ratio()
                if ratio >= 0.78:
                    return target_key

        # Tier 3: Data Sample Inspection Fallback
        if sample_values and len(sample_values) > 0:
            valid_samples = [str(v).strip() for v in sample_values if v is not None and str(v).strip()]
            if valid_samples:
                email_matches = sum(1 for v in valid_samples if cls.EMAIL_VALUE_REGEX.match(v))
                phone_matches = sum(1 for v in valid_samples if cls.PHONE_VALUE_REGEX.match(v) and sum(c.isdigit() for c in v) >= 7)

                sample_count = len(valid_samples)
                if email_matches / sample_count >= 0.5:
                    return "email"
                if phone_matches / sample_count >= 0.5:
                    return "phone"

        return cleaned.replace(" ", "_")

    @classmethod
    def resolve_dataframe(cls, df):
        """
        Resolves all columns in a pandas DataFrame. Also merges separate First Name and Last Name
        columns into 'name' if 'name' is missing.
        """
        columns = df.columns.tolist()
        mapping = {}
        assigned_canonical = set()

        for col in columns:
            sample_vals = df[col].dropna().head(20).tolist() if col in df.columns else []
            resolved = cls.resolve_header(col, sample_vals)

            if resolved in ("name", "email", "phone"):
                if resolved not in assigned_canonical:
                    mapping[col] = resolved
                    assigned_canonical.add(resolved)
                else:
                    mapping[col] = f"{col.strip().lower().replace(' ', '_')}"
            else:
                mapping[col] = resolved

        # Check for First Name + Last Name combination if 'name' was not directly mapped
        if "name" not in assigned_canonical:
            first_col = next((c for c in columns if cls.FIRST_NAME_REGEX.search(cls.clean_header(c))), None)
            last_col = next((c for c in columns if cls.LAST_NAME_REGEX.search(cls.clean_header(c))), None)

            if first_col and last_col:
                df["name"] = df[first_col].fillna("").astype(str).str.strip() + " " + df[last_col].fillna("").astype(str).str.strip()
                df["name"] = df["name"].str.strip()

        df = df.rename(columns=mapping)
        return df


def normalize_column_name(column_name, sample_values=None):
    """
    Normalize a single column name using SmartColumnResolver.
    """
    return SmartColumnResolver.resolve_header(column_name, sample_values)


def normalize_dataframe_columns(dataframe):
    """
    Normalize all DataFrame column names using SmartColumnResolver.
    """
    return SmartColumnResolver.resolve_dataframe(dataframe)


def remove_duplicates(dataframe):
    """
    Remove duplicate customer records.

    Priority:
    1. Email
    2. Phone
    3. Entire row
    """

    original_count = len(dataframe)

    # Replace NaN with empty string
    dataframe = dataframe.fillna("")

    # Remove duplicate emails
    if "email" in dataframe.columns:
        dataframe = dataframe[
            (dataframe["email"] == "")
            | (~dataframe["email"].duplicated())
        ]

    # Remove duplicate phone numbers
    if "phone" in dataframe.columns:
        dataframe = dataframe[
            (dataframe["phone"] == "")
            | (~dataframe["phone"].duplicated())
        ]

    # Remove exact duplicate rows
    dataframe = dataframe.drop_duplicates()

    removed = original_count - len(dataframe)

    return dataframe, removed