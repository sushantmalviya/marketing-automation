---
date: "2026-09-08"
focus: concerns
---

# Codebase Concerns & Known Issues

## Tech Debt & Architecture
- **Monolithic App Complexity**: The backend `apps` directory contains 16 separate applications. Ensuring clear boundaries and avoiding tight coupling between these apps (e.g., cross-app imports) will be crucial.
- **Frontend Routing Complexity**: Role-based routing in the Next.js app (`src/app/[role]`) can become difficult to maintain if roles and permissions expand significantly.
- **Dependency Management**: Keeping Python and Node.js dependencies synchronized and updated across a fullstack repository requires disciplined CI/CD checks.

## Security
- **Authentication Handling**: Need to ensure that JWT tokens are stored securely on the frontend (e.g., HttpOnly cookies vs localStorage) and that token expiration/refresh cycles are handled gracefully.
- **Secrets Management**: Ensuring `.env` files and third-party API keys (Google GenAI, HuggingFace, Cloudinary) are securely managed and not leaked in code.

## Performance
- **Heavy Frontend Packages**: Use of large libraries like `leaflet`, `recharts`, and `@xyflow/react`. Proper code-splitting and dynamic imports in Next.js will be necessary to keep initial bundle sizes small.
- **Celery Queues**: Monitoring and scaling Celery workers for long-running AI generation tasks (`google-genai`, `huggingface_hub`) to avoid bottlenecks.
