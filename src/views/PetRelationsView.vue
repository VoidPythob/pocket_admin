<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  addPetRelation,
  fetchPetRelations,
  fetchResource,
  removePetRelation,
  replacePetRelation,
  searchPets,
} from '@/api'
import { relationModules } from '@/config/adminModules'
import { extractErrorMessage, extractListData } from '@/utils/adminForms'

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

async function loadLookups() {
  lookupLoading.value = true
  try {
    const [generations, rances, eggGroups] = await Promise.all([
      fetchResource('/admin/generations/'),
      fetchResource('/admin/rances/'),
      fetchResource('/admin/egg-groups/'),
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

async function submitSearch() {
  if (!searchForm.generation_id) {
    ElMessage.warning('请先选择世代。')
    return
  }

  petLoading.value = true
  try {
    const response = await searchPets({
      generation_id: Number(searchForm.generation_id),
      name: searchForm.name.trim() || undefined,
    })

    pets.value = extractListData(response)
    if (!pets.value.length) {
      selectedPetId.value = ''
      currentRelations.value = []
      ElMessage.warning('当前筛选下没有找到宠物。')
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

watch(selectedPetId, () => {
  addTargetId.value = ''
  Object.keys(replacementTargets).forEach((key) => {
    delete replacementTargets[key]
  })
  loadRelations()
})

watch(currentRelationType, () => {
  addTargetId.value = ''
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
            <p>按世代和中文名搜索宠物，然后维护绑定关系。</p>
          </div>
          <el-button :loading="lookupLoading" @click="loadLookups">刷新选项</el-button>
        </div>
      </template>

      <el-row :gutter="18">
        <el-col :xs="24" :md="8">
          <el-form-item label="世代">
            <el-select v-model="searchForm.generation_id" placeholder="请选择世代" clearable filterable>
              <el-option v-for="item in lookups.generations" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :xs="24" :md="10">
          <el-form-item label="宠物中文名">
            <el-input v-model="searchForm.name" placeholder="支持模糊搜索" />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :md="6" class="search-action">
          <el-button type="primary" :loading="petLoading" @click="submitSearch">查询宠物</el-button>
        </el-col>
      </el-row>

      <div class="pet-list" v-loading="petLoading">
        <el-tag
          v-for="item in pets"
          :key="item.id"
          :type="String(item.id) === String(selectedPetId) ? 'primary' : 'info'"
          effect="light"
          class="pet-tag"
          @click="selectedPetId = String(item.id)"
        >
          #{{ item.id }} {{ item.name }}
        </el-tag>
      </div>
    </el-card>

    <el-card shadow="hover" class="relation-card">
      <template #header>
        <div class="card-header">
          <div>
            <strong>{{ selectedPet ? `${selectedPet.name} 的关系管理` : '请先选择宠物' }}</strong>
            <p>支持新增、替换、解除种族 / 蛋组 / 世代关系。</p>
          </div>
        </div>
      </template>

      <el-radio-group v-model="currentRelationType" class="relation-switch">
        <el-radio-button v-for="item in relationModules" :key="item.key" :label="item.key">
          {{ item.label }}
        </el-radio-button>
      </el-radio-group>

      <div class="relation-toolbar">
        <el-select v-model="addTargetId" placeholder="请选择要新增的关系" clearable filterable>
          <el-option v-for="item in currentOptions" :key="item.id" :label="`#${item.id} ${item.name}`" :value="item.id" />
        </el-select>
        <el-button type="primary" @click="addRelation">新增关系</el-button>
      </div>

      <el-table v-loading="loading" :data="currentRelations" empty-text="暂无关系数据" border>
        <el-table-column prop="pet_name" label="宠物" min-width="160" />
        <el-table-column :prop="currentModule?.itemNameKey" :label="currentModule?.label || '关系项'" min-width="220" />
        <el-table-column label="替换目标" min-width="280">
          <template #default="{ row }">
            <el-select
              v-model="replacementTargets[row[currentModule.itemIdKey]]"
              placeholder="选择替换目标"
              clearable
              filterable
            >
              <el-option
                v-for="item in currentOptions"
                :key="item.id"
                :label="`#${item.id} ${item.name}`"
                :value="item.id"
              />
            </el-select>
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
  align-items: start;
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
  align-items: end;
}

.pet-list {
  min-height: 42px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.pet-tag {
  cursor: pointer;
}

.relation-switch {
  margin-bottom: 18px;
}

.relation-toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 18px;
}

.relation-toolbar .el-select {
  width: 320px;
}

@media (max-width: 860px) {
  .relation-toolbar {
    flex-direction: column;
  }

  .relation-toolbar .el-select {
    width: 100%;
  }
}
</style>
