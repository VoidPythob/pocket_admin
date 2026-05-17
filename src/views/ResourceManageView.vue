<script setup>
import { computed, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  addItemCategoryRelation,
  createResource,
  fetchAllResource,
  fetchItemCategoryRelations,
  fetchResource,
  removeItemCategoryRelation,
  removeResource,
  replaceItemCategoryRelation,
  updateResource,
} from '@/api'
import PaginatedSelect from '@/components/form/PaginatedSelect.vue'
import { adminModuleMap, getModuleByRouteKey } from '@/config/adminModules'
import {
  createModuleForm,
  extractErrorMessage,
  extractListData,
  extractPagedData,
  hydrateModuleForm,
  normalizeModulePayload,
} from '@/utils/adminForms'

const PAGE_SIZE = 10
const ITEM_CATEGORY_PAGE_SIZE = 8

const route = useRoute()
const router = useRouter()

const state = reactive({
  loading: false,
  saving: false,
  filter: '',
  currentPage: 1,
  total: 0,
  serverPagination: false,
  items: [],
  editingId: null,
  form: {},
  lookupOptions: Object.fromEntries(Object.keys(adminModuleMap).map((key) => [key, []])),
  itemCategoryLoading: false,
  itemCategories: [],
  itemCategoryFilter: '',
  itemCategoryPage: 1,
  itemCategoryTargetId: '',
  itemCategoryReplacementTargets: {},
})

const lookupRequests = new Map()

const moduleConfig = computed(() => getModuleByRouteKey(route.params.moduleKey))
const isItemModule = computed(() => moduleConfig.value?.key === 'items')
const supportsServerSearch = computed(
  () => Boolean(state.serverPagination && moduleConfig.value?.listQueryKey),
)

const documentGroupOptions = computed(() =>
  state.lookupOptions.gameDocs.filter((item) => item.p_id === null || item.p_id === 0),
)

const itemCategoryOptions = computed(() => state.lookupOptions.itemCategories || [])

function getEntityLabel(item) {
  if (!item || typeof item !== 'object') {
    return item ?? ''
  }

  return item.name || item.category_name || item.introduction || item.title || item.id || ''
}

function stringifyFilterValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stringifyFilterValue(item)).join(' ')
  }

  if (value && typeof value === 'object') {
    return Object.values(value)
      .map((item) => stringifyFilterValue(item))
      .join(' ')
  }

  return String(value ?? '')
}

const filteredItems = computed(() => {
  if (!moduleConfig.value) {
    return []
  }

  const keyword = state.filter.trim().toLowerCase()
  if (!keyword || supportsServerSearch.value) {
    return state.items
  }

  return state.items.filter((item) =>
    moduleConfig.value.tableColumns.some((column) =>
      stringifyFilterValue(item[column.key])
        .toLowerCase()
        .includes(keyword),
    ),
  )
})

const pagedItems = computed(() => {
  const start = (state.currentPage - 1) * PAGE_SIZE
  return filteredItems.value.slice(start, start + PAGE_SIZE)
})

const pageCount = computed(() => Math.max(1, Math.ceil(filteredItems.value.length / PAGE_SIZE)))

const tableItems = computed(() => {
  if (state.serverPagination) {
    return supportsServerSearch.value ? state.items : filteredItems.value
  }

  return pagedItems.value
})

const paginationTotal = computed(() =>
  state.serverPagination ? state.total : filteredItems.value.length,
)

const filteredItemCategoryRelations = computed(() => {
  const keyword = state.itemCategoryFilter.trim().toLowerCase()
  if (!keyword) {
    return state.itemCategories
  }

  return state.itemCategories.filter((item) =>
    `${getItemCategoryId(item)} ${getItemCategoryName(item)}`.toLowerCase().includes(keyword),
  )
})

const itemCategoryPageCount = computed(() =>
  Math.max(1, Math.ceil(filteredItemCategoryRelations.value.length / ITEM_CATEGORY_PAGE_SIZE)),
)

const pagedItemCategoryRelations = computed(() => {
  const start = (state.itemCategoryPage - 1) * ITEM_CATEGORY_PAGE_SIZE
  return filteredItemCategoryRelations.value.slice(start, start + ITEM_CATEGORY_PAGE_SIZE)
})

watch(
  filteredItems,
  () => {
    if (state.serverPagination) {
      return
    }

    if (state.currentPage > pageCount.value) {
      state.currentPage = pageCount.value
    }
  },
  { immediate: true },
)

watch(
  () => state.itemCategoryFilter,
  () => {
    state.itemCategoryPage = 1
  },
)

watch(
  filteredItemCategoryRelations,
  () => {
    if (state.itemCategoryPage > itemCategoryPageCount.value) {
      state.itemCategoryPage = itemCategoryPageCount.value
    }
  },
  { immediate: true },
)

watch(
  () => state.filter,
  (value, oldValue) => {
    state.currentPage = 1

    if (!moduleConfig.value?.listQueryKey) {
      return
    }

    if (oldValue && !value.trim()) {
      loadModule(1)
    }
  },
)

function resetItemCategoryState() {
  state.itemCategories = []
  state.itemCategoryFilter = ''
  state.itemCategoryPage = 1
  state.itemCategoryTargetId = ''
  state.itemCategoryReplacementTargets = {}
}

function resetForm() {
  if (!moduleConfig.value) {
    return
  }

  state.editingId = null
  state.form = createModuleForm(moduleConfig.value)
  resetItemCategoryState()
}

function getModuleLookupKeys(module = moduleConfig.value) {
  if (!module) {
    return []
  }

  return [
    ...new Set([
      ...(module.lookupDeps || []),
      ...module.fields
        .map((field) => (field.optionsFrom === 'documentGroups' ? 'gameDocs' : field.optionsFrom))
        .filter(Boolean),
    ]),
  ]
}

async function ensureLookupOptions(keys, force = false) {
  const pending = [...new Set(keys)]
    .filter((key) => adminModuleMap[key])
    .filter((key) => force || !(state.lookupOptions[key] || []).length)

  if (!pending.length) {
    return
  }

  const results = await Promise.allSettled(
    pending.map(async (key) => {
      if (lookupRequests.has(key)) {
        await lookupRequests.get(key)
        return
      }

      const requestTask = (async () => {
        const lookupResponse = await fetchAllResource(adminModuleMap[key].endpoint)
        state.lookupOptions[key] = extractListData(lookupResponse)
      })()

      lookupRequests.set(key, requestTask)

      try {
        await requestTask
      } finally {
        lookupRequests.delete(key)
      }
    }),
  )

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const key = pending[index]
      ElMessage.warning(`${adminModuleMap[key].label} 选项加载失败：${extractErrorMessage(result.reason)}`)
    }
  })
}

function buildListParams(page = 1) {
  const params = { page }
  const keyword = state.filter.trim()

  if (moduleConfig.value?.listQueryKey && keyword) {
    params[moduleConfig.value.listQueryKey] = keyword
  }

  return params
}

async function loadModule(page = 1, { preserveEdit = false } = {}) {
  if (!moduleConfig.value) {
    router.replace('/dashboard')
    return
  }

  state.loading = true

  try {
    const response = await fetchResource(moduleConfig.value.endpoint, {
      params: buildListParams(page),
    })

    const pagedData = extractPagedData(response)
    const listData = extractListData(response)
    const hasServerPagination = Array.isArray(response?.data?.results)

    state.serverPagination = hasServerPagination
    state.currentPage = page
    state.total = hasServerPagination ? pagedData.count : listData.length
    state.items = hasServerPagination ? pagedData.results : listData
    state.lookupOptions[moduleConfig.value.key] = state.items
    if (!preserveEdit) {
      resetForm()
    }
  } catch (error) {
    ElMessage.error(`${moduleConfig.value.label} 加载失败：${extractErrorMessage(error)}`)
  } finally {
    state.loading = false
  }
}

function handleListSearch() {
  if (state.serverPagination || moduleConfig.value?.listQueryKey) {
    loadModule(1)
    return
  }

  state.currentPage = 1
}

async function startEdit(row) {
  state.editingId = row.id
  state.form = hydrateModuleForm(moduleConfig.value, row)

  try {
    const tasks = [ensureLookupOptions(getModuleLookupKeys())]

    if (isItemModule.value) {
      tasks.push(ensureLookupOptions(['itemCategories']))
      tasks.push(loadItemCategoryRelations(row.id))
    }

    await Promise.all(tasks)
  } catch (error) {
    ElMessage.error(`编辑数据加载失败：${extractErrorMessage(error)}`)
  }
}

function handleFieldVisibleChange(field, visible) {
  if (!visible) {
    return
  }

  if (field.optionsFrom === 'documentGroups') {
    ensureLookupOptions(['gameDocs'])
    return
  }

  if (field.optionsFrom) {
    ensureLookupOptions([field.optionsFrom])
  }
}

function getFieldOptions(field) {
  if (field.optionsFrom === 'documentGroups') {
    return [{ id: field.default ?? 0, name: '顶级文档组' }, ...documentGroupOptions.value]
  }

  if (field.optionsFrom) {
    return state.lookupOptions[field.optionsFrom] || []
  }

  return field.options || []
}

function getFieldOptionLabel(field, item) {
  if (field.optionLabelKey) {
    return item[field.optionLabelKey]
  }

  return item.name || item.introduction || item.id
}

function formatValue(columnKey, value) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  if (Array.isArray(value)) {
    const names = value.map((item) => getEntityLabel(item)).filter(Boolean)
    return names.length ? names.join('、') : '-'
  }

  if (typeof value === 'object') {
    return getEntityLabel(value) || '-'
  }

  if (columnKey.endsWith('_at')) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
  }

  return value
}

async function submitForm() {
  if (!moduleConfig.value) {
    return
  }

  state.saving = true

  try {
    const payload = normalizeModulePayload(moduleConfig.value, state.form)
    const response = state.editingId
      ? await updateResource(moduleConfig.value.endpoint, state.editingId, payload)
      : await createResource(moduleConfig.value.endpoint, payload)

    ElMessage.success(response?.msg || '保存成功。')
    await loadModule(state.currentPage)
  } catch (error) {
    ElMessage.error(`保存失败：${extractErrorMessage(error)}`)
  } finally {
    state.saving = false
  }
}

async function deleteItem(row) {
  if (!moduleConfig.value?.canDelete) {
    return
  }

  try {
    const response = await removeResource(moduleConfig.value.endpoint, row.id)
    ElMessage.success(response?.msg || '删除成功。')
    await loadModule(state.currentPage)
  } catch (error) {
    ElMessage.error(`删除失败：${extractErrorMessage(error)}`)
  }
}

function handlePageChange(page) {
  if (state.serverPagination) {
    loadModule(page)
    return
  }

  state.currentPage = page
}

function getItemCategoryId(item) {
  return item?.category_id ?? item?.id ?? ''
}

function getItemCategoryName(item) {
  return item?.category_name ?? item?.name ?? item?.introduction ?? item?.title ?? `#${getItemCategoryId(item)}`
}

function extractItemCategoryList(response) {
  const directList = extractListData(response)
  if (directList.length) {
    return directList
  }

  const data = response?.data
  if (Array.isArray(data?.categories)) {
    return data.categories
  }
  if (Array.isArray(data?.item_categories)) {
    return data.item_categories
  }

  return []
}

async function loadItemCategoryRelations(itemId = state.editingId) {
  if (!itemId) {
    resetItemCategoryState()
    return
  }

  state.itemCategoryLoading = true

  try {
    const response = await fetchItemCategoryRelations(itemId)
    state.itemCategories = extractItemCategoryList(response)
    state.itemCategoryFilter = ''
    state.itemCategoryPage = 1
    state.itemCategoryReplacementTargets = {}
  } catch (error) {
    ElMessage.error(`道具分类绑定加载失败：${extractErrorMessage(error)}`)
  } finally {
    state.itemCategoryLoading = false
  }
}

async function addCategoryBinding() {
  if (!state.editingId || !state.itemCategoryTargetId) {
    ElMessage.warning('请先选择要绑定的分类。')
    return
  }

  try {
    const response = await addItemCategoryRelation(state.editingId, {
      category_id: Number(state.itemCategoryTargetId),
    })
    ElMessage.success(response?.msg || '分类绑定成功。')
    state.itemCategoryTargetId = ''
    await loadItemCategoryRelations()
    await loadModule(state.currentPage, { preserveEdit: true })
  } catch (error) {
    ElMessage.error(`分类绑定失败：${extractErrorMessage(error)}`)
  }
}

async function replaceCategoryBinding(row) {
  if (!state.editingId) {
    return
  }

  const currentId = getItemCategoryId(row)
  const newId = state.itemCategoryReplacementTargets[currentId]

  if (!currentId || !newId) {
    ElMessage.warning('请先选择替换后的分类。')
    return
  }

  try {
    const response = await replaceItemCategoryRelation(state.editingId, currentId, {
      new_category_id: Number(newId),
    })
    ElMessage.success(response?.msg || '分类替换成功。')
    await loadItemCategoryRelations()
    await loadModule(state.currentPage, { preserveEdit: true })
  } catch (error) {
    ElMessage.error(`分类替换失败：${extractErrorMessage(error)}`)
  }
}

async function removeCategoryBinding(row) {
  if (!state.editingId) {
    return
  }

  try {
    const response = await removeItemCategoryRelation(state.editingId, getItemCategoryId(row))
    ElMessage.success(response?.msg || '分类解绑成功。')
    await loadItemCategoryRelations()
    await loadModule(state.currentPage, { preserveEdit: true })
  } catch (error) {
    ElMessage.error(`分类解绑失败：${extractErrorMessage(error)}`)
  }
}

watch(
  () => route.params.moduleKey,
  () => {
    state.filter = ''
    state.currentPage = 1
    resetItemCategoryState()
    loadModule()
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="moduleConfig" class="resource-page">
    <el-card shadow="hover" class="table-card">
      <template #header>
        <div class="card-header">
          <div>
            <strong>{{ moduleConfig.label }}</strong>
            <p>{{ moduleConfig.description }}</p>
          </div>

          <div class="header-actions">
            <el-input
              v-model="state.filter"
              clearable
              :placeholder="
                moduleConfig.listQueryKey
                  ? '输入名称后回车或点查询，走后端模糊搜索'
                  : '输入关键词过滤当前页列表'
              "
              @keyup.enter="handleListSearch"
            />
            <el-button :loading="state.loading" @click="handleListSearch">
              {{ moduleConfig.listQueryKey ? '查询列表' : '刷新列表' }}
            </el-button>
          </div>
        </div>
      </template>

      <el-alert
        v-for="tip in moduleConfig.tips || []"
        :key="tip"
        :title="tip"
        type="warning"
        show-icon
        :closable="false"
        class="tip-alert"
      />

      <el-table
        v-loading="state.loading"
        :data="tableItems"
        row-key="id"
        table-layout="fixed"
        border
        empty-text="当前没有数据"
      >
        <el-table-column
          v-for="column in moduleConfig.tableColumns"
          :key="column.key"
          :prop="column.key"
          :label="column.label"
          min-width="150"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <template v-if="column.key === 'color'">
              <div class="color-cell">
                <span class="color-dot" :style="{ background: row.color || '#cbd5e1' }"></span>
                <span>{{ row.color || '-' }}</span>
              </div>
            </template>
            <span v-else class="cell-text">{{ formatValue(column.key, row[column.key]) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-space wrap>
              <el-button size="small" @click="startEdit(row)">编辑</el-button>
              <el-button
                v-if="moduleConfig.canDelete"
                size="small"
                type="danger"
                plain
                @click="deleteItem(row)"
              >
                删除
              </el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="paginationTotal > PAGE_SIZE" class="pagination-wrap">
        <el-pagination
          background
          layout="total, prev, pager, next, jumper"
          :total="paginationTotal"
          :page-size="PAGE_SIZE"
          :current-page="state.currentPage"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <el-card shadow="hover" class="form-card">
      <template #header>
        <div class="card-header">
          <div>
            <strong>{{ state.editingId ? `编辑 #${state.editingId}` : `新建${moduleConfig.label}` }}</strong>
            <p>当前页面使用统一表单与分页列表，关联下拉框也支持搜索与分页。</p>
          </div>
        </div>
      </template>

      <el-form label-position="top" @submit.prevent="submitForm">
        <el-row :gutter="18">
          <el-col
            v-for="field in moduleConfig.fields"
            :key="field.key"
            :xs="24"
            :md="field.type === 'textarea' ? 24 : 12"
          >
            <el-form-item :label="field.label">
              <el-input
                v-if="field.type === 'text'"
                v-model="state.form[field.key]"
                :placeholder="field.placeholder || ''"
              />

              <el-input
                v-else-if="field.type === 'number'"
                v-model="state.form[field.key]"
                type="number"
                :placeholder="field.placeholder || ''"
              />

              <el-color-picker v-else-if="field.type === 'color'" v-model="state.form[field.key]" />

              <PaginatedSelect
                v-else-if="field.type === 'select'"
                v-model="state.form[field.key]"
                :options="getFieldOptions(field)"
                :placeholder="field.optionsFrom === 'documentGroups' ? '请选择顶级文档组' : '请选择关联项'"
                :option-label-fn="(option) => `#${option.id} ${getFieldOptionLabel(field, option)}`"
                :search-keys="[field.optionLabelKey || 'name', 'introduction', 'title', 'id']"
                @visible-change="(visible) => handleFieldVisibleChange(field, visible)"
              />

              <el-input
                v-else-if="field.type === 'textarea'"
                v-model="state.form[field.key]"
                type="textarea"
                :rows="field.rows || 6"
                :placeholder="field.placeholder || ''"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-space wrap>
          <el-button type="primary" :loading="state.saving" @click="submitForm">
            {{ state.editingId ? '保存修改' : '创建记录' }}
          </el-button>
          <el-button @click="resetForm">
            {{ state.editingId ? '取消编辑' : '清空表单' }}
          </el-button>
        </el-space>
      </el-form>

      <div v-if="isItemModule && state.editingId" class="binding-panel">
        <el-divider />

        <div class="binding-header">
          <div>
            <strong>道具分类绑定</strong>
            <p>当前编辑物品 #{{ state.editingId }}，可以新增、替换或删除分类绑定。</p>
          </div>
          <el-button :loading="state.itemCategoryLoading" @click="loadItemCategoryRelations()">
            刷新绑定
          </el-button>
        </div>

        <div class="binding-toolbar">
          <PaginatedSelect
            v-model="state.itemCategoryTargetId"
            :options="itemCategoryOptions"
            placeholder="选择要绑定的分类"
            :option-label-fn="(item) => `#${item.id} ${item.name}`"
            :search-keys="['name', 'id']"
            @visible-change="(visible) => visible && ensureLookupOptions(['itemCategories'])"
          />
          <el-button type="primary" @click="addCategoryBinding">新增分类</el-button>
        </div>

        <el-input
          v-model="state.itemCategoryFilter"
          clearable
          placeholder="过滤当前已绑定的分类"
          class="binding-filter"
        />

        <el-table
          v-loading="state.itemCategoryLoading"
          :data="pagedItemCategoryRelations"
          :row-key="getItemCategoryId"
          border
          empty-text="当前没有分类绑定"
        >
          <el-table-column label="分类ID" width="100">
            <template #default="{ row }">
              {{ getItemCategoryId(row) }}
            </template>
          </el-table-column>

          <el-table-column label="分类名称" min-width="180">
            <template #default="{ row }">
              {{ getItemCategoryName(row) }}
            </template>
          </el-table-column>

          <el-table-column label="替换为" min-width="280">
            <template #default="{ row }">
              <PaginatedSelect
                v-model="state.itemCategoryReplacementTargets[getItemCategoryId(row)]"
                :options="itemCategoryOptions"
                placeholder="选择替换后的分类"
                :option-label-fn="(item) => `#${item.id} ${item.name}`"
                :search-keys="['name', 'id']"
                @visible-change="(visible) => visible && ensureLookupOptions(['itemCategories'])"
              />
            </template>
          </el-table-column>

          <el-table-column label="操作" width="170" fixed="right">
            <template #default="{ row }">
              <el-space wrap>
                <el-button size="small" @click="replaceCategoryBinding(row)">替换</el-button>
                <el-button size="small" type="danger" plain @click="removeCategoryBinding(row)">
                  删除
                </el-button>
              </el-space>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="filteredItemCategoryRelations.length > ITEM_CATEGORY_PAGE_SIZE" class="pagination-wrap">
          <el-pagination
            background
            layout="total, prev, pager, next"
            :total="filteredItemCategoryRelations.length"
            :page-size="ITEM_CATEGORY_PAGE_SIZE"
            :current-page="state.itemCategoryPage"
            @current-change="state.itemCategoryPage = $event"
          />
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.resource-page {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(360px, 0.8fr);
  gap: 20px;
}

.table-card,
.form-card {
  border-radius: 24px;
}

.card-header,
.binding-header {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
}

.card-header strong,
.binding-header strong {
  color: #21160d;
  font-size: 20px;
}

.card-header p,
.binding-header p {
  margin: 6px 0 0;
  color: #83715f;
}

.header-actions {
  min-width: 320px;
  display: flex;
  gap: 12px;
}

.tip-alert + .tip-alert {
  margin-top: 10px;
}

.tip-alert {
  margin-bottom: 14px;
}

.color-cell {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.color-dot {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.cell-text {
  display: inline-block;
  line-height: 1.6;
  word-break: break-word;
}

.binding-panel {
  margin-top: 24px;
}

.binding-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 14px;
}

.binding-toolbar .paginated-select {
  flex: 1;
}

.binding-filter {
  margin-bottom: 14px;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}

@media (max-width: 1180px) {
  .resource-page {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 860px) {
  .card-header,
  .binding-header,
  .header-actions,
  .binding-toolbar,
  .pagination-wrap {
    min-width: 0;
    width: 100%;
    flex-direction: column;
  }
}
</style>
