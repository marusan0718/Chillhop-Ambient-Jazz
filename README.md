# 静穏 — Ambient Wall Display

A fullscreen ambient signage experience for a vertically mounted room display. The interface intentionally keeps most of the screen empty: time and date float at the top left, while tomorrow's weather and the next calendar item sit quietly at the bottom right.

## Run locally

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Integrations

- **Weather:** Open-Meteo forecast for the configured location in `app.js`.
- **Calendar:** Google Calendar API. Add `ambient.googleApiKey` and `ambient.calendarId` to `localStorage`, then refresh.
- **Earthquakes:** P2PQuake WebSocket API. Intensity 1–2 events stay hidden, intensity 3 appears as a quiet notice, and intensity 4+ or emergency earthquake warnings open the fullscreen emergency view.
- **Presence sensor hook:** Call `window.setAmbientPresence(false)` when the room is empty and `window.setAmbientPresence(true)` when someone approaches.

For a safe emergency UI preview from the browser console, call `window.previewQuake(40)` or `window.previewQuake(30)`.
