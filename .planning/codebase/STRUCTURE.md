---
date: "2026-09-08"
focus: arch
---

# Directory Structure

## Repository Root
- `/backend`: Django backend application.
- `/frontend`: Next.js frontend application.
- `/docs`: Project documentation.
- `full_api_docs.md`: Complete API documentation.

## Backend Structure (`/backend`)
- `/apps`: Contains modular Django applications:
  - `accounts`, `ads`, `analytics`, `asset_library`, `automation`, `billing`, `campaigns`, `common`, `communications`, `content_studio`, `dashboard`, `events`, `forms`, `integrations`, `tasks`, `webhooks`
- Each app typically contains: `models.py`, `views.py`, `urls.py`, `serializers.py`, `services.py`, `permissions.py`, `tasks.py`, `tests.py`.
- `/config`: Core Django configuration (settings, main urls).
- `/media`, `/customer_uploads`: Local storage directories.

## Frontend Structure (`/frontend/src`)
- `/app`: Next.js App Router structure. Includes auth pages `(auth)`, role-based routing `[role]`, and error handling pages.
- `/components`: Reusable React components.
- `/constants`: Global constants.
- `/permissions`: Frontend permission and role definitions.
- `/providers`: React context providers (e.g., React Query).
- `/services`: API service classes/functions for communicating with the backend.
- `/types`: TypeScript interfaces and type definitions.
