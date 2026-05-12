export function createModuleForm(module) {
  const form = {}

  module.fields.forEach((field) => {
    if (field.default !== undefined) {
      form[field.key] = field.default
      return
    }

    if (field.type === 'color') {
      form[field.key] = '#f97316'
      return
    }

    form[field.key] = ''
  })

  return form
}

function normalizeText(value, preserveWhitespace = false) {
  if (typeof value !== 'string') {
    return value
  }

  return preserveWhitespace ? value : value.trim()
}

export function normalizeModulePayload(module, form) {
  const payload = {}

  module.fields.forEach((field) => {
    let value = form[field.key]

    if (field.type === 'number' || field.type === 'select') {
      if (value === '' || value === null || value === undefined) {
        payload[field.key] = field.emptyAsNull ? null : value
      } else {
        payload[field.key] = Number(value)
      }
      return
    }

    if (field.type === 'color') {
      payload[field.key] = value || field.default || '#f97316'
      return
    }

    value = normalizeText(value, field.preserveWhitespace)
    payload[field.key] = field.emptyAsNull && value === '' ? null : value
  })

  return payload
}

export function hydrateModuleForm(module, item) {
  const form = createModuleForm(module)

  module.fields.forEach((field) => {
    let value = item[field.key]

    if (field.key === 'p_id' && (value === null || value === undefined)) {
      value = 0
    }

    if (field.type === 'color' && !value) {
      value = field.default || '#f97316'
    }

    form[field.key] = value ?? ''
  })

  return form
}

export function extractListData(payload) {
  const data = payload?.data
  if (Array.isArray(data)) {
    return data
  }

  if (Array.isArray(data?.results)) {
    return data.results
  }

  return []
}

export function extractPagedData(payload) {
  const data = payload?.data

  if (Array.isArray(data)) {
    return {
      count: data.length,
      results: data,
    }
  }

  if (Array.isArray(data?.results)) {
    return {
      count: Number(data.count) || data.results.length,
      results: data.results,
    }
  }

  return {
    count: 0,
    results: [],
  }
}

export function extractErrorMessage(error) {
  return error?.payload?.msg || error?.message || '未知错误'
}
