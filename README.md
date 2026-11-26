# AI Tutor — Paper Canvas

A paper-like math canvas. Write an equation with the pen (or type it in a note),
circle it, tap **Solve** or **Ask AI**, check the recognised equation, and get an
answer with steps, an explanation, and best-effort Lean verification.

```
Browser (HTML/CSS/JS)
  |  POST /recognize  (ink PNG + typed-notes text hint)
  v
Python service :5000   Parsing.py
  |  Pix2Text / pix2tex  ->  LaTeX  ->  SymEngine expression
  |  POST /parse for English questions, text hint fast path
  v  JSON { latex, expression, action, variable }
Browser  (shows an editable preview before solving)
  |  POST /api/solve-cpp  (fast, SymEngine)   or   POST /api/solve (full pipeline)
  |  Authorization: Bearer <token>
  v
C++ API :8080   math-api (Crow + SymEngine + SQLite)
  |  quota + ad credits, history, feedback, auth
  |  ->  { answer, steps, explanation, verification, limit, question_id }
  v
Lean server :5001   lean_server.py  ->  lake env lean (Mathlib)
```

## What is in the repo

| Path | What it is |
|---|---|
| `index.html`, `Front_end/style.css`, `Front_end/script.js` | Static frontend, no framework or build step |
| `Parsing.py` | Python service: `/parse` (regex English parser) + `/recognize` (Pix2Text handwriting → LaTeX, typed-text fast path) |
| `lean_server.py` | Lean 4 verification server (`POST /verify`) |
| `math-api/` | C++20 API: solver, auth, Google token verification, SQLite, caching, Lean bridge |
| `math-api/lean/` | Lean 4 + Mathlib project used by the verifier |
| `requirements-ocr.txt` | Python deps for handwriting recognition |
| `start-dev.ps1` | Starts every service in its own window |

## Quick start (Windows)

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-ocr.txt

# Build the C++ API once (needs CMake, a C++20 compiler and vcpkg packages)
cmake -S math-api -B math-api/build
cmake --build math-api/build --config Release

# Google sign-in is preconfigured with this deployment's client id.
# Override it for a different Google Cloud project:
# .\start-dev.ps1 -GoogleClientId "1234567890-abc.apps.googleusercontent.com"

# Start OCR, API and the static site
.\start-dev.ps1

# ...or include the Lean verifier too
.\start-dev.ps1 -WithLean
```

Open <http://127.0.0.1:5501/>. If a port is already busy the script leaves that
service alone, so it is safe to run twice.

### Manual start

```powershell
# 1. Parser + handwriting service (port 5000)
python Parsing.py --server --preload

# 2. C++ API (port 8080)
$env:PARSER_SERVER_URL = "http://127.0.0.1:5000/parse"
$env:GOOGLE_CLIENT_ID = "..."             # optional
$env:LEAN_SERVER_URL = "http://127.0.0.1:5001/verify"   # optional
.\math-api\build\Release\math-api.exe

# 3. Lean verifier (port 5001, optional)
python lean_server.py --port 5001

# 4. Static frontend (port 5501)
python -m http.server 5501 --bind 127.0.0.1
```

Serve the **repository root** (not `Front_end/`): the page requests
`/Front_end/style.css` and `/Front_end/script.js`.

The frontend points at `http://127.0.0.1:8080` by default. Override it before
`script.js` loads if needed:

```html
<script>
  window.AITUTOR_API_BASE = 'http://127.0.0.1:8080';
  window.AITUTOR_OCR_BASE = 'http://127.0.0.1:5000';
</script>
```

## Accounts and Google sign-in

- Email sign-up/log-in creates a SQLite account and returns a bearer token.
- Google sign-in uses Google Identity Services in the browser and **verifies the
  ID token on the server** (RS256 against Google's JWKS, issuer, audience, expiry
  and `email_verified`). Set `GOOGLE_CLIENT_ID` (or
  `AITUTOR_GOOGLE_CLIENT_ID`) to enable it; without it `/api/auth/google`
  answers `503` and the page keeps email login.
- After the first sign-in the onboarding modal asks for **first name, surname
  and date of birth** before the tutor is usable.
- Sessions live in the `sessions` table for 30 days. Log out from the user chip.

### Free limit and ads

Free accounts get **10 questions per day**. When the limit is reached:

1. The limit modal opens.
2. The user watches **2 placeholder ads** (4 seconds each).
3. Each ad calls `POST /api/user/ads` and grants **one ad credit**.
4. The next two solves consume those credits.

There is no paid upgrade yet; the UI says plans are coming soon.

## API

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/config` | Google client id, Lean availability, free limit |
| `POST` | `/api/auth/signup` | `{email,password,name,country}` → `{token,profile}` |
| `POST` | `/api/auth/login` | `{email,password}` → `{token,profile}` |
| `POST` | `/api/auth/google` | `{credential}` (Google ID token) → `{token,profile}` |
| `POST` | `/api/auth/logout` | Bearer token |
| `GET` | `/api/user/me` | Full profile, plan, usage, ad credits |
| `GET` | `/api/user/limit` | `{allowed, remaining, ad_credits, limit, used, plan}` |
| `POST` | `/api/user/profile` | `{first_name,surname,dob}` |
| `POST` | `/api/user/language` | `{language}` (`en` or `hinglish`) |
| `POST` | `/api/user/ads` | Grants one ad credit after a placeholder ad |
| `POST` | `/api/solve` | Full pipeline: parser → SymEngine → cache → explanation |
| `POST` | `/api/solve-cpp` | Direct SymEngine solve (fast path) |
| `POST` | `/api/verify-lean` | `{lean_code}` → `{proved}` |
| `POST` | `/api/feedback` | `{question_id,rating,comment}` (auth required) |
| `GET` | `/api/history` | Last 30 questions (Bearer token) |

Both solve endpoints accept `language: "en" | "hinglish"` and return a
`verification` block:

```json
{
  "answer": "x = 4",
  "steps": ["...", "..."],
  "explanation": "...",
  "verification": { "checked": true, "proved": true, "code": "import Mathlib\n..." },
  "limit": { "remaining": 7, "ad_credits": 0, "plan": "free" },
  "question_id": 42
}
```

## `/recognize` API

```http
POST /recognize
Content-Type: application/json

{ "image": "data:image/png;base64,iVBORw0...", "text": "2x + 3 = 11" }
```

- `text` is the typed-notes hint. If it parses as maths it short-circuits OCR
  and returns `"engine": "text-hint"`, so typed notes and diagrams work even
  when the handwriting model is missing.
- If `text` does not parse but `image` is present, the service runs Pix2Text.
- If recognition succeeds but the LaTeX is not solvable, the response has
  `expression: null` plus a `warning`; the frontend opens the preview so the
  user can correct it.
- `503` means no recognizer is installed; `422` means the image had no formula.
- Results are cached by image hash, so re-solving the same crop is instant.

## Lean verification

`LeanVerifier` builds a small proof for substituted equations and arithmetic:

```lean
import Mathlib

example : ((2 * 4 + 3 : Rat)) = ((11 : Rat)) := by norm_num
```

`lean_server.py` writes it to a temporary file inside `math-api/lean/` and runs
`lake env lean`. First run:

```powershell
cd math-api\lean
lake update        # downloads Mathlib; this is slow
```

Set `LEAN_SERVER_URL` for the C++ API; without it, solve responses explain that
verification is unavailable instead of failing.

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `GOOGLE_CLIENT_ID` | — | Google OAuth client id; also accepts `AITUTOR_GOOGLE_CLIENT_ID` |
| `PARSER_SERVER_URL` | `http://127.0.0.1:5000/parse` | Python parser endpoint |
| `LEAN_SERVER_URL` | — | Lean verifier endpoint (enables verification) |
| `AITUTOR_DB` | `ai_tutor.db` | SQLite file |
| `LEAN_PORT` | `5001` | Lean server port |
| `LEAN_PROJECT_DIR` | `<repo>/math-api/lean` | Lean project used by the server |
| `LEAN_BINARY` | — | Skip `lake env` and run this `lean` binary |
| `LEAN_TIMEOUT` | `120` | Seconds per Lean check |
| `PIX2TEXT_DEVICE` | auto | `cuda` for GPU OCR |

The C++ build is Windows-oriented: `auth.cpp` uses Windows CNG for PBKDF2 and
`google.cpp` uses CNG for RS256 verification.

## Known gaps

- `llm.cpp` is still a stub; answers come from SymEngine.
- `graph` is always `null`; the Graph tab shows a fixed demo curve.
- The mic only opens the microphone (no speech-to-text); the camera only previews.
- Ads are placeholders; no ad network is integrated.
- Paid upgrade plans are not implemented.

## Licenses

Pix2Text and pix2tex are MIT licensed. Run them on your own server; no page
assets or calculations leave your machine except first-time model downloads.
# AI_Tutor
