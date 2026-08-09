# Instagram Automation Setup

This is the one part I can't do for you, it requires your own Meta account. Everything below is exact steps, should take about 20-30 minutes.

## 1. Convert your Instagram account

Instagram Settings → Account type → switch to **Professional** (Creator or Business both work). Free, instant.

## 2. Create a Meta Developer app

1. Go to developers.facebook.com/apps → Create App
2. Choose "Other" → "Business" as the app type
3. Give it any name, e.g. "Stratum Posting"

## 3. Link your Instagram account and add yourself as a tester

1. In your new app's dashboard, add the **Instagram Graph API** product
2. Under Instagram Graph API settings, connect your Instagram professional account
3. Add your own Instagram account as an **Instagram Tester** under Roles → Instagram Testers
4. Log into Instagram on the web, go to Settings → Apps and Websites → Tester Invites, and accept the invite from your app

This step matters: with a tester role on an account you own, you can publish through the API without waiting on Meta's full App Review (2-4 week process), that review is only required to publish to *other people's* accounts.

## 4. Get your Instagram User ID and access token

1. In the Graph API Explorer (developers.facebook.com/tools/explorer), select your app
2. Generate a User Access Token with these permissions: `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`
3. Call `GET /me/accounts` to find your linked Facebook Page, then `GET /{page-id}?fields=instagram_business_account` to get your Instagram User ID
4. Exchange the short-lived token for a long-lived one (lasts ~60 days): 
   `GET /oauth/access_token?grant_type=fb_exchange_token&client_id={app-id}&client_secret={app-secret}&fb_exchange_token={short-lived-token}`

Meta's own Graph API Explorer walks through most of this with buttons rather than raw URLs, worth using it directly rather than typing these by hand.

**The 60-day expiry is the one real gap in "fully automated."** Set a calendar reminder for day 50 to refresh the token (same exchange call above, using your current token as the input), or accept a manual refresh every couple months as the cost of free hosting.

## 5. Push this folder to a public GitHub repo

The posting script references your images by public URL (`raw.githubusercontent.com`), Graph API can't accept a direct file upload the way a form does. A public repo is what makes the image URLs work without extra hosting:

```
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/yourname/stratum-content.git
git push -u origin main
```

Make sure `out/` (your 12 rendered carousel folders) is committed too, that's what the posting script points at.

## 6. Add your secrets to the repo

GitHub repo → Settings → Secrets and variables → Actions → New repository secret:
- `IG_USER_ID` — from step 4
- `IG_ACCESS_TOKEN` — the long-lived token from step 4

## 7. Test with one manual run before trusting the daily schedule

GitHub repo → Actions tab → "Daily Instagram Post" workflow → Run workflow (this uses the `workflow_dispatch` trigger already built into `daily-post.yml`). Watch it run, check your actual Instagram account, confirm the first carousel posted correctly with the right caption before letting the daily cron take over.

## What happens after that

Every day, the GitHub Action wakes up, posts whichever carousel is next per `state.json`, and commits the updated state back to the repo so tomorrow's run knows where it left off. After all 12 are posted, it logs that there's nothing left and stops, add more carousels to `content.json` (and render them) whenever you're ready for the next batch.
