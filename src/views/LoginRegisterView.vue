<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { extractErrorMessage } from '@/utils/adminForms'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const authStore = useAuthStore()

const loading = ref(false)

const loginForm = reactive({
  email: '',
  password: '',
})

async function submitLogin() {
  loading.value = true
  try {
    await authStore.login({
      email: loginForm.email.trim(),
      password: loginForm.password,
    })
    ElMessage.success('登录成功。')
    const redirect = route.query.redirect || '/dashboard'
    router.replace(String(redirect))
  } catch (error) {
    ElMessage.error(`登录失败：${extractErrorMessage(error)}`)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-shell">
      <section class="hero-panel">
        <p class="eyebrow">Pocket Admin</p>
        <h1>登录后进入管理员后台</h1>
        <p class="hero-copy">
          当前后台使用 `router + pinia + axios + element-plus` 结构。未登录访问后台页面时，会自动跳回当前登录页。
        </p>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="接口地址">{{ appStore.baseUrl }}</el-descriptions-item>
          <el-descriptions-item label="鉴权方式">Session Cookie + CSRF</el-descriptions-item>
          <el-descriptions-item label="默认入口">/dashboard</el-descriptions-item>
        </el-descriptions>
      </section>

      <el-card shadow="hover" class="form-panel">
        <template #header>
          <div class="panel-header">
            <strong>管理员登录</strong>
            <p>注册入口已经移动到后台管理面板中。</p>
          </div>
        </template>

        <el-form label-position="top" @submit.prevent="submitLogin">
          <el-form-item label="邮箱">
            <el-input v-model="loginForm.email" placeholder="admin@example.com" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input
              v-model="loginForm.password"
              type="password"
              show-password
              placeholder="请输入管理员密码"
            />
          </el-form-item>
          <el-button type="primary" :loading="loading" class="submit-button" @click="submitLogin">
            登录后台
          </el-button>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 20px;
}

.login-shell {
  width: min(1120px, 100%);
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 24px;
}

.hero-panel {
  padding: 36px;
  border-radius: 28px;
  background: linear-gradient(135deg, rgba(255, 248, 240, 0.96) 0%, rgba(246, 235, 219, 0.96) 100%);
  box-shadow: 0 22px 54px rgba(96, 67, 30, 0.12);
}

.eyebrow {
  margin: 0 0 10px;
  color: #b6632a;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.hero-panel h1 {
  margin: 0;
  font-size: 40px;
  line-height: 1.1;
  color: #21160d;
}

.hero-copy {
  margin: 18px 0 28px;
  color: #796855;
  line-height: 1.8;
}

.form-panel {
  border-radius: 28px;
}

.panel-header strong {
  color: #21160d;
  font-size: 20px;
}

.panel-header p {
  margin: 6px 0 0;
  color: #7c6a57;
}

.submit-button {
  width: 100%;
}

@media (max-width: 920px) {
  .login-shell {
    grid-template-columns: 1fr;
  }

  .hero-panel {
    padding: 24px;
  }

  .hero-panel h1 {
    font-size: 30px;
  }
}
</style>
