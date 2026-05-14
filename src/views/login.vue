<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { extractErrorMessage } from '@/utils/adminForms'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(false)

const loginForm = reactive({
  email: '',
  password: '',
})

const redirectPath = computed(() => String(route.query.redirect || '/dashboard'))

async function submitLogin() {
  loading.value = true
  try {
    await authStore.login({
      email: loginForm.email.trim(),
      password: loginForm.password,
    })

    ElMessage.success('登录成功。')
    router.replace(redirectPath.value)
  } catch (error) {
    ElMessage.error(`登录失败：${extractErrorMessage(error)}`)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div
    class="flex min-h-screen w-full flex-col items-center justify-center gap-4 px-3 py-6 sm:gap-6 sm:px-5 sm:py-8 lg:flex-row lg:gap-12 lg:px-10 xl:px-16">
    <el-image class="w-65 max-w-full shrink-0 rounded-2xl object-contain sm:w-72 lg:w-80 xl:w-96"
      src="login_banner.jpg" />
    <el-card
      class="flex w-full max-w-sm flex-1 rounded-3xl border-0 bg-white/95 p-5 shadow-2xl shadow-stone-900/10 ring-1 ring-stone-200/70 sm:max-w-md sm:p-8 lg:max-w-lg lg:p-10 [&_.el-card__header]:border-b-0 [&_.el-card__header]:pb-2 sm:[&_.el-card__header]:pb-3 [&_.el-card__body]:flex [&_.el-card__body]:min-h-[320px] [&_.el-card__body]:flex-col [&_.el-card__body]:justify-center [&_.el-card__body]:py-2 sm:[&_.el-card__body]:min-h-[360px] lg:[&_.el-card__body]:min-h-[420px]">
      <template #header>
        <h1 class="text-center text-xl font-bold tracking-tight text-stone-900 sm:text-3xl lg:text-[2.15rem]">
          登录
        </h1>
      </template>
      <el-form class="mx-auto w-full max-w-sm" label-position="top" @submit.prevent="submitLogin">
        <el-form-item label="邮箱">
          <el-input v-model="loginForm.email" placeholder="admin@example.com" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="loginForm.password" type="password" show-password placeholder="请输入管理员密码" />
        </el-form-item>
        <el-button type="primary" :loading="loading" class="mt-2! w-full" @click="submitLogin">
          登录后台
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped></style>
