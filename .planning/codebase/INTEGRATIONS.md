---
date: "2026-09-08"
focus: tech
---

# Integrations

## External APIs
- **Google GenAI**: Used for generative AI features via `google-genai`
- **HuggingFace**: Integrated via `huggingface_hub` for machine learning models
- **Cloudinary**: Integrated for media/asset storage via `django-cloudinary-storage` and `cloudinary`

## Databases & Caching
- **PostgreSQL**: Primary relational database
- **Redis**: Used as message broker for Celery and potentially for caching.

## Webhooks
- Possible webhook implementations in `backend/apps/webhooks`

## Authentication
- JWT based authentication using `djangorestframework_simplejwt`
