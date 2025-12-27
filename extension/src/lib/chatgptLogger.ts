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

import { getSanitizedUrl } from './getSanitizedUrl'
import type { ChatGPTQueryContent, ChatGPTQueryLog } from '../types'

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Get stored ChatGPT query logs
export async function getChatGPTQueryLog(): Promise<{ queries: ChatGPTQueryLog[]; totalCount: number; lastUpdated: number }> {
  return new Promise((resolve) => {
    chrome.storage.local.get('chatgptQueryLog', (data) => {
      const log = data.chatgptQueryLog || { queries: [], totalCount: 0, lastUpdated: 0 }
      resolve(log)
    })
  })
}

// Save a ChatGPT query
export async function saveChatGPTQuery(content: ChatGPTQueryContent): Promise<void> {
  console.log('[PhishCatch] Saving ChatGPT query:', { length: content.query.length, timestamp: content.timestamp })

  const log = await getChatGPTQueryLog()

  const newQuery: ChatGPTQueryLog = {
    id: generateId(),
    timestamp: content.timestamp,
    query: content.query,
    queryLength: content.query.length,
    url: await getSanitizedUrl(content.url),
  }

  // Add to beginning of array
  log.queries.unshift(newQuery)

  // Keep only latest 100 queries
  log.queries = log.queries.slice(0, 100)
  log.totalCount++
  log.lastUpdated = Date.now()

  await chrome.storage.local.set({ chatgptQueryLog: log })
  console.log('[PhishCatch] Query saved. Total queries:', log.queries.length)
}

// Export function to view logs (for debugging)
export async function exportQueryLogs(): Promise<string> {
  const log = await getChatGPTQueryLog()
  return JSON.stringify(log, null, 2)
}

// Clear all query logs
export async function clearQueryLogs(): Promise<void> {
  await chrome.storage.local.set({
    chatgptQueryLog: { queries: [], totalCount: 0, lastUpdated: Date.now() }
  })
  console.log('[PhishCatch] All ChatGPT query logs cleared')
}
