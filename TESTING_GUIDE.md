# PhishCatch Testing Guide

## Quick Setup for ChatGPT/OpenAI Testing

### 1. Configure Enterprise Domains

You have two options to configure PhishCatch:

#### Option A: Using the Extension Popup (Recommended for testing)

1. Click the PhishCatch extension icon in Chrome
2. Look for the configuration/settings section
3. Paste the contents of `test-config.json` into the config override form
4. Save the configuration

#### Option B: Using Chrome DevTools (Direct method)

1. Right-click the PhishCatch icon → "Inspect popup" (or open DevTools on any page)
2. Go to the Console tab
3. Paste and run this code:

```javascript
chrome.storage.local.set({
  configOverride: {
    "enterprise_domains": [
      "chat.openai.com",
      "chatgpt.com", 
      "openai.com",
      "platform.openai.com"
    ],
    "display_reuse_alerts": true,
    "enable_debug_gui": true,
    "expire_hash_on_use": false
  }
}, () => console.log('Config saved!'));
```

### 2. Test Password Capture on ChatGPT

1. Navigate to `https://chat.openai.com/` or `https://chatgpt.com/`
2. Look for the PhishCatch icon - it should show a **green checkmark** (indicating enterprise domain)
3. Enter your password on the login page
4. PhishCatch will hash and store it locally (never sent anywhere)

### 3. Test Password Reuse Detection

1. Navigate to a non-enterprise site (e.g., `https://www.example.com`)
2. Find any password field
3. Enter the same password you used on ChatGPT
4. PhishCatch should trigger an alert warning about password reuse

### 4. Verify Configuration

To check the current configuration:

```javascript
// In DevTools Console:
chrome.storage.local.get('configOverride', (data) => {
  console.log('Current config:', data.configOverride);
});
```

### 5. View Stored Passwords (Hashed)

```javascript
// In DevTools Console:
chrome.storage.local.get(['passwordHashes', 'usernames'], (data) => {
  console.log('Stored password hashes:', data.passwordHashes);
  console.log('Stored usernames:', data.usernames);
});
```

### 6. Clear Stored Data (For fresh testing)

```javascript
// In DevTools Console:
chrome.storage.local.clear(() => {
  console.log('All data cleared!');
  // Re-apply config after clearing
});
```

## Configuration Options Explained

- **enterprise_domains**: Domains where you WANT to enter passwords (trusted)
  - PhishCatch captures and hashes passwords entered here
  - Icon shows green checkmark on these domains

- **display_reuse_alerts**: Show browser notifications when reuse detected
  - Set to `true` to see alerts
  - Set to `false` for silent logging only

- **expire_hash_on_use**: Delete password hash after first reuse detection
  - `false` = Keep monitoring (recommended for testing)
  - `true` = One-time alert then forget

- **phishcatch_server**: Backend server URL for logging alerts
  - Leave empty (`""`) for local-only testing
  - Set to server URL for production

## Current Test Configuration

The test config (`test-config.json`) is set up with:
- ✅ ChatGPT/OpenAI as "enterprise" domains (trusted)
- ✅ Alerts enabled
- ✅ Debug GUI enabled
- ✅ No server connection (local testing only)
- ✅ Passwords persist after detection (for testing)

## Next Steps

Once configured, you can:
1. Test basic password detection
2. Add ChatGPT query logging feature
3. Verify both features work together
