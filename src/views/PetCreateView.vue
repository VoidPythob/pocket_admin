<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createPet, fetchAllResource, getApiBaseUrl, uploadAdminFile } from '@/api'
import PaginatedSelect from '@/components/form/PaginatedSelect.vue'
import { extractErrorMessage, extractListData } from '@/utils/adminForms'

const loading = ref(false)
const lookupLoading = ref(false)
const uploadRef = ref(null)
const imageUploadCount = ref(0)

const lookups = reactive({
  generations: [],
  rances: [],
  features: [],
  skills: [],
})

const form = reactive({
  name: '',
  jp_name: '',
  en_name: '',
  generation_id: '',
  feature_ids: [],
  rance_id: '',
  skill_ids: [],
})

const uploadedImages = ref([])
const imageUploading = computed(() => imageUploadCount.value > 0)

const lookupEndpointMap = {
  generations: '/admin/generations/',
  rances: '/admin/rances/',
  features: '/admin/features/',
  skills: '/admin/skills/',
}

function buildOptionLabel(item) {
  return `#${item.id} ${item.name || item.introduction || item.title || ''}`.trim()
}

async function ensureLookup(key, force = false) {
  if (!force && lookups[key]?.length) {
    return
  }

  lookupLoading.value = true
  try {
    const response = await fetchAllResource(lookupEndpointMap[key])
    lookups[key] = extractListData(response)
  } catch (error) {
    ElMessage.error(`选项加载失败：${extractErrorMessage(error)}`)
  } finally {
    lookupLoading.value = false
  }
}

async function refreshLookups() {
  lookupLoading.value = true
  try {
    const [generations, rances, features, skills] = await Promise.all([
      fetchAllResource(lookupEndpointMap.generations),
      fetchAllResource(lookupEndpointMap.rances),
      fetchAllResource(lookupEndpointMap.features),
      fetchAllResource(lookupEndpointMap.skills),
    ])

    lookups.generations = extractListData(generations)
    lookups.rances = extractListData(rances)
    lookups.features = extractListData(features)
    lookups.skills = extractListData(skills)
  } catch (error) {
    ElMessage.error(`选项加载失败：${extractErrorMessage(error)}`)
  } finally {
    lookupLoading.value = false
  }
}

function resetForm() {
  form.name = ''
  form.jp_name = ''
  form.en_name = ''
  form.generation_id = ''
  form.feature_ids = []
  form.rance_id = ''
  form.skill_ids = []
  uploadedImages.value = []
  uploadRef.value?.clearFiles?.()
}

function buildPreviewUrl(path) {
  if (!path) {
    return ''
  }

  if (/^https?:\/\//.test(path)) {
    return path
  }

  const baseUrl = getApiBaseUrl().replace(/\/+$/, '')
  return path.startsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`
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

async function handleImageUpload(option) {
  imageUploadCount.value += 1

  try {
    const response = await uploadAdminFile(option.file)
    const payload = response?.data

    if (!payload?.url) {
      throw new Error('上传成功但未返回文件地址')
    }

    uploadedImages.value.push({
      uid: option.file.uid,
      file_id: payload.file_id,
      file_name: payload.file_name || option.file.name,
      rawUrl: payload.url,
      previewUrl: buildPreviewUrl(payload.url),
      submitUrl: buildSubmitUrl(payload.url),
      size: payload.size,
    })

    ElMessage.success(`${payload.file_name || option.file.name} 上传成功。`)
    option.onSuccess?.(response)
  } catch (error) {
    ElMessage.error(`图片上传失败：${extractErrorMessage(error)}`)
    option.onError?.(error)
  } finally {
    imageUploadCount.value -= 1
  }
}

function removeImage(index) {
  uploadedImages.value.splice(index, 1)
}

function moveImage(index, offset) {
  const targetIndex = index + offset
  if (targetIndex < 0 || targetIndex >= uploadedImages.value.length) {
    return
  }

  const current = uploadedImages.value[index]
  uploadedImages.value.splice(index, 1)
  uploadedImages.value.splice(targetIndex, 0, current)
}

async function submit() {
  if (!form.generation_id) {
    ElMessage.warning('请选择宠物所属世代。')
    return
  }

  if (!form.rance_id) {
    ElMessage.warning('请选择种族。')
    return
  }

  loading.value = true
  try {
    const response = await createPet({
      name: form.name.trim(),
      jp_name: form.jp_name.trim(),
      en_name: form.en_name.trim(),
      generation_id: Number(form.generation_id),
      icon_urls: uploadedImages.value.map((item) => item.submitUrl),
      feature_ids: form.feature_ids.map(Number),
      rance_id: Number(form.rance_id),
      skill_ids: form.skill_ids.map(Number),
    })

    ElMessage.success(response?.msg || '宠物创建成功。')
    resetForm()
  } catch (error) {
    ElMessage.error(`宠物创建失败：${extractErrorMessage(error)}`)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  ensureLookup('generations')
})
</script>

<template>
  <div class="page-grid">
    <el-card shadow="hover" class="main-card">
      <template #header>
        <div class="card-header">
          <div>
            <strong>创建宠物</strong>
            <p>页面首次进入只加载一次世代数据，其他下拉在第一次展开时再请求。</p>
          </div>
          <el-button :loading="lookupLoading" @click="refreshLookups">刷新选项</el-button>
        </div>
      </template>

      <el-form label-position="top" @submit.prevent="submit">
        <el-row :gutter="18">
          <el-col :xs="24" :md="8">
            <el-form-item label="中文名">
              <el-input v-model="form.name" placeholder="皮卡丘" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="8">
            <el-form-item label="日文名">
              <el-input v-model="form.jp_name" placeholder="ピカチュウ" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="8">
            <el-form-item label="英文名">
              <el-input v-model="form.en_name" placeholder="Pikachu" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="世代">
          <PaginatedSelect
            v-model="form.generation_id"
            :options="lookups.generations"
            placeholder="请选择世代"
            :option-label-fn="buildOptionLabel"
            @visible-change="(visible) => visible && ensureLookup('generations')"
          />
        </el-form-item>

        <el-form-item label="种族">
          <PaginatedSelect
            v-model="form.rance_id"
            :options="lookups.rances"
            placeholder="请选择种族"
            :option-label-fn="buildOptionLabel"
            :search-keys="['name', 'p_id', 'id']"
            @visible-change="(visible) => visible && ensureLookup('rances')"
          />
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
            <div class="el-upload__text">选中文件后会自动上传，并把返回地址加入图片列表</div>
          </el-upload>

          <div class="upload-status-row">
            <el-tag :type="imageUploading ? 'warning' : 'success'">
              {{ imageUploading ? '图片上传中' : `已上传 ${uploadedImages.length} 张` }}
            </el-tag>
            <span class="upload-hint">第一张图片会作为封面图提交给后端。</span>
          </div>

          <div v-if="uploadedImages.length" class="image-queue">
            <div v-for="(item, index) in uploadedImages" :key="item.uid || item.file_id" class="image-card">
              <el-image :src="item.previewUrl" fit="cover" class="image-preview" />

              <div class="image-meta">
                <div class="image-meta-head">
                  <strong>{{ item.file_name }}</strong>
                  <el-tag v-if="index === 0" type="primary">封面</el-tag>
                </div>
                <p>file_id: {{ item.file_id }}</p>
                <p class="image-url">{{ item.submitUrl }}</p>
              </div>

              <div class="image-actions">
                <el-button size="small" :disabled="index === 0" @click="moveImage(index, -1)">上移</el-button>
                <el-button
                  size="small"
                  :disabled="index === uploadedImages.length - 1"
                  @click="moveImage(index, 1)"
                >
                  下移
                </el-button>
                <el-button size="small" type="danger" plain @click="removeImage(index)">移除</el-button>
              </div>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="特性">
          <PaginatedSelect
            v-model="form.feature_ids"
            multiple
            collapse-tags
            collapse-tags-tooltip
            :options="lookups.features"
            placeholder="选择特性"
            :option-label-fn="buildOptionLabel"
            :search-keys="['introduction', 'detail', 'id']"
            @visible-change="(visible) => visible && ensureLookup('features')"
          />
        </el-form-item>

        <el-form-item label="技能">
          <PaginatedSelect
            v-model="form.skill_ids"
            multiple
            collapse-tags
            collapse-tags-tooltip
            :options="lookups.skills"
            placeholder="选择技能"
            :option-label-fn="buildOptionLabel"
            :search-keys="['name', 'introduction', 'id']"
            @visible-change="(visible) => visible && ensureLookup('skills')"
          />
        </el-form-item>

        <el-space wrap>
          <el-button type="primary" :loading="loading" @click="submit">创建宠物</el-button>
          <el-button @click="resetForm">重置表单</el-button>
        </el-space>
      </el-form>
    </el-card>

    <el-card shadow="hover" class="side-card">
      <template #header>
        <strong>使用提示</strong>
      </template>
      <el-timeline>
        <el-timeline-item timestamp="1">创建宠物时必须传入 `generation_id`。</el-timeline-item>
        <el-timeline-item timestamp="2">图片会在选择后自动上传，不需要手动填写 URL。</el-timeline-item>
        <el-timeline-item timestamp="3">图片顺序可调整，第一张会作为封面图。</el-timeline-item>
        <el-timeline-item timestamp="4">其他大选项集会在第一次展开时懒加载。</el-timeline-item>
      </el-timeline>
    </el-card>
  </div>
</template>

<style scoped>
.page-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.6fr);
  gap: 20px;
}

.main-card,
.side-card {
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

@media (max-width: 1080px) {
  .page-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
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
