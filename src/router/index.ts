// router/index.ts
import FileManager from '@/components/FileManager.vue'
import TextViewEditView from '@/components/TextViewEditView.vue'
import PasswordEditView from '@/components/PasswordEditView.vue'
import SettingsView from '@/components/SettingsView.vue'
import LoginView from '@/components/LoginView.vue'
import RegisterView from '@/components/RegisterView.vue'
import { createRouter, createWebHistory } from 'vue-router'
import { useSettingsStore } from '@/stores/settingsStore'

const routes = [
    {
        path: '/',
        redirect: '/file/'
    },
    {
        path: '/login',
        name: 'login',
        component: LoginView
    },
    {
        path: '/register',
        name: 'register',
        component: RegisterView
    },
    {
        path: '/file/:path(.*)',  // 捕获所有 /file/ 之后的路径
        name: 'file-manager',
        component: FileManager
    },
    {
        path: '/edit/text/:id',
        name: 'edit-text',
        component: TextViewEditView,
        props: true
    },
    {
        path: '/edit/password/:id',
        name: 'edit-password',
        component: PasswordEditView,
        props: true
    },
    {
        path: '/settings',
        name: 'settings',
        component: SettingsView
    },
    {
        // 兜底：未匹配到任何路由（非法/未知路径）时重定向到首页
        path: '/:pathMatch(.*)*',
        redirect: '/'
    },
]
const router = createRouter({
    history: createWebHistory(),
    routes
})

router.beforeEach((to, from) => {
    const settingsStore = useSettingsStore()
    const isLogin = settingsStore.isLogin()

    // 如果目标是登录页
    if (to.path === '/login' || to.path === '/register') {
        // 已登录则重定向到首页，否则放行
        if (isLogin) {
            return '/'
        }
        return
    }

    // 其他页面：未登录则重定向到登录页
    if (!isLogin) {
        return {
            path: '/login',
            query: { redirect: to.fullPath }
        }
    }

    // 已登录，放行（不返回任何值）
})

export default router