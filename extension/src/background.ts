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

import { getConfig } from './config'
import {
  PageMessage,
  UsernameContent,
  PasswordContent,
  DomstringContent,
  ChatGPTQueryContent,
  PasswordHandlingReturnValue,
  DomainType,
  AlertTypes,
  PasswordHash,
} from './types'
import { hashAndSavePassword as hashAndSavePassword, saveUsername, getHashDataIfItExists, removeHash } from './lib/userInfo'
import { checkDOMHash, saveDOMHash } from './lib/domhash'
import { showCheckmarkIfEnterpriseDomain } from './lib/showCheckmarkIfEnterpriseDomain'
import { createServerAlert } from './lib/sendAlert'
import { getDomainType } from './lib/getDomainType'
import { getHostFromUrl } from './lib/getHostFromUrl'
import { timedCleanup } from './lib/timedCleanup'
import { addNotitication, handleNotificationClick } from './lib/handleNotificationClick'

export async function receiveMessage(message: PageMessage): Promise<void> {
  console.log('[PhishCatch BG] Received message:', message.msgtype, message)

  switch (message.msgtype) {
    case 'debug': {
      console.log('[PhishCatch BG] Debug message received')
      break
    }
    case 'username': {
      const content = <UsernameContent>message.content
      const domainType = await getDomainType(getHostFromUrl(content.url))
      console.log('[PhishCatch BG] Username entry detected:', {
        username: content.username,
        url: content.url,
        domainType: domainType === DomainType.ENTERPRISE ? 'ENTERPRISE' : 'OTHER'
      })

      if (domainType === DomainType.ENTERPRISE) {
        console.log('[PhishCatch BG] Saving username for enterprise domain')
        void saveUsername(content.username)
        void saveDOMHash(content.dom, content.url)
      }
      break
    }
    case 'password': {
      const content = <PasswordContent>message.content
      if (content.password) {
        console.log('[PhishCatch BG] Password entry detected:', {
          url: content.url,
          passwordLength: content.password.length,
          save: content.save
        })
        void handlePasswordEntry(content)
      }
      break
    }
    case 'domstring': {
      const content = <DomstringContent>message.content
      console.log('[PhishCatch BG] DOM hash check requested for:', content.url)
      void checkDOMHash(content.dom, content.url)
      break
    }
    case 'chatgpt-query': {
      const content = <ChatGPTQueryContent>message.content
      console.log('[PhishCatch BG] 💬 ChatGPT query logged:', {
        length: content.query.length,
        timestamp: content.timestamp,
        url: content.url
      })
      const { saveChatGPTQuery } = await import('./lib/chatgptLogger')
      void saveChatGPTQuery(content)
      break
    }
  }
}

//check if the site the password was entered into is a corporate site
export async function handlePasswordEntry(message: PasswordContent) {
  const url = message.url
  const host = getHostFromUrl(url)
  const password = message.password
  const domainType = await getDomainType(host)

  console.log('[PhishCatch BG] Handling password entry:', {
    host,
    domainType: domainType === DomainType.ENTERPRISE ? 'ENTERPRISE' : domainType === DomainType.DANGEROUS ? 'DANGEROUS' : 'OTHER',
    save: message.save
  })

  if (domainType === DomainType.ENTERPRISE) {
    if (message.save) {
      console.log('[PhishCatch BG] Saving password hash for enterprise domain:', host)
      await hashAndSavePassword(password, message.username, host)
      return PasswordHandlingReturnValue.EnterpriseSave
    }
    console.log('[PhishCatch BG] Enterprise domain but not saving')
    return PasswordHandlingReturnValue.EnterpriseNoSave
  } else if (domainType === DomainType.DANGEROUS) {
    console.log('[PhishCatch BG] Checking for password reuse on dangerous domain:', host)
    const hashData = await getHashDataIfItExists(password)
    if (hashData) {
      console.log('[PhishCatch BG] ⚠️ PASSWORD REUSE DETECTED!', {
        dangerousSite: host,
        associatedWith: hashData.hostname,
        username: hashData.username
      })
      await handlePasswordLeak(message, hashData)
      return PasswordHandlingReturnValue.ReuseAlert
    } else {
      console.log('[PhishCatch BG] No password reuse detected')
    }
  } else {
    console.log('[PhishCatch BG] Ignored domain:', host)
    return PasswordHandlingReturnValue.IgnoredDomain
  }

  return PasswordHandlingReturnValue.NoReuse
}

async function handlePasswordLeak(message: PasswordContent, hashData: PasswordHash) {
  const config = await getConfig()
  const alertContent = {
    ...message,
    alertType: AlertTypes.REUSE,
    associatedHostname: hashData.hostname || '',
    associatedUsername: hashData.username || '',
  }

  void createServerAlert(alertContent)

  if (config.display_reuse_alerts) {
    // Iconurl: https://www.flaticon.com/free-icon/hacker_1995788?term=phish&page=1&position=49
    const alertIconUrl = chrome.runtime.getURL('icon.png')
    const opt: chrome.notifications.NotificationOptions = {
      type: 'basic',
      title: 'PhishCatch Alert',
      message: `PhishCatch has detected enterprise password re-use on the url: ${message.url}\n`,
      iconUrl: alertIconUrl,
      requireInteraction: true,
      priority: 2,
      buttons: [{ title: 'This is a false positive' }, { title: `That wasn't my enterprise password` }],
    }

    chrome.notifications.create(opt, (id) => {
      addNotitication({ id, hash: hashData.hash, url: message.url })
    })
  }

  if (config.expire_hash_on_use) {
    await removeHash(hashData.hash)
  }
}

function setup() {
  console.log('[PhishCatch BG] 🎣 Background service worker starting...')

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  chrome.runtime.onMessage.addListener(receiveMessage)
  chrome.notifications.onButtonClicked.addListener(handleNotificationClick)

  void showCheckmarkIfEnterpriseDomain()
  timedCleanup()

  // Log configuration on startup
  void getConfig().then((config) => {
    console.log('[PhishCatch BG] Configuration loaded:', {
      enterpriseDomains: config.enterprise_domains,
      displayAlerts: config.display_reuse_alerts,
      server: config.phishcatch_server || 'none (local only)'
    })
  })

  console.log('[PhishCatch BG] ✅ Extension initialized')
}

setup()
