# @workspace/scripts

Utility scripts for the SakanMatch monorepo.

---

## Screenshot Generator

Captures high-quality screenshots of the live SakanMatch site for use in presentations and marketing materials.

### Run

From the **project root**:

```bash
pnpm --filter @workspace/scripts run screenshots
```

Or from the `scripts/` directory:

```bash
pnpm run screenshots
```

> **First run:** Playwright needs its browser binaries. If you see an error about missing browsers, run:
> ```bash
> pnpm exec playwright install chromium
> ```

### Output

All images are saved to a `screenshots/` folder at the **project root**.

| File | Description | Viewport |
|------|-------------|----------|
| `home.png` | Landing page | 1440×900 |
| `listings.png` | Listings grid (scrolled down) | 1440×900 |
| `listing-details.png` | First listing detail page | 1440×900 |
| `auth.png` | Login page | 1440×900 |
| `premium.png` | Premium/subscription page | 1440×900 |
| `dashboard.png` | Owner/seeker dashboard *(needs auth)* | 1440×900 |
| `messaging.png` | Messaging/chat UI *(needs auth)* | 1440×900 |
| `home-mobile.png` | Landing page mobile | 375×812 |
| `listings-mobile.png` | Listings grid mobile (scrolled) | 375×812 |

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SCREENSHOT_EMAIL` | For auth pages | Email of an existing test account |
| `SCREENSHOT_PASSWORD` | For auth pages | Password for that account |
| `BASE_URL` | No | Override target site (default: `https://sakanmatch.site`) |
| `OUTPUT_DIR` | No | Override output folder (default: `./screenshots`) |

**Example with credentials:**

```bash
SCREENSHOT_EMAIL=test@example.com SCREENSHOT_PASSWORD=mypassword \
  pnpm --filter @workspace/scripts run screenshots
```

### How it works

1. Launches headless Chromium via Playwright.
2. Discovers the first listing URL automatically (for `listing-details.png`).
3. If credentials are provided, logs in once and reuses the session for authenticated pages (`dashboard.png`, `messaging.png`).
4. For each page: navigates, waits for `networkidle` + 2 s, hides any cookie/overlay elements, optionally scrolls, then saves a viewport-sized PNG.

---

## Other scripts

| Script | Command |
|--------|---------|
| Hello world example | `pnpm run hello` |
| Type check | `pnpm run typecheck` |
