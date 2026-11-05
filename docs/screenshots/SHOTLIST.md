# Screenshot shot list (for USER-GUIDE.md)

Goal: 6–8 real screenshots in ~10 minutes. Existing files in this folder stay;
name new ones exactly as below (USER-GUIDE will reference them next).

Prerequisites: `bun run dev:web` + seeded root user (`bun run db:seed`) with
2 organizations, 1 pending invitation, and 2FA enabled on a test account.
Browser: desktop 1440×900, English locale (`/en/…`).

| # | File | How |
|---|---|---|
| 1 | `org-invitations-desktop.png` | `/en/organization` → scroll to **Invitations** with 1 pending row + the invite form visible |
| 2 | `org-switcher-desktop.png` | Any page → click the header org dropdown open, showing 2 orgs |
| 3 | `profile-2fa-desktop.png` | `/en/profile` → scroll to the **Two-factor** card in enabled state (badge "Enabled") |
| 4 | `login-2fa-desktop.png` | `/en/auth/login?callbackUrl=%2Fen%3FtwoFactorRedirect%3Dtrue` → the TOTP code step |
| 5 | `profile-danger-desktop.png` | `/en/profile` → scroll to the **Danger zone** card |
| 6 | `api-keys-desktop.png` | `/en/organization/api-keys` → table with 1 active key + the "copy once" dialog open (use a throwaway key, revoke after) |
| 7 | `profile-edit-mobile-390.png` | Expo Go, Profile tab → edit-name drawer open (390px width) |
| 8 | `landing-en-desktop.png` | `/en/landing` hero (replaces nothing; new) |

Rules: no real emails or secrets visible (use `test@…` accounts; revoke demo keys
after the shoot). Keep the 6 legacy files (`api-docs-*`, `login-mobile-390`,
`portal-header-*`) unless a shot replaces them 1:1.
