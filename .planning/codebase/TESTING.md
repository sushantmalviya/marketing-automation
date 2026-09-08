---
date: "2026-09-08"
focus: quality
---

# Testing Patterns

## Backend
- **Framework**: Standard Django testing framework (`django.test.TestCase` / `unittest`).
- **Location**: App-specific tests are located in `tests.py` within each app directory (e.g., `backend/apps/accounts/tests.py`).
- **Scope**: Tests cover models, views, serializers, and core services.

## Frontend
- **Framework**: `vitest` for unit/integration testing, `playwright` for end-to-end (E2E) testing.
- **Location**: 
  - Unit tests generally reside in `tests/` directory or adjacent to components.
  - Playwright E2E tests are configured via `playwright.config.ts`.
- **Mocking**: Handled by Vitest mocking capabilities. Testing DOM is facilitated by `@testing-library/react` and `@testing-library/jest-dom`.
