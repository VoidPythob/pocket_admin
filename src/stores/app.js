import { defineStore } from 'pinia'
import { DEFAULT_BASE_URL, getApiBaseUrl, setApiBaseUrl } from '@/api'

function normalizeBaseUrl(baseUrl) {
  return (baseUrl || '').trim().replace(/\/+$/, '') || DEFAULT_BASE_URL
}

export const useAppStore = defineStore('app', {
  state: () => ({
    initialized: false,
    baseUrl: DEFAULT_BASE_URL,
  }),
  actions: {
    init() {
      if (this.initialized) {
        return
      }

      this.baseUrl = normalizeBaseUrl(getApiBaseUrl())
      this.initialized = true
    },
    setBaseUrl(baseUrl) {
      this.baseUrl = normalizeBaseUrl(baseUrl)
      setApiBaseUrl(this.baseUrl)
    },
  },
})
