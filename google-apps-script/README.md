# Google Sheets sync for AI Token Tracker

Team-wide spend log and shared project catalog via Google Apps Script Web App.

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

> **Upgrading from an older version:** the `Events` sheet columns changed. Delete the existing `Events` sheet (or clear it, including the header row) so the script recreates it with the new, slimmer header. Then redeploy.

## Events sheet columns

| Column | Description |
|--------|-------------|
| syncedAt | Server receive time (ISO) |
| eventId | Unique id from the tracker (dedup key) |
| amount | Credits spent |
| service | `kling` / `higgsfield` / `seedance` |
| projectId | Local project id in the userscript |
| projectName | Project name (join key across members) |
| user | Team member nickname |
| trackerVersion | Userscript version |

Use **projectName** for cross-member pivot tables and charts — each browser generates its own `projectId`, so the tracker aggregates shared project spend by normalized project name.

## Projects sheet columns

The script creates `Projects` automatically on the first project sync.

| Column | Description |
|--------|-------------|
| projectId | Shared stable project id |
| name | Project name |
| url | Optional project URL |
| status | `active` or `archived` |
| createdAt | Creation time (ISO) |
| updatedAt | Server update time (ISO) |
| updatedBy | Nickname of the last editor |

Projects are pulled with the spend history. Local creates and edits are applied immediately and retried if the network is unavailable. Deleting a project archives it for everyone while old spend rows keep their project information.

## Full sync (pull)

Every client periodically pulls all rows and merges them into its local history, so all team members see the same project spend:

- On startup, every 60 seconds, and on the **Refresh** button (Settings → Google Sheets).
- Remote events appear in **History** (tagged with the author) and can be deleted by anyone; deleting removes the row for everyone on the next pull.
- On every append and pull, the `Events` rows are sorted by `syncedAt` from newest to oldest (`Z → A`); the header remains frozen in row 1.

## API

```json
POST text/plain body: {"action":"ping","token":"YOUR_SECRET"}
POST text/plain body: {"action":"appendEvent","token":"YOUR_SECRET","payload":{...}}
POST text/plain body: {"action":"deleteEvent","token":"YOUR_SECRET","payload":{"eventId":"..."}}
POST text/plain body: {"action":"updateEventProject","token":"YOUR_SECRET","payload":{"eventId":"...","projectId":"...","projectName":"..."}}
POST text/plain body: {"action":"listEvents","token":"YOUR_SECRET"}
POST text/plain body: {"action":"listProjects","token":"YOUR_SECRET"}
POST text/plain body: {"action":"upsertProject","token":"YOUR_SECRET","payload":{"projectId":"...","name":"...","url":"...","createdAt":"...","updatedBy":"..."}}
POST text/plain body: {"action":"archiveProject","token":"YOUR_SECRET","payload":{"projectId":"...","updatedBy":"..."}}
```

Use `Content-Type: text/plain` (not `application/json`) for POST so Google Apps Script receives the body after redirect. `listEvents` returns `{ ok: true, events: [...] }` (latest rows, capped). It is served over POST (same channel as `ping`/`appendEvent`); a GET `?action=listEvents&token=...` fallback also exists but POST is used by the tracker for reliability.

`listEvents` and `listProjects` also support authenticated GET requests for diagnostics, while the tracker uses POST for reliability.

`updateEventProject` is used when a user corrects a spend project from the Undo banner. It updates only `projectId` and `projectName`; `syncedAt` and spend values remain unchanged.

## Security

- Do not commit real tokens to git.
- Rotate `SECRET_TOKEN` if it leaks; update all team members' settings.
- The Web App URL + token allow appending rows — treat like a shared API key.
