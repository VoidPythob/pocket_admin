<script setup>
import { computed, onMounted, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { fetchResource } from '@/api'
import { adminModules } from '@/config/adminModules'
import { workspaceRoutes } from '@/config/workspaceRoutes'
import { extractErrorMessage, extractListData } from '@/utils/adminForms'

const router = useRouter()

const loading = reactive({
  stats: false,
})

const stats = reactive({})

const quickRoutes = computed(() => workspaceRoutes.filter((item) => item.path !== '/dashboard'))

async function loadStats() {
  loading.stats = true
  const results = await Promise.allSettled(
    adminModules.map(async (module) => {
      const response = await fetchResource(module.endpoint)
      return {
        key: module.key,
        count: extractListData(response).length,
      }
    }),
  )

  results.forEach((result, index) => {
    const module = adminModules[index]
    if (result.status === 'fulfilled') {
      stats[module.key] = result.value.count
      return
    }

    stats[module.key] = '-'
  })

  if (results.some((item) => item.status === 'rejected')) {
    ElMessage.warning('部分统计加载失败，但后台功能仍可正常使用。')
  }

  loading.stats = false
}

onMounted(async () => {
  try {
    await loadStats()
  } catch (error) {
    ElMessage.error(`统计加载失败：${extractErrorMessage(error)}`)
  }
})
</script>

<template>
  <div class="dashboard-page">
    <el-row :gutter="20">
      <el-col :xs="24" :lg="14">
        <el-card shadow="hover" class="hero-card">
          <p class="eyebrow">后台总览</p>
          <h3>按模块拆分的多页面宠物后台</h3>
          <p class="hero-text">
            当前后台已经按 `router / pinia / axios / element-plus` 结构拆分完成，基础资料统一走通用
            CRUD 页面，宠物创建、公开查询和宠物关系维护也都拆成了独立的 `views` 页面。
          </p>

          <el-space wrap size="large">
            <el-button
              v-for="item in quickRoutes"
              :key="item.path"
              type="primary"
              plain
              @click="router.push(item.path)"
            >
              {{ item.label }}
            </el-button>
          </el-space>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="10">
        <el-card shadow="hover" class="session-card">
          <el-descriptions title="当前后台结构" :column="1" border>
            <el-descriptions-item label="请求层">`src/api/index.js`</el-descriptions-item>
            <el-descriptions-item label="路由">`src/router/index.js`</el-descriptions-item>
            <el-descriptions-item label="状态管理">Pinia</el-descriptions-item>
            <el-descriptions-item label="组件库">Element Plus</el-descriptions-item>
            <el-descriptions-item label="路径别名">@ -> src</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="stat-grid">
      <el-col v-for="module in adminModules" :key="module.key" :xs="24" :sm="12" :xl="8">
        <el-card shadow="hover" class="stat-card" @click="router.push(`/resources/${module.routeKey}`)">
          <div class="stat-head">
            <div>
              <strong>{{ module.label }}</strong>
              <p>{{ module.group }}</p>
            </div>
            <el-tag :type="loading.stats ? 'info' : 'success'">
              {{ loading.stats ? '统计中' : `${stats[module.key] ?? 0} 条` }}
            </el-tag>
          </div>
          <p class="stat-description">{{ module.description }}</p>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.hero-card,
.session-card,
.stat-card {
  border-radius: 24px;
}

.eyebrow {
  margin: 0 0 8px;
  color: #b6632a;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.hero-card h3 {
  margin: 0;
  font-size: 30px;
  color: #21160d;
}

.hero-text {
  margin: 14px 0 22px;
  color: #7a6958;
  line-height: 1.8;
}

.stat-grid {
  margin-top: 0;
}

.stat-card {
  cursor: pointer;
  transition: transform 0.18s ease;
}

.stat-card:hover {
  transform: translateY(-3px);
}

.stat-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: start;
}

.stat-head strong {
  color: #21160d;
  font-size: 18px;
}

.stat-head p {
  margin: 6px 0 0;
  color: #8a7866;
}

.stat-description {
  margin: 16px 0 0;
  color: #6e5f50;
  line-height: 1.7;
}
</style>
