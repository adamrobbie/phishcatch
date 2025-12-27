// Copyright 2021 Palantir Technologies
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { getSanitizedUrl } from '../lib/getSanitizedUrl'
import type { ChatGPTQueryContent } from '../types'

// Monitor ChatGPT for query submissions
export function setupChatGPTMonitoring() {
  console.log('[PhishCatch Content] 🤖 Setting up ChatGPT query logging')

  // ChatGPT uses a contenteditable div as the main input
  const INPUT_SELECTOR = '#prompt-textarea'
  const FORM_SELECTOR = 'form[class*="composer"]'

  let isMonitoring = false
  let lastQuery = ''
  let observer: MutationObserver | null = null

  // Attach listener to the prompt textarea
  function attachQueryListener() {
    if (isMonitoring) return

    const promptTextarea = document.querySelector(INPUT_SELECTOR)
    if (!promptTextarea) {
      console.log('[PhishCatch Content] ChatGPT input not found yet, will retry')
      return
    }

    console.log('[PhishCatch Content] Found ChatGPT input, attaching listeners')
    isMonitoring = true

    // Listen for Enter key on the contenteditable div
    promptTextarea.addEventListener('keydown', (e: Event) => {
      const keyEvent = e as KeyboardEvent

      // Enter without Shift submits the query
      if (keyEvent.key === 'Enter' && !keyEvent.shiftKey) {
        const target = keyEvent.target as HTMLElement
        const query = target.textContent?.trim() || ''

        if (query && query !== lastQuery) {
          console.log('[PhishCatch Content] 💬 ChatGPT query detected via Enter key')
          logChatGPTQuery(query)
          lastQuery = query
        }
      }
    })

    // Also listen for form submission as backup
    // Note: We use capture phase to intercept before ChatGPT's handler, but don't preventDefault()
    // to avoid breaking ChatGPT's form submission
    const form = document.querySelector(FORM_SELECTOR)
    if (form) {
      form.addEventListener('submit', (e: Event) => {
        const promptTextarea = document.querySelector(INPUT_SELECTOR) as HTMLElement
        const query = promptTextarea?.textContent?.trim() || ''

        if (query && query !== lastQuery) {
          console.log('[PhishCatch Content] 💬 ChatGPT query detected via form submit')
          logChatGPTQuery(query)
          lastQuery = query
        }
        // Don't prevent default - let ChatGPT handle submission normally
      }, true) // Use capture phase
    }
  }

  // Use MutationObserver to detect when the input appears (ChatGPT is SPA)
  observer = new MutationObserver(() => {
    if (!isMonitoring) {
      attachQueryListener()
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true
  })

  // Disconnect observer when page unloads to prevent memory leaks
  window.addEventListener('beforeunload', () => {
    if (observer) {
      observer.disconnect()
      observer = null
    }
  })

  // Try to attach immediately if already loaded
  attachQueryListener()
}

// Log a ChatGPT query
async function logChatGPTQuery(query: string) {
  console.log('[PhishCatch Content] Logging query:', { length: query.length })

  const content: ChatGPTQueryContent = {
    query,
    timestamp: Date.now(),
    url: await getSanitizedUrl(window.location.href)
  }

  chrome.runtime.sendMessage({
    msgtype: 'chatgpt-query',
    content
  })
}
