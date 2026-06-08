---
name: Mobile Bearer token auth
description: How session-based auth works for the React Native mobile app — why cookies fail and what the correct pattern is.
---

## Rule
Every endpoint that checks auth state must go through `populateFromBearerToken()`, not just `req.session?.authenticated` directly. This includes `/auth/me`.

**Why:** React Native's `fetch` has no persistent cookie jar. The `Set-Cookie` header from `POST /auth/login` is silently ignored. The mobile client stores the session ID returned in the login response body and sends it as `Authorization: Bearer <id>` on every request.

## Correct pattern
- `POST /auth/login` returns `{ token: req.session.id }` (200 JSON, not 204).
- Mobile reads `token` from the mutation result, stores in `expo-secure-store`, calls `setAuthTokenGetter(() => token)`.
- Backend has `populateFromBearerToken(req, callback)` that calls `store.get(sessionId, cb)` and copies session fields onto `req.session`.
- `requireAuth` and `requireRole` both call this helper when no cookie session is present.
- `GET /auth/me` also calls `populateFromBearerToken` before reading `req.session`.

## expo-secure-store on web
`expo-secure-store` is iOS/Android only — calling it on Expo web (browser) throws `setValueWithKeyAsync is not a function`. Use wrapper helpers:

```ts
async function storeGet(key): Promise<string | null> {
  try { return await SecureStore.getItemAsync(key); } catch { return null; }
}
async function storeSet(key, value): Promise<void> {
  try { await SecureStore.setItemAsync(key, value); } catch {}
}
async function storeDelete(key): Promise<void> {
  try { await SecureStore.deleteItemAsync(key); } catch {}
}
```

On web, the login Bearer token simply isn't stored (no-op), but cookies work in the browser so auth still works.

## Token lifecycle
- On mount: `storeGet(TOKEN_KEY)` → if found, `setAuthTokenGetter(() => token)`, then `setTokenReady(true)`.
- Auth query uses `enabled: tokenReady` so it waits for the SecureStore check.
- On login: read token from mutation result, `storeSet`, `setAuthTokenGetter(() => token)`.
- On logout: `fetch /api/auth/logout` with `Authorization: Bearer <token>` header (so server destroys the real session, not a new empty one), then `storeDelete`, `setAuthTokenGetter(null)`.
