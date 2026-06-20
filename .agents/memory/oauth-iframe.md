---
name: Replit iframe OAuth pattern
description: How to handle OAuth flows when the app runs inside the Replit preview iframe
---

# Replit iframe OAuth — use popups, not top navigation

## The rule
`window.open(url, '_top')` and `window.location.href = url` both fail silently inside the Replit preview iframe (no console error, no redirect). The iframe sandbox does not allow top-level navigation.

## The fix
Open OAuth URLs as a popup window:
```js
window.open(url, 'oauth', 'width=520,height=700,left=200,top=100')
```

After OAuth completes, the callback redirects to `/?oauth_complete=<provider>`. The app detects it is inside a popup (`window.opener !== null`), sends `postMessage({ type: 'oauth_complete' })` to the opener, and calls `window.close()`. The opener listens for that message and invalidates React Query.

**Why:** Replit embeds the app preview in an `<iframe>` whose sandbox does not include `allow-top-navigation`. Popup windows bypass this restriction because they open in a separate browsing context.

**How to apply:** Any time OAuth (Spotify, Last.fm, or any third-party) needs to redirect the user away and back, use the popup pattern above. Applies to both dev and production Replit environments.
