# Google Sheets sync for AI Token Tracker

Team-wide spend log via Google Apps Script Web App.

## Setup

1. Create a new Google Spreadsheet for your team.
2. Open **Extensions → Apps Script**.
3. Replace the default code with [`Code.gs`](Code.gs).
4. Set constants at the top of `Code.gs`:
   - `SECRET_TOKEN` — long random string (share only with the team).
   - `SPREADSHEET_ID` — from the sheet URL (`/d/THIS_PART/edit`).
5. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the Web App URL.
7. In Tampermonkey → AI Token Tracker → **Settings** tab:
   - Enable Google Sheets sync
   - Paste Web App URL and secret token
   - Set your nickname (shown in the `user` column)
8. Click **Test connection**, then generate something to verify a row appears on the `Events` sheet.

**After updating `Code.gs`:** create a **New deployment** (Manage deployments → Edit → New version → Deploy). The tracker sends **POST** with `Content-Type: text/plain` to the `/exec` URL.

## Events sheet columns

| Column | Description |
|--------|-------------|
| syncedAt | Server receive time (ISO) |
| eventId | Unique id from the tracker (dedup key) |
| ts | Spend time (ISO) |
| localDate | Local date `YYYY-MM-DD` |
| amount | Credits spent |
| service | `kling` / `higgsfield` |
| serviceName | Display name |
| projectId | Local project id in the userscript |
| projectName | Project name |
| projectKey | Normalized project name for team pivots |
| user | Team member nickname |
| source | `ui` / `network` / `mixed` |
| estimated | `TRUE` / `FALSE` |
| trackerVersion | Userscript version |

Use **projectKey** (not projectId) for cross-member pivot tables and charts — each browser generates its own project ids.

## API (POST JSON)

```json
POST text/plain body: {"action":"ping","token":"YOUR_SECRET"}
POST text/plain body: {"action":"appendEvent","token":"YOUR_SECRET","payload":{...}}
```

Use `Content-Type: text/plain` (not `application/json`) so Google Apps Script receives the body after redirect.

`doGet` with `action=listEvents` / `listProjects` returns `501 not implemented` (reserved for phase 2).

## Security

- Do not commit real tokens to git.
- Rotate `SECRET_TOKEN` if it leaks; update all team members' settings.
- The Web App URL + token allow appending rows — treat like a shared API key.
