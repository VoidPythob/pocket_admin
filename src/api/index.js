import axios from 'axios'

export const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
const STORAGE_KEY = 'pocket-admin-base-url'

function normalizeBaseUrl(baseUrl) {
  return (baseUrl || '').trim().replace(/\/+$/, '')
}

function getStoredBaseUrl() {
  if (typeof window === 'undefined') {
    return DEFAULT_BASE_URL
  }

  return normalizeBaseUrl(window.localStorage.getItem(STORAGE_KEY)) || DEFAULT_BASE_URL
}

function getCookie(name) {
  if (typeof document === 'undefined') {
    return ''
  }

  const target = `${name}=`
  return document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(target))
    ?.slice(target.length) ?? ''
}

function createRequestError(error) {
  const payload = error.response?.data
  const requestError = new Error(
    payload?.msg ||
      payload?.data?.detail ||
      payload?.detail ||
      error.message ||
      '请求失败',
  )

  requestError.status = error.response?.status || 0
  requestError.payload = payload
  return requestError
}

const service = axios.create({
  baseURL: getStoredBaseUrl(),
  timeout: 15000,
  withCredentials: true,
})

service.interceptors.request.use((config) => {
  const method = (config.method || 'get').toUpperCase()
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrfToken = getCookie('csrftoken')
    if (csrfToken) {
      config.headers['X-CSRFToken'] = csrfToken
    }
  }

  return config
})

service.interceptors.response.use(
  (response) => response.data,
  (error) => Promise.reject(createRequestError(error)),
)

export function setApiBaseUrl(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl) || DEFAULT_BASE_URL
  service.defaults.baseURL = normalized
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, normalized)
  }
}

export function getApiBaseUrl() {
  return service.defaults.baseURL || DEFAULT_BASE_URL
}

export const request = {
  get(url, config) {
    return service.get(url, config)
  },
  post(url, data, config) {
    return service.post(url, data, config)
  },
  put(url, data, config) {
    return service.put(url, data, config)
  },
  patch(url, data, config) {
    return service.patch(url, data, config)
  },
  delete(url, config) {
    return service.delete(url, config)
  },
}

export function loginAdmin(payload) {
  return request.post('/admin/login/', payload)
}

export function registerAdmin(payload) {
  return request.post('/admin/register/', payload)
}

export function logoutAdmin() {
  return request.post('/admin/logout/')
}

export function checkSession() {
  return request.get('/admin/tags/')
}

export function fetchResource(endpoint, config) {
  return request.get(endpoint, config)
}

export async function fetchAllResource(endpoint, params = {}) {
  const firstResponse = await request.get(endpoint, {
    params: {
      ...params,
      page: 1,
    },
  })

  const firstData = firstResponse?.data
  if (!Array.isArray(firstData?.results)) {
    return firstResponse
  }

  const mergedResults = [...firstData.results]
  const totalPages = Number(firstData.total_pages) || 1

  if (totalPages <= 1) {
    return {
      ...firstResponse,
      data: mergedResults,
    }
  }

  const pageRequests = Array.from({ length: totalPages - 1 }, (_, index) =>
    request.get(endpoint, {
      params: {
        ...params,
        page: index + 2,
      },
    }),
  )

  const restResponses = await Promise.all(pageRequests)

  restResponses.forEach((response) => {
    const pageData = response?.data
    if (Array.isArray(pageData?.results) && pageData.results.length) {
      mergedResults.push(...pageData.results)
    }
  })

  return {
    ...firstResponse,
    data: mergedResults,
  }
}

export function createResource(endpoint, payload) {
  return request.post(endpoint, payload)
}

export function updateResource(endpoint, id, payload) {
  return request.put(`${endpoint}${id}/`, payload)
}

export function removeResource(endpoint, id) {
  return request.delete(`${endpoint}${id}/`)
}

export function createPet(payload) {
  return request.post('/admin/pets/', payload)
}

export function fetchPetDetail(id) {
  return request.get(`/admin/pets/${id}/`)
}

export function updatePet(id, payload) {
  return request.put(`/admin/pets/${id}/`, payload)
}

export function deletePet(id) {
  return request.delete(`/admin/pets/${id}/`)
}

export function importPetCsv({ file, overwriteExisting = true } = {}) {
  if (!file) {
    return request.post('/admin/pets/import-csv/', {
      overwrite_existing: overwriteExisting,
    })
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('overwrite_existing', String(overwriteExisting))

  return request.post('/admin/pets/import-csv/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}

export function searchPets(params) {
  return request.get('/pets/', { params })
}

export function fetchPetRelations(petId, segment) {
  return request.get(`/admin/pets/${petId}/${segment}/`)
}

export function addPetRelation(petId, segment, payload) {
  return request.post(`/admin/pets/${petId}/${segment}/`, payload)
}

export function replacePetRelation(petId, segment, currentId, payload) {
  return request.put(`/admin/pets/${petId}/${segment}/${currentId}/`, payload)
}

export function removePetRelation(petId, segment, currentId) {
  return request.delete(`/admin/pets/${petId}/${segment}/${currentId}/`)
}

export function uploadAdminFile(file, fieldName = 'file') {
  const formData = new FormData()
  formData.append(fieldName, file)
  return request.post('/admin/files/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}
