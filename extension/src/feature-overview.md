# PhishCatch Extension - Project Overview & Feature Summary

## Project Overview

### What PhishCatch Does

PhishCatch is a Chrome browser extension designed to identify and prevent enterprise password leaks. The extension protects organizations by detecting when employees reuse their enterprise passwords on potentially malicious or unauthorized websites.

### How It Works

PhishCatch operates through a multi-layered security approach:

1. **Domain Classification**: The extension categorizes websites into three types:
   - **Enterprise Domains**: Trusted corporate sites (e.g., company login portals)
   - **Dangerous Domains**: Potentially malicious or unauthorized sites
   - **Ignored Domains**: Neutral sites that don't require monitoring

2. **Password Hash Storage**: When users enter passwords on enterprise domains, PhishCatch:
   - Hashes the password using PBKDF2 (100,000 iterations by default)
   - Stores the hash locally in Chrome's storage
   - Associates the hash with the username and hostname
   - Never stores plaintext passwords

3. **Password Reuse Detection**: When users enter passwords on dangerous domains, PhishCatch:
   - Hashes the entered password using the same algorithm
   - Compares it against stored enterprise password hashes
   - If a match is found, it triggers an alert indicating password reuse

4. **DOM Hash Analysis**: The extension uses TLSH (Trend Micro Locality Sensitive Hash) to:
   - Create fingerprints of login page DOM structures
   - Detect when similar-looking phishing pages appear on different domains
   - Alert users to potential phishing sites

5. **User Alerts**: When password reuse is detected, PhishCatch:
   - Displays browser notifications
   - Optionally sends alerts to a configured PhishCatch server
   - Provides options for users to report false positives

### How It Accomplishes Its Goals

PhishCatch achieves its security objectives through:

- **Privacy-First Design**: Passwords are never stored in plaintext; only cryptographic hashes are retained
- **Local Processing**: All password hashing and comparison happens locally in the browser
- **Non-Intrusive Monitoring**: The extension operates silently in the background without disrupting normal browsing
- **Configurable Enterprise Domains**: Organizations can customize which domains are considered "enterprise" through Chrome's managed storage
- **Extensible Architecture**: The extension supports custom username selectors, regex patterns, and domain lists

---

## Feature Summary: ChatGPT Query Logging

### Overview of Changes

This feature adds the ability to log and track queries submitted to ChatGPT (OpenAI's chat interface) when users are on enterprise domains. This enables organizations to monitor what information employees are sharing with AI assistants, which could potentially include sensitive enterprise data.

### Implementation Summary

#### Files Changed (10 files, +497 lines, -25 lines)

1. **New Files Created**:
   - `src/lib/chatgptLogger.ts` - Core logging functionality for storing and retrieving ChatGPT queries
   - `src/content-lib/chatgptMonitor.ts` - Content script monitoring for ChatGPT query submissions
   - `src/__tests__/lib/chatgptLogger.test.ts` - Comprehensive test suite

2. **Modified Files**:
   - `src/background.ts` - Added message handler for `chatgpt-query` messages
   - `src/content.ts` - Integrated ChatGPT monitoring for enterprise domains
   - `src/config.ts` - Added OpenAI domains to default enterprise domains list
   - `src/types.ts` - Added `ChatGPTQueryContent` and `ChatGPTQueryLog` interfaces
   - `extension/public/manifest.json` - Updated manifest (if needed)
   - `webpack/webpack.common.js` - Build configuration updates
   - `.prettierrc` - Code formatting configuration

#### How the Feature Works

1. **Detection**: When the content script detects an enterprise domain (including `chat.openai.com`, `chatgpt.com`, `openai.com`, `platform.openai.com`), it activates ChatGPT monitoring.

2. **Query Capture**: The `chatgptMonitor.ts` module:
   - Uses a `MutationObserver` to detect when ChatGPT's input field appears (since ChatGPT is a Single Page Application)
   - Listens for Enter key presses on the `#prompt-textarea` element
   - Also monitors form submission events as a backup
   - Captures the query text before it's submitted

3. **Message Passing**: Captured queries are sent to the background script via Chrome's message passing API with the `chatgpt-query` message type.

4. **Storage**: The background script (`background.ts`) receives the message and calls `saveChatGPTQuery()` which:
   - Generates a unique ID for each query
   - Stores the query, timestamp, and sanitized URL
   - Maintains a rolling log of the 100 most recent queries
   - Tracks total query count and last update timestamp

5. **Data Structure**: Queries are stored in Chrome's local storage with the structure:
   ```typescript
   {
     queries: ChatGPTQueryLog[],
     totalCount: number,
     lastUpdated: number
   }
   ```

### Challenges Encountered

1. **Single Page Application (SPA) Detection**: ChatGPT loads dynamically, so the input field may not exist when the content script first runs. **Solution**: Implemented a `MutationObserver` to watch for DOM changes and attach listeners when the input appears.

2. **Event Interception Without Breaking Functionality**: We needed to capture queries without preventing ChatGPT's normal form submission. **Solution**: Used event capture phase (`addEventListener(..., true)`) to intercept events before ChatGPT's handlers, but deliberately avoided calling `preventDefault()`.

3. **Duplicate Query Prevention**: Users might press Enter multiple times or the form might fire multiple events. **Solution**: Implemented a `lastQuery` variable to track the most recent query and skip duplicates.

### How to Improve Further

1. **Query Content Analysis**: Add functionality to detect potentially sensitive information in queries (PII, API keys, passwords) using pattern matching or ML models.

2. **Export Functionality**: Implement a way for administrators to export query logs for analysis, either through the popup UI or via the PhishCatch server integration.

3. **Query Filtering**: Allow organizations to configure which types of queries should be logged (e.g., exclude queries under a certain length, filter by keywords).

4. **Real-time Alerts**: Extend the alerting system to notify administrators immediately when sensitive queries are detected, rather than just logging them.

5. **Privacy Controls**: Add user-facing controls to allow users to view their own query history and request deletion of specific queries.

6. **Performance Optimization**: For high-volume users, consider implementing query batching to reduce storage API calls.

7. **Additional AI Platforms**: Extend monitoring to other AI chat interfaces (Claude, Gemini, etc.) using similar patterns.

8. **Query Context**: Capture additional context such as conversation history or the response received, which could provide better insights into data leakage risks.

9. **Storage Management**: Implement automatic cleanup of old queries based on configurable retention policies.

---

## Technical Details

### Key Technical Decisions

1. **Storage Strategy**: Used Chrome's `chrome.storage.local` API rather than IndexedDB for simplicity, as query logs don't require complex querying.

2. **Query Limit**: Implemented a hard limit of 100 queries to prevent unbounded storage growth while maintaining a useful history.

3. **Message Passing**: Used Chrome's message passing API rather than direct storage access from content scripts, maintaining proper separation of concerns.

4. **Type Safety**: Leveraged TypeScript interfaces (`ChatGPTQueryContent`, `ChatGPTQueryLog`) to ensure type safety across the codebase.

5. **Error Handling**: Implemented graceful degradation - if monitoring fails, it doesn't break ChatGPT's functionality.

