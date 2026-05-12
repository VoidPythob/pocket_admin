<script setup>
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { extractErrorMessage } from '@/utils/adminForms'

const authStore = useAuthStore()
const loading = ref(false)

const form = reactive({
  email: '',
  password: '',
  password_confirm: '',
})

function resetForm() {
  form.email = ''
  form.password = ''
  form.password_confirm = ''
}

async function submitRegister() {
  loading.value = true
  try {
    await authStore.register({
      email: form.email.trim(),
      password: form.password,
      password_confirm: form.password_confirm,
    })
    ElMessage.success('管理员账号创建成功。')
    resetForm()
  } catch (error) {
    ElMessage.error(`管理员注册失败：${extractErrorMessage(error)}`)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page-grid">
    <el-card shadow="hover" class="main-card">
      <template #header>
        <div class="card-header">
          <div>
            <strong>管理员注册</strong>
            <p>在已登录的后台内创建新的管理员账号。</p>
          </div>
        </div>
      </template>

      <el-form label-position="top" @submit.prevent="submitRegister">
        <el-form-item label="邮箱">
          <el-input v-model="form.email" placeholder="new-admin@example.com" />
        </el-form-item>

        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="请输入管理员密码"
          />
        </el-form-item>

        <el-form-item label="确认密码">
          <el-input
            v-model="form.password_confirm"
            type="password"
            show-password
            placeholder="再次输入密码"
          />
        </el-form-item>

        <el-space wrap>
          <el-button type="primary" :loading="loading" @click="submitRegister">
            创建管理员
          </el-button>
          <el-button @click="resetForm">清空表单</el-button>
        </el-space>
      </el-form>
    </el-card>

    <el-card shadow="hover" class="side-card">
      <template #header>
        <strong>使用说明</strong>
      </template>

      <el-timeline>
        <el-timeline-item timestamp="1">
          这个页面只在管理员后台内可见，未登录用户不能直接访问。
        </el-timeline-item>
        <el-timeline-item timestamp="2">
          注册接口继续使用 `POST /admin/register/`，只是入口从公共页移动到了后台。
        </el-timeline-item>
        <el-timeline-item timestamp="3">
          创建成功后不会替换当前登录会话，当前管理员仍保持登录状态。
        </el-timeline-item>
      </el-timeline>
    </el-card>
  </div>
</template>

<style scoped>
.page-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 0.72fr);
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

@media (max-width: 1080px) {
  .page-grid {
    grid-template-columns: 1fr;
  }
}
</style>
