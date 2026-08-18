import os

import pandas as pd
from django.db import transaction
from rest_framework.exceptions import ValidationError

from ..models import CustomerRecord, CustomerUpload
from ..utils import normalize_dataframe_columns, remove_duplicates


class CustomerImportService:
    @staticmethod
    def read_file(uploaded_file):
        extension = os.path.splitext(uploaded_file.name)[1].lower()

        if extension == ".csv":
            return pd.read_csv(uploaded_file)

        if extension in [".xlsx", ".xls"]:
            return pd.read_excel(uploaded_file)

        raise ValidationError("Unsupported file format.")

    @staticmethod
    def clean_dataframe(dataframe):
        original_records = len(dataframe)
        dataframe = normalize_dataframe_columns(dataframe)
        dataframe, removed_duplicates = remove_duplicates(dataframe)

        return {
            "dataframe": dataframe,
            "total_records": original_records,
            "duplicates_removed": removed_duplicates,
            "records_after_cleanup": len(dataframe),
        }

    @staticmethod
    def save_upload(uploaded_file, uploaded_by, summary) :
        extension = os.path.splitext(uploaded_file.name)[1].lower()

        return CustomerUpload.objects.create(
            original_file=uploaded_file,
            file_name=uploaded_file.name,
            file_type=extension.replace(".", ""),
            uploaded_by=uploaded_by,
            total_records=summary["total_records"],
            imported_records=summary["records_after_cleanup"],
            failed_records=0,
            status=CustomerUpload.Status.COMPLETED,
        )

    @staticmethod
    def save_records(upload, dataframe):
        # Store column order inside each record so PostgreSQL jsonb key-sorting can be reversed
        col_order = dataframe.columns.tolist()
        records = [
            CustomerRecord(
                upload=upload,
                data={"__col_order__": col_order, "_source": "imported", **row.to_dict()},
            )
            for _, row in dataframe.iterrows()
        ]

        CustomerRecord.objects.bulk_create(records)
        return len(records)

    @staticmethod
    @transaction.atomic
    def import_file(uploaded_file, uploaded_by):
        dataframe = CustomerImportService.read_file(uploaded_file)
        summary = CustomerImportService.clean_dataframe(dataframe)

        upload = CustomerImportService.save_upload(
            uploaded_file=uploaded_file,
            uploaded_by=uploaded_by,
            summary=summary,
        )
        saved_records = CustomerImportService.save_records(
            upload=upload,
            dataframe=summary["dataframe"],
        )

        return {
            "message": "File uploaded successfully.",
            "upload_id": upload.id,
            "total_records": summary["total_records"],
            "duplicates_removed": summary["duplicates_removed"],
            "records_after_cleanup": summary["records_after_cleanup"],
            "saved_records": saved_records,
            "columns": summary["dataframe"].columns.tolist(),
        }
