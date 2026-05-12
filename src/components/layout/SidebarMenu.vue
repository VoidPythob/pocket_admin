<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { adminModules } from '@/config/adminModules'
import { workspaceRoutes } from '@/config/workspaceRoutes'

const route = useRoute()

const resourceGroups = computed(() => {
  const groups = new Map()

  adminModules.forEach((module) => {
    if (!groups.has(module.group)) {
      groups.set(module.group, [])
    }
    groups.get(module.group).push(module)
  })

  return Array.from(groups.entries()).map(([title, items]) => ({ title, items }))
})

const activePath = computed(() => route.path)
</script>

<template>
  <div class="sidebar-card">
    <div class="brand">
      <div class="brand-mark">P</div>
      <div>
        <h1>Pocket Admin</h1>
        <p>Element Plus 管理后台</p>
      </div>
    </div>

    <el-scrollbar class="menu-scroll">
      <el-menu :default-active="activePath" router class="menu-panel">
        <el-sub-menu index="workspace">
          <template #title>工作区</template>
          <el-menu-item v-for="item in workspaceRoutes" :key="item.path" :index="item.path">
            {{ item.label }}
          </el-menu-item>
        </el-sub-menu>

        <el-sub-menu v-for="group in resourceGroups" :key="group.title" :index="group.title">
          <template #title>{{ group.title }}</template>
          <el-menu-item
            v-for="item in group.items"
            :key="item.routeKey"
            :index="`/resources/${item.routeKey}`"
          >
            {{ item.label }}
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-scrollbar>
  </div>
</template>

<style scoped>
.sidebar-card {
  height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px 18px;
  border-radius: 28px;
  background: linear-gradient(180deg, #23170f 0%, #17100c 100%);
  box-shadow: 0 24px 60px rgba(53, 35, 17, 0.28);
}

.brand {
  display: flex;
  gap: 14px;
  align-items: center;
  color: #fff7ef;
}

.brand-mark {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: linear-gradient(135deg, #f0a24f 0%, #a0431b 100%);
  font-size: 28px;
  font-weight: 700;
}

.brand h1 {
  margin: 0;
  font-size: 22px;
}

.brand p {
  margin: 4px 0 0;
  color: rgba(255, 240, 225, 0.68);
  font-size: 13px;
}

.menu-scroll {
  flex: 1;
}

:deep(.menu-panel) {
  border-right: 0;
  background: transparent;
}

:deep(.el-menu) {
  background: transparent;
}

:deep(.el-sub-menu__title),
:deep(.el-menu-item) {
  color: rgba(255, 244, 232, 0.74);
  border-radius: 14px;
}

:deep(.el-menu-item.is-active) {
  color: #fff7ee;
  background: rgba(255, 255, 255, 0.1);
}

:deep(.el-sub-menu__title:hover),
:deep(.el-menu-item:hover) {
  background: rgba(255, 255, 255, 0.06);
  color: #fff7ee;
}

@media (max-width: 1080px) {
  .sidebar-card {
    height: auto;
  }
}
</style>
