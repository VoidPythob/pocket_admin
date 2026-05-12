<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import SidebarMenu from '@/components/layout/SidebarMenu.vue'
import TopBar from '@/components/layout/TopBar.vue'

const route = useRoute()

const pageTitle = computed(() => route.meta?.title || '后台')
const pageDescription = computed(() => route.meta?.description || '')
</script>

<template>
  <div class="admin-layout">
    <aside class="layout-aside">
      <SidebarMenu />
    </aside>

    <section class="layout-main">
      <TopBar :title="pageTitle" :description="pageDescription" />
      <div class="page-body">
        <router-view />
      </div>
    </section>
  </div>
</template>

<style scoped>
.admin-layout {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 20px;
  padding: 20px;
}

.layout-aside {
  min-width: 0;
}

.layout-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-body {
  min-width: 0;
}

@media (max-width: 1080px) {
  .admin-layout {
    grid-template-columns: 1fr;
    padding: 14px;
  }
}
</style>
