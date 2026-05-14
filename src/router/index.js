import { createRouter, createWebHistory } from "vue-router";
import { pinia } from "@/stores";
import { useAppStore } from "@/stores/app";
import { useAuthStore } from "@/stores/auth";
import AdminLayout from "@/layouts/AdminLayout.vue";
import AdminRegisterView from "@/views/AdminRegisterView.vue";
import DashboardView from "@/views/DashboardView.vue";
import LoginView from "@/views/login.vue";
import PetCreateView from "@/views/PetCreateView.vue";
import PetRelationsView from "@/views/PetRelationsView.vue";
import PublicPetQueryView from "@/views/PublicPetQueryView.vue";
import ResourceManageView from "@/views/ResourceManageView.vue";

const routes = [
  {
    path: "/login",
    name: "login",
    component: LoginView,
    meta: {
      public: true,
      title: "登录",
      description: "管理员后台登录入口",
    },
  },
  {
    path: "/",
    component: AdminLayout,
    redirect: "/dashboard",
    children: [
      {
        path: "dashboard",
        name: "dashboard",
        component: DashboardView,
        meta: {
          title: "控制台",
          description: "查看后台模块总览与快捷入口",
        },
      },
      {
        path: "admins/register",
        name: "adminRegister",
        component: AdminRegisterView,
        meta: {
          title: "管理员注册",
          description: "在后台内创建新的管理员账号",
        },
      },
      {
        path: "pets/create",
        name: "petCreate",
        component: PetCreateView,
        meta: {
          title: "创建宠物",
          description: "创建宠物及其初始图片、技能、特性和种族关系",
        },
      },
      {
        path: "pets/public-query",
        name: "petManage",
        component: PublicPetQueryView,
        meta: {
          title: "宠物管理",
          description: "按世代、特性、名称筛选宠物，并在表格中管理宠物信息",
        },
      },
      {
        path: "pets/relations",
        name: "petRelations",
        component: PetRelationsView,
        meta: {
          title: "宠物绑定",
          description: "维护宠物与种族、蛋组、世代之间的关系",
        },
      },
      {
        path: "resources/:moduleKey",
        name: "resourceManage",
        component: ResourceManageView,
        props: true,
        meta: {
          title: "资源管理",
          description: "通用的后台基础资料 CRUD 页面",
        },
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const appStore = useAppStore(pinia);
  const authStore = useAuthStore(pinia);

  appStore.init();

  if (to.meta.public) {
    if (to.name === "login") {
      if (to.query.skipSessionCheck === "1") {
        return true;
      }
      const ok = authStore.authenticated || (await authStore.verifySession());
      if (ok) {
        return { name: "dashboard" };
      }
    }
    return true;
  }

  const ok = authStore.authenticated || (await authStore.verifySession());
  if (!ok) {
    return {
      name: "login",
      query: {
        redirect: to.fullPath,
      },
    };
  }

  return true;
});

router.afterEach((to) => {
  if (typeof document === "undefined") {
    return;
  }

  document.title = to.meta?.title
    ? `${to.meta.title} | Pocket Admin`
    : "Pocket Admin";
});

export default router;
