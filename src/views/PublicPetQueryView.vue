<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  deletePet,
  fetchPetDetail,
  fetchResource,
  getApiBaseUrl,
  importPetCsv,
  searchPets,
  updatePet,
  uploadAdminFile,
} from '@/api'
import { extractErrorMessage, extractListData } from '@/utils/adminForms'

const lookupLoading = ref(false)
const searchLoading = ref(false)
const dialogLoading = ref(false)
const saving = ref(false)
const searched = ref(false)
const importingCsv = ref(false)
const uploadRef = ref(null)
const csvUploadRef = ref(null)
const uploadCount = ref(0)
const selectedCsvFile = ref(null)
const csvImportResult = ref(null)

const lookups = reactive({
  generations: [],
  features: [],
  rances: [],
  skills: [],
})

const filterForm = reactive({
  generation_id: '',
  feature_id: '',
  name: '',
})

const csvImportForm = reactive({
  overwriteExisting: true,
})

const pets = ref([])
const dialogVisible = ref(false)

const editForm = reactive({
  id: null,
  name: '',
  jp_name: '',
  en_name: '',
  generation_id: '',
  rance_id: '',
  feature_ids: [],
  skill_ids: [],
})

const editImages = ref([])

const generationOptions = computed(() => lookups.generations)
const featureOptions = computed(() => lookups.features)
const ranceOptions = computed(() => lookups.rances)
const skillOptions = computed(() => lookups.skills)
const imageUploading = computed(() => uploadCount.value > 0)
const resultCountText = computed(() => {
  if (!searched.value) {
    return '先选择世代和条件查询宠物，再在表格里进行编辑、删除和导入后的校验。'
  }

  return `当前共查询到 ${pets.value.length} 只宠物。`
})
const csvResultItems = computed(() => {
  const data = csvImportResult.value
  if (!data) {
    return []
  }

  return [
    { label: '数据来源', value: data.source || '-' },
    { label: '覆盖已有', value: data.overwrite_existing ? '是' : '否' },
    { label: '总行数', value: data.total_rows ?? 0 },
    { label: '新建宠物', value: data.created_pets ?? 0 },
    { label: '更新宠物', value: data.updated_pets ?? 0 },
    { label: '跳过宠物', value: data.skipped_pets ?? 0 },
    { label: '新建世代', value: data.created_generations ?? 0 },
    { label: '新建属性', value: data.created_attributes ?? 0 },
    { label: '新建特性', value: data.created_features ?? 0 },
    { label: '新建标签', value: data.created_tags ?? 0 },
    { label: '新建种族', value: data.created_rances ?? 0 },
    { label: '新建图鉴说明', value: data.created_guides ?? 0 },
    { label: '关联世代', value: data.linked_generations ?? 0 },
    { label: '关联属性', value: data.linked_attributes ?? 0 },
    { label: '关联特性', value: data.linked_features ?? 0 },
    { label: '关联标签', value: data.linked_tags ?? 0 },
  ]
})

function buildPreviewUrl(path) {
  if (!path) {
    return ''
  }

  if (/^https?:\/\//.test(path)) {
    return path
  }

  const baseUrl = getApiBaseUrl().replace(/\/+$/, '')
  if (path.startsWith('/')) {
    return `${baseUrl}${path}`
  }

  return `${baseUrl}/${path}`
}

function buildSubmitUrl(path) {
  if (!path) {
    return ''
  }

  if (/^https?:\/\//.test(path)) {
    return path
  }

  const baseUrl = getApiBaseUrl().replace(/\/+$/, '')

  if (typeof window === 'undefined') {
    return path.startsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`
  }

  if (/^https?:\/\//.test(baseUrl)) {
    return path.startsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`
  }

  const normalizedBase = baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`
  return path.startsWith('/')
    ? `${window.location.origin}${normalizedBase}${path}`
    : `${window.location.origin}${normalizedBase}/${path}`
}

function formatNames(row) {
  return [row.jp_name, row.en_name].filter(Boolean).join(' / ') || '-'
}

function formatFeatureList(row) {
  if (!Array.isArray(row.features) || !row.features.length) {
    return []
  }

  return row.features
    .map((item) => item.name || item.introduction || item.title)
    .filter(Boolean)
}

function formatTagList(row) {
  if (!Array.isArray(row.tags) || !row.tags.length) {
    return []
  }

  return row.tags.map((item) => item.name || item.title).filter(Boolean)
}

function getTableImageUrl(row) {
  return buildPreviewUrl(row.first_image_url)
}

function resetEditForm() {
  editForm.id = null
  editForm.name = ''
  editForm.jp_name = ''
  editForm.en_name = ''
  editForm.generation_id = ''
  editForm.rance_id = ''
  editForm.feature_ids = []
  editForm.skill_ids = []
  editImages.value = []
  uploadRef.value?.clearFiles?.()
}

async function loadLookups() {
  lookupLoading.value = true

  try {
    const [generations, features, rances, skills] = await Promise.all([
      fetchResource('/admin/generations/'),
      fetchResource('/admin/features/'),
      fetchResource('/admin/rances/'),
      fetchResource('/admin/skills/'),
    ])

    lookups.generations = extractListData(generations)
    lookups.features = extractListData(features)
    lookups.rances = extractListData(rances)
    lookups.skills = extractListData(skills)

    if (!filterForm.generation_id && lookups.generations.length) {
      filterForm.generation_id = String(lookups.generations[0].id)
    }
  } catch (error) {
    ElMessage.error(`筛选项加载失败：${extractErrorMessage(error)}`)
  } finally {
    lookupLoading.value = false
  }
}

async function submitSearch() {
  if (!filterForm.generation_id) {
    ElMessage.warning('请先选择世代。')
    return
  }

  searchLoading.value = true

  try {
    const response = await searchPets({
      generation_id: Number(filterForm.generation_id),
      feature_id: filterForm.feature_id ? Number(filterForm.feature_id) : undefined,
      name: filterForm.name.trim() || undefined,
    })

    pets.value = extractListData(response)
    searched.value = true

    if (!pets.value.length) {
      ElMessage.info('当前条件下没有查询到宠物。')
    }
  } catch (error) {
    ElMessage.error(`宠物查询失败：${extractErrorMessage(error)}`)
  } finally {
    searchLoading.value = false
  }
}

function resetFilters() {
  filterForm.feature_id = ''
  filterForm.name = ''

  if (!filterForm.generation_id && lookups.generations.length) {
    filterForm.generation_id = String(lookups.generations[0].id)
  }
}

function handleCsvFileChange(file) {
  selectedCsvFile.value = file.raw || null
}

function handleCsvFileRemove() {
  selectedCsvFile.value = null
}

async function runCsvImport(mode) {
  if (mode === 'upload' && !selectedCsvFile.value) {
    ElMessage.warning('请先选择要导入的 CSV 文件。')
    return
  }

  importingCsv.value = true

  try {
    const response = await importPetCsv({
      file: mode === 'upload' ? selectedCsvFile.value : null,
      overwriteExisting: csvImportForm.overwriteExisting,
    })

    csvImportResult.value = response?.data || null
    ElMessage.success(response?.msg || 'CSV 导入成功。')

    if (mode === 'upload') {
      csvUploadRef.value?.clearFiles?.()
      selectedCsvFile.value = null
    }

    await loadLookups()

    if (searched.value) {
      await submitSearch()
    }
  } catch (error) {
    ElMessage.error(`CSV 导入失败：${extractErrorMessage(error)}`)
  } finally {
    importingCsv.value = false
  }
}

async function handleImageUpload(option) {
  uploadCount.value += 1

  try {
    const response = await uploadAdminFile(option.file)
    const payload = response?.data

    if (!payload?.url) {
      throw new Error('上传成功但没有返回图片地址。')
    }

    editImages.value.push({
      uid: option.file.uid,
      file_id: payload.file_id,
      file_name: payload.file_name || option.file.name,
      rawUrl: payload.url,
      previewUrl: buildPreviewUrl(payload.url),
      submitUrl: buildSubmitUrl(payload.url),
    })

    ElMessage.success(`${payload.file_name || option.file.name} 上传成功。`)
    option.onSuccess?.(response)
  } catch (error) {
    ElMessage.error(`图片上传失败：${extractErrorMessage(error)}`)
    option.onError?.(error)
  } finally {
    uploadCount.value -= 1
  }
}

function removeImage(index) {
  editImages.value.splice(index, 1)
}

function moveImage(index, offset) {
  const targetIndex = index + offset
  if (targetIndex < 0 || targetIndex >= editImages.value.length) {
    return
  }

  const current = editImages.value[index]
  editImages.value.splice(index, 1)
  editImages.value.splice(targetIndex, 0, current)
}

function buildImageState(images) {
  return (images || []).map((item, index) => ({
    uid: `image-${index}`,
    file_id: '',
    file_name: `image-${index + 1}`,
    rawUrl: item,
    previewUrl: buildPreviewUrl(item),
    submitUrl: buildSubmitUrl(item),
  }))
}

async function openEditDialog(row) {
  dialogLoading.value = true
  dialogVisible.value = true
  resetEditForm()

  try {
    const detailResponse = await fetchPetDetail(row.id)
    const detail = detailResponse?.data || {}

    editForm.id = row.id
    editForm.name = detail.name || row.name || ''
    editForm.jp_name = detail.jp_name || row.jp_name || ''
    editForm.en_name = detail.en_name || row.en_name || ''
    editForm.generation_id = detail.generation_id ? String(detail.generation_id) : ''
    editForm.rance_id = detail.rance_id ? String(detail.rance_id) : ''
    editForm.feature_ids = Array.isArray(detail.feature_ids) ? detail.feature_ids : []
    editForm.skill_ids = Array.isArray(detail.skill_ids) ? detail.skill_ids : []
    editImages.value = buildImageState(detail.icon_urls)
  } catch (error) {
    dialogVisible.value = false
    ElMessage.error(`宠物详情加载失败：${extractErrorMessage(error)}`)
  } finally {
    dialogLoading.value = false
  }
}

async function savePet() {
  if (!editForm.id) {
    return
  }

  if (!editForm.generation_id) {
    ElMessage.warning('请先选择世代。')
    return
  }

  if (!editForm.rance_id) {
    ElMessage.warning('请先选择种族。')
    return
  }

  if (!editImages.value.length) {
    ElMessage.warning('请至少保留一张宠物图片。')
    return
  }

  saving.value = true

  try {
    const response = await updatePet(editForm.id, {
      name: editForm.name.trim(),
      jp_name: editForm.jp_name.trim(),
      en_name: editForm.en_name.trim(),
      generation_id: Number(editForm.generation_id),
      rance_id: Number(editForm.rance_id),
      feature_ids: editForm.feature_ids.map(Number),
      skill_ids: editForm.skill_ids.map(Number),
      icon_urls: editImages.value.map((item) => item.submitUrl),
    })

    ElMessage.success(response?.msg || '宠物修改成功。')
    dialogVisible.value = false
    await submitSearch()
  } catch (error) {
    ElMessage.error(`宠物修改失败：${extractErrorMessage(error)}`)
  } finally {
    saving.value = false
  }
}

async function removePet(row) {
  try {
    await ElMessageBox.confirm(`确定删除宠物 #${row.id} ${row.name} 吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  try {
    const response = await deletePet(row.id)
    ElMessage.success(response?.msg || '宠物删除成功。')

    if (dialogVisible.value && editForm.id === row.id) {
      dialogVisible.value = false
    }

    await submitSearch()
  } catch (error) {
    ElMessage.error(`宠物删除失败：${extractErrorMessage(error)}`)
  }
}

onMounted(loadLookups)
</script>

<template>
  <div class="page-stack">
    <el-card shadow="hover" class="import-card">
      <template #header>
        <div class="card-header">
          <div>
            <strong>CSV 导入</strong>
            <p>支持上传自定义 CSV，或直接触发服务端内置 pokemon.csv 导入。</p>
          </div>
        </div>
      </template>

      <el-row :gutter="18">
        <el-col :xs="24" :lg="15">
          <el-form label-position="top">
            <el-form-item label="选择 CSV 文件">
              <el-upload
                ref="csvUploadRef"
                action="#"
                :auto-upload="false"
                :limit="1"
                accept=".csv,text/csv"
                :on-change="handleCsvFileChange"
                :on-remove="handleCsvFileRemove"
              >
                <template #trigger>
                  <el-button>选择 CSV 文件</el-button>
                </template>
                <template #tip>
                  <div class="upload-tip">
                    只支持 `.csv` 文件。不选择文件时，可直接使用右侧按钮导入后端内置数据。
                  </div>
                </template>
              </el-upload>
            </el-form-item>

            <el-form-item label="导入策略">
              <el-switch
                v-model="csvImportForm.overwriteExisting"
                inline-prompt
                active-text="覆盖"
                inactive-text="跳过"
              />
            </el-form-item>

            <div class="form-actions">
              <el-button type="primary" :loading="importingCsv" @click="runCsvImport('upload')">
                上传并导入
              </el-button>
              <el-button :loading="importingCsv" @click="runCsvImport('builtin')">
                导入内置 CSV
              </el-button>
            </div>
          </el-form>
        </el-col>

        <el-col :xs="24" :lg="9">
          <el-alert
            title="导入说明"
            type="info"
            :closable="false"
            show-icon
          >
            <p>开启“覆盖”时，已存在的宠物会按英文名更新。</p>
            <p>关闭“覆盖”时，已存在宠物会被跳过并计入统计。</p>
            <p>导入成功后会自动刷新筛选项，并刷新当前宠物列表。</p>
          </el-alert>
        </el-col>
      </el-row>

      <el-descriptions
        v-if="csvResultItems.length"
        class="import-result"
        :column="3"
        border
      >
        <el-descriptions-item
          v-for="item in csvResultItems"
          :key="item.label"
          :label="item.label"
        >
          {{ item.value }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card shadow="hover" class="query-card">
      <template #header>
        <div class="card-header">
          <div>
            <strong>宠物管理</strong>
            <p>按世代、特性和名称筛选宠物，并在表格中进行编辑和删除。</p>
          </div>
          <el-button :loading="lookupLoading" @click="loadLookups">刷新筛选项</el-button>
        </div>
      </template>

      <el-form label-position="top">
        <el-row :gutter="18">
          <el-col :xs="24" :md="8">
            <el-form-item label="世代">
              <el-select
                v-model="filterForm.generation_id"
                placeholder="请选择世代"
                clearable
                filterable
              >
                <el-option
                  v-for="item in generationOptions"
                  :key="item.id"
                  :label="item.name"
                  :value="String(item.id)"
                />
              </el-select>
            </el-form-item>
          </el-col>

          <el-col :xs="24" :md="8">
            <el-form-item label="特性">
              <el-select
                v-model="filterForm.feature_id"
                placeholder="可选，按特性筛选"
                clearable
                filterable
              >
                <el-option
                  v-for="item in featureOptions"
                  :key="item.id"
                  :label="item.name || item.introduction || `特性 #${item.id}`"
                  :value="String(item.id)"
                />
              </el-select>
            </el-form-item>
          </el-col>

          <el-col :xs="24" :md="8">
            <el-form-item label="宠物名称">
              <el-input
                v-model="filterForm.name"
                placeholder="可选，支持名称模糊搜索"
                clearable
                @keyup.enter="submitSearch"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <div class="form-actions">
          <el-button type="primary" :loading="searchLoading" @click="submitSearch">查询宠物</el-button>
          <el-button @click="resetFilters">重置筛选</el-button>
        </div>
      </el-form>
    </el-card>

    <el-card shadow="hover" class="result-card">
      <template #header>
        <div class="card-header">
          <div>
            <strong>宠物列表</strong>
            <p>{{ resultCountText }}</p>
          </div>
        </div>
      </template>

      <el-table
        v-loading="searchLoading"
        :data="pets"
        border
        empty-text="暂无符合条件的宠物"
      >
        <el-table-column label="封面" width="108" align="center">
          <template #default="{ row }">
            <el-image
              v-if="row.first_image_url"
              :src="getTableImageUrl(row)"
              :preview-src-list="[getTableImageUrl(row)]"
              fit="cover"
              class="table-cover"
              preview-teleported
            />
            <span v-else class="empty-text">无图</span>
          </template>
        </el-table-column>

        <el-table-column prop="id" label="ID" width="88" />
        <el-table-column prop="name" label="中文名" min-width="150" />
        <el-table-column label="别名" min-width="220">
          <template #default="{ row }">
            <span class="cell-text">{{ formatNames(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="特性" min-width="240">
          <template #default="{ row }">
            <div class="tag-row">
              <el-tag v-for="feature in formatFeatureList(row)" :key="feature" effect="light">
                {{ feature }}
              </el-tag>
              <span v-if="!formatFeatureList(row).length" class="empty-text">-</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="标签" min-width="220">
          <template #default="{ row }">
            <div class="tag-row">
              <el-tag v-for="tag in formatTagList(row)" :key="tag" type="success" effect="plain">
                {{ tag }}
              </el-tag>
              <span v-if="!formatTagList(row).length" class="empty-text">-</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="190" fixed="right">
          <template #default="{ row }">
            <el-space wrap>
              <el-button size="small" @click="openEditDialog(row)">编辑</el-button>
              <el-button size="small" type="danger" plain @click="removePet(row)">删除</el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      title="编辑宠物"
      width="960px"
      destroy-on-close
      :close-on-click-modal="false"
    >
      <div v-loading="dialogLoading">
        <el-form label-position="top">
          <el-row :gutter="18">
            <el-col :xs="24" :md="8">
              <el-form-item label="中文名">
                <el-input v-model="editForm.name" placeholder="请输入中文名" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :md="8">
              <el-form-item label="日文名">
                <el-input v-model="editForm.jp_name" placeholder="请输入日文名" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :md="8">
              <el-form-item label="英文名">
                <el-input v-model="editForm.en_name" placeholder="请输入英文名" />
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="18">
            <el-col :xs="24" :md="12">
              <el-form-item label="世代">
                <el-select
                  v-model="editForm.generation_id"
                  filterable
                  clearable
                  placeholder="请选择世代"
                >
                  <el-option
                    v-for="item in generationOptions"
                    :key="item.id"
                    :label="`#${item.id} ${item.name}`"
                    :value="String(item.id)"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :md="12">
              <el-form-item label="种族">
                <el-select
                  v-model="editForm.rance_id"
                  filterable
                  clearable
                  placeholder="请选择种族"
                >
                  <el-option
                    v-for="item in ranceOptions"
                    :key="item.id"
                    :label="`#${item.id} ${item.name}`"
                    :value="String(item.id)"
                  />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item label="特性">
            <el-select
              v-model="editForm.feature_ids"
              multiple
              filterable
              collapse-tags
              collapse-tags-tooltip
              placeholder="选择特性"
            >
              <el-option
                v-for="item in featureOptions"
                :key="item.id"
                :label="`#${item.id} ${item.introduction || item.name || ''}`"
                :value="item.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="技能">
            <el-select
              v-model="editForm.skill_ids"
              multiple
              filterable
              collapse-tags
              collapse-tags-tooltip
              placeholder="选择技能"
            >
              <el-option
                v-for="item in skillOptions"
                :key="item.id"
                :label="`#${item.id} ${item.name}`"
                :value="item.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="图片面板">
            <el-upload
              ref="uploadRef"
              drag
              multiple
              action="#"
              accept="image/*"
              :auto-upload="true"
              :show-file-list="false"
              :http-request="handleImageUpload"
            >
              <div class="upload-panel-title">拖拽图片到这里，或点击选择文件</div>
              <div class="el-upload__text">选中文件后会自动上传，并加入当前宠物图片队列</div>
            </el-upload>

            <div class="upload-status-row">
              <el-tag :type="imageUploading ? 'warning' : 'success'">
                {{ imageUploading ? '图片上传中' : `当前共 ${editImages.length} 张图` }}
              </el-tag>
              <span class="upload-hint">第一张图片会作为封面图提交。</span>
            </div>

            <div v-if="editImages.length" class="image-queue">
              <div v-for="(item, index) in editImages" :key="item.uid" class="image-card">
                <el-image :src="item.previewUrl" fit="cover" class="image-preview" />

                <div class="image-meta">
                  <div class="image-meta-head">
                    <strong>{{ item.file_name }}</strong>
                    <el-tag v-if="index === 0" type="primary">封面</el-tag>
                  </div>
                  <p class="image-url">{{ item.submitUrl }}</p>
                </div>

                <div class="image-actions">
                  <el-button size="small" :disabled="index === 0" @click="moveImage(index, -1)">
                    上移
                  </el-button>
                  <el-button
                    size="small"
                    :disabled="index === editImages.length - 1"
                    @click="moveImage(index, 1)"
                  >
                    下移
                  </el-button>
                  <el-button size="small" type="danger" plain @click="removeImage(index)">
                    移除
                  </el-button>
                </div>
              </div>
            </div>
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <el-space wrap>
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="savePet">保存修改</el-button>
        </el-space>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-stack {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.import-card,
.query-card,
.result-card {
  border-radius: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
}

.card-header strong {
  color: #21160d;
  font-size: 20px;
}

.card-header p {
  margin: 6px 0 0;
  color: #83715f;
}

.form-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.upload-tip {
  color: #83715f;
  line-height: 1.5;
}

.import-result {
  margin-top: 20px;
}

.import-card :deep(.el-alert__description p) {
  margin: 0 0 8px;
}

.import-card :deep(.el-alert__description p:last-child) {
  margin-bottom: 0;
}

.table-cover {
  width: 66px;
  height: 66px;
  border-radius: 14px;
  background: #f5ede3;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.empty-text,
.cell-text {
  color: #7b6a59;
}

.upload-panel-title {
  font-size: 18px;
  font-weight: 700;
  color: #6d5c4b;
}

.upload-status-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
}

.upload-hint {
  color: #83715f;
  font-size: 13px;
}

.image-queue {
  display: grid;
  gap: 14px;
  margin-top: 18px;
}

.image-card {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 248, 237, 0.84);
  border: 1px solid rgba(107, 79, 44, 0.1);
}

.image-preview {
  width: 104px;
  height: 104px;
  border-radius: 14px;
  overflow: hidden;
  background: #f5ede3;
}

.image-meta {
  min-width: 0;
}

.image-meta-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.image-meta strong {
  color: #21160d;
}

.image-meta p {
  margin: 0;
  color: #7e6c5a;
  line-height: 1.6;
}

.image-url {
  word-break: break-all;
}

.image-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .form-actions,
  .upload-status-row {
    flex-direction: column;
    align-items: stretch;
  }

  .image-card {
    grid-template-columns: 1fr;
  }

  .image-preview {
    width: 100%;
    height: 220px;
  }

  .image-actions {
    justify-content: flex-start;
  }
}
</style>
