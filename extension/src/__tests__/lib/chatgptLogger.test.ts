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

import { getChatGPTQueryLog, saveChatGPTQuery, clearQueryLogs } from '../lib/chatgptLogger'
import type { ChatGPTQueryContent } from '../types'

// Mock chrome.storage for testing
const mockStorage: Record<string, any> = {}

global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        if (typeof keys === 'string') {
          callback({ [keys]: mockStorage[keys] })
        } else {
          callback(mockStorage)
        }
      }),
      set: jest.fn((items, callback) => {
        Object.assign(mockStorage, items)
        if (callback) callback()
      }),
    }
  }
} as any

// Mock getSanitizedUrl
jest.mock('../lib/getSanitizedUrl', () => ({
  getSanitizedUrl: jest.fn((url: string) => Promise.resolve(url))
}))

describe('ChatGPT Query Logger', () => {
  beforeEach(() => {
    // Clear mock storage before each test
    Object.keys(mockStorage).forEach(key => delete mockStorage[key])
    jest.clearAllMocks()
  })

  describe('getChatGPTQueryLog', () => {
    it('should return empty log when no data exists', async () => {
      const log = await getChatGPTQueryLog()

      expect(log).toEqual({
        queries: [],
        totalCount: 0,
        lastUpdated: 0
      })
    })

    it('should return existing log data', async () => {
      const existingLog = {
        queries: [{ id: '1', timestamp: 123, query: 'test', queryLength: 4, url: 'https://chatgpt.com' }],
        totalCount: 1,
        lastUpdated: 456
      }
      mockStorage.chatgptQueryLog = existingLog

      const log = await getChatGPTQueryLog()

      expect(log).toEqual(existingLog)
    })
  })

  describe('saveChatGPTQuery', () => {
    it('should save a new query', async () => {
      const queryContent: ChatGPTQueryContent = {
        query: 'What is TypeScript?',
        timestamp: Date.now(),
        url: 'https://chatgpt.com'
      }

      await saveChatGPTQuery(queryContent)

      const log = await getChatGPTQueryLog()

      expect(log.queries).toHaveLength(1)
      expect(log.queries[0].query).toBe('What is TypeScript?')
      expect(log.queries[0].queryLength).toBe(19)
      expect(log.totalCount).toBe(1)
    })

    it('should add new queries to the beginning of the array', async () => {
      await saveChatGPTQuery({ query: 'First', timestamp: 100, url: 'https://chatgpt.com' })
      await saveChatGPTQuery({ query: 'Second', timestamp: 200, url: 'https://chatgpt.com' })

      const log = await getChatGPTQueryLog()

      expect(log.queries[0].query).toBe('Second')
      expect(log.queries[1].query).toBe('First')
      expect(log.totalCount).toBe(2)
    })

    it('should limit queries to 100 most recent', async () => {
      // Add 105 queries
      for (let i = 0; i < 105; i++) {
        await saveChatGPTQuery({
          query: `Query ${i}`,
          timestamp: Date.now() + i,
          url: 'https://chatgpt.com'
        })
      }

      const log = await getChatGPTQueryLog()

      expect(log.queries).toHaveLength(100)
      expect(log.queries[0].query).toBe('Query 104') // Most recent
      expect(log.queries[99].query).toBe('Query 5') // 100th most recent
      expect(log.totalCount).toBe(105) // Total count still tracks all
    })

    it('should update lastUpdated timestamp', async () => {
      const before = Date.now()

      await saveChatGPTQuery({
        query: 'Test',
        timestamp: Date.now(),
        url: 'https://chatgpt.com'
      })

      const log = await getChatGPTQueryLog()
      const after = Date.now()

      expect(log.lastUpdated).toBeGreaterThanOrEqual(before)
      expect(log.lastUpdated).toBeLessThanOrEqual(after)
    })
  })

  describe('clearQueryLogs', () => {
    it('should clear all query logs', async () => {
      // Add some queries
      await saveChatGPTQuery({ query: 'Test 1', timestamp: 100, url: 'https://chatgpt.com' })
      await saveChatGPTQuery({ query: 'Test 2', timestamp: 200, url: 'https://chatgpt.com' })

      // Clear
      await clearQueryLogs()

      const log = await getChatGPTQueryLog()

      expect(log.queries).toHaveLength(0)
      expect(log.totalCount).toBe(0)
      expect(log.lastUpdated).toBeGreaterThan(0)
    })
  })
})
