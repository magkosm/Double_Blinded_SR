# Manage reviewers

## Purpose

Create and remove reviewer accounts for double-blind screening.

## Steps

### Create reviewer

1. Enter a username in **New reviewer**
2. Click **Create reviewer**
3. **Save the modal credentials immediately** — password is shown once

![Created credentials modal](../images/v0.5/reviewer-created-modal.png)

4. Share the review URL (`/r/your-review-slug`) plus username/password securely

### Remove reviewer

1. Click **Remove** next to the reviewer row
2. Confirm — their encrypted decisions are deleted

## Progress per reviewer

The admin table shows include/exclude/maybe/pending counts per reviewer (aggregate only, not per-paper choices).

![Reviewer list](../images/v0.5/reviewer-list.png)

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Username taken | Choose a different username |
| Reviewer cannot decrypt | Recreate account (old crypto may be invalid) |
