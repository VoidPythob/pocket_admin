import { defineStore } from 'pinia'
import { checkSession, loginAdmin, logoutAdmin, registerAdmin } from '@/api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    authenticated: false,
    checked: false,
    checking: false,
    user: null,
  }),
  actions: {
    resetSession() {
      this.authenticated = false
      this.checked = false
      this.checking = false
      this.user = null
    },
    async login(payload) {
      const response = await loginAdmin(payload)
      this.authenticated = true
      this.checked = true
      this.user = response?.data || { email: payload.email }
      return response
    },
    async register(payload) {
      return registerAdmin(payload)
    },
    async logout() {
      try {
        await logoutAdmin()
      } catch (error) {
        if (error?.status && error.status !== 404) {
          throw error
        }
      } finally {
        this.resetSession()
      }
    },
    async verifySession(force = false) {
      if (this.checking) {
        return this.authenticated
      }

      if (this.checked && !force) {
        return this.authenticated
      }

      this.checking = true
      try {
        await checkSession()
        this.authenticated = true
        this.checked = true
        if (!this.user) {
          this.user = { email: '当前会话可用' }
        }
        return true
      } catch {
        this.authenticated = false
        this.checked = true
        this.user = null
        return false
      } finally {
        this.checking = false
      }
    },
  },
})
