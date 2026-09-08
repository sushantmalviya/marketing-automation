---
date: "2026-09-08"
focus: arch
---

# Architecture

## High-Level Pattern
- **Backend**: Django monolithic application following a multi-app structure (`apps/*`). It exposes a RESTful API using Django REST Framework.
- **Frontend**: Next.js App Router (`src/app/*`) utilizing React Server Components and Client Components.

## Layers & Data Flow
- **Client (Next.js)**: Handles routing, UI state, and data fetching (via `react-query`). Next.js acts as both static server and SSR/API layer if needed, but primarily consumes the Django API.
- **API (Django REST Framework)**: Exposes endpoints in `urls.py`, processed by `views.py`.
- **Business Logic**: Encapsulated in `services.py` within each Django app (e.g., `backend/apps/accounts/services.py`).
- **Data Access**: Django Models (`models.py`) and Managers (`managers.py`).
- **Asynchronous Processing**: Background tasks handled by Celery (`tasks.py` in apps).

## Entry Points
- **Frontend**: Next.js routing in `src/app/` (e.g., `src/app/page.tsx`, `src/app/layout.tsx`).
- **Backend**: Django's `manage.py`, WSGI/ASGI configurations, and `config/urls.py`.

## Abstractions
- **Services Pattern**: Heavy business logic is offloaded to `services.py` to keep views/serializers thin.
- **Role-Based Access**: Role-based directories in Next.js (`src/app/[role]`) and Django permissions (`permissions.py`).
