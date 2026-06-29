# Admin login and project password

## Purpose

Sign in as super-admin or review admin, then unlock encryption with the project password.

## Prerequisites

- Admin username and password from the study lead
- Project password (separate from admin login)

## Steps

1. Open **Admin** — `/admin` (super-admin) or `/admin/your-review-slug` (review admin)
2. Enter admin username and password → **Sign in**

![Admin login](../images/v0.5/admin-login.png)

3. Enter the **project password** → **Continue**

![Project password](../images/v0.5/project-password.png)

The project password is stored in this browser session only. You will need it again in a new tab or after sign-out.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Invalid credentials | Check username/password; caps lock |
| Cannot decrypt papers | Wrong project password — sign out and retry |
| API error on login | Check network; admin may need to redeploy Worker |
