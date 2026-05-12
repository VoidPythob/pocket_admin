<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  addPetRelation,
  fetchAllResource,
  fetchPetRelations,
  removePetRelation,
  replacePetRelation,
  searchPets,
} from '@/api'
import PaginatedSelect from '@/components/form/PaginatedSelect.vue'
import { relationModules } from '@/config/adminModules'
import { extractErrorMessage, extractListData, extractPagedData } from '@/utils/adminForms'

const PET_PAGE_SIZE = 10
const RELATION_PAGE_SIZE = 8

const loading = ref(false)
const lookupLoading = ref(false)
const petLoading = ref(false)

const lookups = reactive({
  generations: [],
  rances: [],
  eggGroups: [],
})

const searchForm = reactive({
  generation_id: '',
  name: '',
})

const petPagination = reactive({
  page: 1,
  total: 0,
  pageSize: PET_PAGE_SIZE,
})

const relationState = reactive({
  filter: '',
  page: 1,
})

const pets = ref([])
const selectedPetId = ref('')
const currentRelationType = ref('rances')
const currentRelations = ref([])
const addTargetId = ref('')
const replacementTargets = reactive({})

const currentModule = computed(() =>
  relationModules.find((item) => item.key === currentRelationType.value),
)

const selectedPet = computed(
  () => pets.value.find((item) => String(item.id) === String(selectedPetId.value)) || null,
)

const currentOptions = computed(() => {
  if (!currentModule.value) {
    return []
  }

  return lookups[currentModule.value.optionsKey] || []
})

const filteredRelations = computed(() => {
  const keyword = relationState.filter.trim().toLowerCase()
  if (!keyword || !currentModule.value) {
    return currentRelations.value
  }

  return currentRelations.value.filter((item) =>
    String(item[currentModule.value.itemNameKey] ?? '')
      .toLowerCase()
      .includes(keyword),
  )
})

const pagedRelations = computed(() => {
  const start = (relationState.page - 1) * RELATION_PAGE_SIZE
  return filteredRelations.value.slice(start, start + RELATION_PAGE_SIZE)
})

function buildOptionLabel(item) {
  return `#${item.id} ${item.name || item.introduction || item.title || ''}`.trim()
}

async function loadLookups() {
  lookupLoading.value = true
  try {
    const [generations, rances, eggGroups] = await Promise.all([
      fetchAllResource('/admin/generations/'),
      fetchAllResource('/admin/rances/'),
      fetchAllResource('/admin/egg-groups/'),
    ])

    lookups.generations = extractListData(generations)
    lookups.rances = extractListData(rances)
    lookups.eggGroups = extractListData(eggGroups)
  } catch (error) {
    ElMessage.error(`关联选项加载失败：${extractErrorMessage(error)}`)
  } finally {
    lookupLoading.value = false
  }
}

async function submitSearch(page = 1) {
  if (!searchForm.generation_id) {
    ElMessage.warning('请先选择世代。')
    return
  }

  petLoading.value = true
  try {
    const response = await searchPets({
      generation_id: Number(searchForm.generation_id),
      name: searchForm.name.trim() || undefined,
      page,
    })

    const { count, results } = extractPagedData(response)
    pets.value = results
    petPagination.page = page
    petPagination.total = count

    if (!pets.value.length) {
      selectedPetId.value = ''
      currentRelations.value = []
      ElMessage.warning('当前筛选条件下没有找到宠物。')
      return
    }

    if (!pets.value.some((item) => String(item.id) === String(selectedPetId.value))) {
      selectedPetId.value = String(pets.value[0].id)
    }
  } catch (error) {
    ElMessage.error(`宠物查询失败：${extractErrorMessage(error)}`)
  } finally {
    petLoading.value = false
  }
}

async function loadRelations() {
  if (!selectedPet.value || !currentModule.value) {
    currentRelations.value = []
    return
  }

  loading.value = true
  try {
    const response = await fetchPetRelations(selectedPet.value.id, currentModule.value.endpointSegment)
    currentRelations.value = response?.data?.[currentModule.value.collectionKey] || []
    relationState.page = 1
  } catch (error) {
    ElMessage.error(`关系加载失败：${extractErrorMessage(error)}`)
  } finally {
    loading.value = false
  }
}

async function addRelation() {
  if (!selectedPet.value || !currentModule.value || !addTargetId.value) {
    ElMessage.warning('请选择要新增的关系。')
    return
  }

  try {
    const response = await addPetRelation(selectedPet.value.id, currentModule.value.endpointSegment, {
      [currentModule.value.createKey]: Number(addTargetId.value),
    })
    addTargetId.value = ''
    ElMessage.success(response?.msg || '关系新增成功。')
    await loadRelations()
  } catch (error) {
    ElMessage.error(`关系新增失败：${extractErrorMessage(error)}`)
  }
}

async function updateRelation(item) {
  if (!selectedPet.value || !currentModule.value) {
    return
  }

  const currentId = item[currentModule.value.itemIdKey]
  const newId = replacementTargets[currentId]

  if (!newId) {
    ElMessage.warning('请选择替换后的目标关系。')
    return
  }

  try {
    const response = await replacePetRelation(
      selectedPet.value.id,
      currentModule.value.endpointSegment,
      currentId,
      {
        [currentModule.value.replaceKey]: Number(newId),
      },
    )
    ElMessage.success(response?.msg || '关系替换成功。')
    await loadRelations()
  } catch (error) {
    ElMessage.error(`关系替换失败：${extractErrorMessage(error)}`)
  }
}

async function deleteRelation(item) {
  if (!selectedPet.value || !currentModule.value) {
    return
  }

  try {
    const response = await removePetRelation(
      selectedPet.value.id,
      currentModule.value.endpointSegment,
      item[currentModule.value.itemIdKey],
    )
    ElMessage.success(response?.msg || '关系已解除。')
    await loadRelations()
  } catch (error) {
    ElMessage.error(`关系解除失败：${extractErrorMessage(error)}`)
  }
}

watch(
  () => relationState.filter,
  () => {
    relationState.page = 1
  },
)

watch(selectedPetId, () => {
  addTargetId.value = ''
  relationState.filter = ''
  Object.keys(replacementTargets).forEach((key) => {
    delete replacementTargets[key]
  })
  loadRelations()
})

watch(currentRelationType, () => {
  addTargetId.value = ''
  relationState.filter = ''
  Object.keys(replacementTargets).forEach((key) => {
    delete replacementTargets[key]
  })
  loadRelations()
})

onMounted(loadLookups)
</script>

<template>
  <div class="page-stack">
    <el-card shadow="hover" class="filter-card">
      <template #header>
        <div class="card-header">
          <div>
            <strong>宠物筛选</strong>
            <p>先筛选宠物，再维护种族、蛋组和世代关系。宠物列表和下拉都已分页。</p>
          </div>
          <el-button :loading="lookupLoading" @click="loadLookups">刷新选项</el-button>
        </div>
      </template>

      <el-row :gutter="18">
        <el-col :xs="24" :md="8">
          <el-form-item label="世代">
            <PaginatedSelect
              v-model="searchForm.generation_id"
              :options="lookups.generations"
              placeholder="请选择世代"
              :option-label-fn="buildOptionLabel"
            />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :md="10">
          <el-form-item label="宠物中文名">
            <el-input v-model="searchForm.name" placeholder="支持模糊搜索" @keyup.enter="submitSearch(1)" />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :md="6" class="search-action">
          <el-button type="primary" :loading="petLoading" @click="submitSearch(1)">查询宠物</el-button>
        </el-col>
      </el-row>

      <el-table
        v-loading="petLoading"
        :data="pets"
        row-key="id"
        border
        highlight-current-row
        empty-text="暂无符合条件的宠物"
        @current-change="(row) => (selectedPetId = row ? String(row.id) : '')"
      >
        <el-table-column prop="id" label="ID" width="90" />
        <el-table-column prop="name" label="中文名" min-width="160" />
        <el-table-column prop="jp_name" label="日文名" min-width="160" show-overflow-tooltip />
        <el-table-column prop="en_name" label="英文名" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="selectedPetId = String(row.id)">选择</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="petPagination.total > petPagination.pageSize" class="pagination-wrap">
        <el-pagination
          background
          layout="total, prev, pager, next, jumper"
          :total="petPagination.total"
          :page-size="petPagination.pageSize"
          :current-page="petPagination.page"
          @current-change="submitSearch"
        />
      </div>
    </el-card>

    <el-card shadow="hover" class="relation-card">
      <template #header>
        <div class="card-header">
          <div>
            <strong>{{ selectedPet ? `${selectedPet.name} 的关系管理` : '请先选择宠物' }}</strong>
            <p>关系列表支持过滤和分页，新增与替换用分页下拉面板完成。</p>
          </div>
        </div>
      </template>

      <el-radio-group v-model="currentRelationType" class="relation-switch">
        <el-radio-button v-for="item in relationModules" :key="item.key" :label="item.key">
          {{ item.label }}
        </el-radio-button>
      </el-radio-group>

      <div class="relation-toolbar">
        <PaginatedSelect
          v-model="addTargetId"
          :options="currentOptions"
          placeholder="请选择要新增的关系"
          :option-label-fn="buildOptionLabel"
        />
        <el-button type="primary" @click="addRelation">新增关系</el-button>
      </div>

      <el-input
        v-model="relationState.filter"
        clearable
        placeholder="过滤当前关系列表"
        class="relation-filter"
      />

      <el-table v-loading="loading" :data="pagedRelations" row-key="pet_id" empty-text="暂无关系数据" border>
        <el-table-column prop="pet_name" label="宠物" min-width="160" />
        <el-table-column
          :prop="currentModule?.itemNameKey"
          :label="currentModule?.label || '关系项'"
          min-width="220"
        />
        <el-table-column label="替换目标" min-width="320">
          <template #default="{ row }">
            <PaginatedSelect
              v-model="replacementTargets[row[currentModule.itemIdKey]]"
              :options="currentOptions"
              placeholder="选择替换目标"
              :option-label-fn="buildOptionLabel"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="210" fixed="right">
          <template #default="{ row }">
            <el-space wrap>
              <el-button size="small" @click="updateRelation(row)">替换</el-button>
              <el-button size="small" type="danger" plain @click="deleteRelation(row)">解除</el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="filteredRelations.length > RELATION_PAGE_SIZE" class="pagination-wrap">
        <el-pagination
          background
          layout="total, prev, pager, next, jumper"
          :total="filteredRelations.length"
          :page-size="RELATION_PAGE_SIZE"
          :current-page="relationState.page"
          @current-change="relationState.page = $event"
        />
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.page-stack {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.filter-card,
.relation-card {
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

.search-action {
  display: flex;
  align-items: flex-end;
}

.relation-switch {
  margin-bottom: 18px;
}

.relation-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  margin-bottom: 18px;
}

.relation-filter {
  margin-bottom: 18px;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}

@media (max-width: 860px) {
  .relation-toolbar,
  .pagination-wrap {
    grid-template-columns: 1fr;
    flex-direction: column;
  }
}
</style>
