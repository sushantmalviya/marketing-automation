---
date: "2026-09-08"
focus: quality
---

# Coding Conventions

## Backend (Python/Django)
- **Architecture**: Fat Models/Services, Thin Views. Business logic is placed in `services.py`.
- **Typing**: Python type hinting is used (configured with Pyright).
- **Serializers**: Data validation and serialization handled strictly by DRF serializers (`serializers.py`).
- **Permissions**: Custom DRF permission classes placed in `permissions.py`.
- **Task Queues**: Long-running background jobs defined in `tasks.py` and executed via Celery.
- **Formatting**: Standard PEP 8, likely enforced by a linter (flake8/black, though not explicitly in root requirements).

## Frontend (TypeScript/Next.js)
- **App Router**: Uses Next.js App Router paradigms (server vs client components).
- **Data Fetching**: `react-query` is the standard for client-side data fetching and caching.
- **Styling**: Utility-first CSS using Tailwind CSS.
- **Forms**: Managed using `react-hook-form` coupled with `zod` for schema validation.
- **Linting**: Enforced via ESLint (`eslint.config.mjs`) and TypeScript strict mode.
