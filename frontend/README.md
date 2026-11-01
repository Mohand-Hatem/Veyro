# Veyro frontend

The Next.js 16 App Router app for [Veyro](../README.md): React 19, TanStack Query, next-intl (English and Arabic, right to left), Tailwind CSS 4 and next-themes.

```bash
cp .env.example .env.local   # API_ORIGIN: where the backend listens (http://localhost:5000)
npm install
npm run dev                  # http://localhost:3000
```

| Command | What it does |
| :--- | :--- |
| `npm run lint` | ESLint |
| `npm run typecheck` | Route types, then `tsc` |
| `npm test` | Unit tests (vitest) |
| `npm run build` | Production build |

- **Talking to the API:** the browser calls `/api/v1/*` on this app, and `next.config.ts` forwards it to `API_ORIGIN`, so session cookies stay first-party.
- **Layout:** `src/app/[locale]` holds the pages (public, auth, onboarding flow and the signed-in app), `src/components` the screens and shared kit, `src/lib` the API hooks and helpers, and `messages/` the English and Arabic text.
- **Protection:** `src/proxy.ts` only sends signed-out visitors to the sign-in page. The backend authorizes every request, and the UI shows what the server says the viewer may do.
- **Demo mode:** `NEXT_PUBLIC_DEMO_MODE=true` and `NEXT_PUBLIC_DEMO_PASSWORD` list the demo accounts on the sign-in page; `NEXT_PUBLIC_OAUTH_ENABLED` shows the Google and GitHub buttons.
