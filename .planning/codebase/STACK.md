---
date: "2026-09-08"
focus: tech
---

# Codebase Stack

## Backend
- **Language**: Python 3.10+
- **Framework**: Django 6.0.6, Django REST Framework 3.17.1
- **Task Queue**: Celery 5.6.3 with Redis
- **Database**: PostgreSQL (`psycopg` & `psycopg2-binary`)
- **Other Key Libs**: 
  - `pydantic` for data validation
  - `drf-spectacular` for OpenAPI schema generation
  - `djangorestframework_simplejwt` for authentication
  - `google-genai` and `huggingface_hub` for AI features
  - `pandas` and `numpy` for data processing

## Frontend
- **Language**: TypeScript
- **Framework**: Next.js 16.2.10, React 19.2.4
- **Styling**: Tailwind CSS 4.1.14, PostCSS
- **State Management / Data Fetching**: `@tanstack/react-query`
- **UI Components & Icons**: `lucide-react`, `framer-motion`, `@dnd-kit` for drag and drop, `react-hook-form` + `zod` for forms
- **Mapping & Charts**: `leaflet`, `react-leaflet`, `recharts`
- **Testing**: `vitest`, `playwright`

## Configuration
- **Backend Env**: `python-dotenv`, `python-decouple`
- **Backend Linting**: `pyrightconfig.json` (Pyright for type checking)
- **Frontend Build/Linting**: `eslint.config.mjs`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`
