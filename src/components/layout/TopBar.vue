<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'

defineProps({
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
})

const router = useRouter()
const appStore = useAppStore()
const authStore = useAuthStore()

const draftBaseUrl = ref(appStore.baseUrl)
const logoutLoading = ref(false)

const authTagType = computed(() => (authStore.authenticated ? 'success' : 'warning'))
const authTagText = computed(() => (authStore.authenticated ? '已登录' : '未登录'))

watch(
  () => appStore.baseUrl,
  (value) => {
    draftBaseUrl.value = value
  },
)

async function applyBaseUrl() {
  appStore.setBaseUrl(draftBaseUrl.value)
  authStore.resetSession()
  const ok = await authStore.verifySession(true)
  if (!ok) {
    router.push('/login')
  }
  ElMessage[ok ? 'success' : 'warning'](
    ok ? '接口地址已更新，并重新验证了当前会话。' : '接口地址已更新，请重新登录。',
  )
}

async function verifySession() {
  const ok = await authStore.verifySession(true)
  if (!ok) {
    router.push('/login')
  }
  ElMessage[ok ? 'success' : 'warning'](
    ok ? '管理员会话有效。' : '当前没有可用的管理员登录会话。',
  )
}

async function handleLogout() {
  logoutLoading.value = true
  try {
    await authStore.logout()
    await router.replace({
      name: 'login',
      query: {
        skipSessionCheck: '1',
      },
    })
    ElMessage.success('已退出登录。')
  } catch (error) {
    ElMessage.error(error.message || '退出登录失败。')
  } finally {
    logoutLoading.value = false
  }
}
</script>

<template>
  <div class="topbar-card">
    <div class="heading">
      <p class="eyebrow">后台页面</p>
      <h2>{{ title }}</h2>
      <p>{{ description }}</p>
    </div>

    <div class="controls">
      <el-input v-model="draftBaseUrl" placeholder="http://127.0.0.1:8080" clearable>
        <template #prepend>API</template>
      </el-input>
      <div class="actions">
        <el-button type="primary" @click="applyBaseUrl">保存地址</el-button>
        <el-button @click="verifySession">验证会话</el-button>
        <el-button type="danger" plain :loading="logoutLoading" @click="handleLogout">
          退出登录
        </el-button>
        <el-tag :type="authTagType">
          {{ authTagText }}
        </el-tag>
      </div>
    </div>
  </div>
</template>

<style scoped>
.topbar-card {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  padding: 22px 24px;
  border-radius: 24px;
  background: rgba(255, 252, 248, 0.88);
  box-shadow: 0 18px 40px rgba(99, 69, 31, 0.1);
}

.heading h2 {
  margin: 0;
  font-size: 28px;
  color: #24170d;
}

.heading p:last-child {
  margin-top: 8px;
  color: #7c6a57;
}

.eyebrow {
  margin: 0 0 8px;
  color: #b6632a;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.controls {
  min-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  align-items: center;
}

@media (max-width: 1080px) {
  .topbar-card {
    flex-direction: column;
  }

  .controls {
    min-width: 0;
  }

  .actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
