import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
    // 主密码
    const masterPassword = ref('')
    const username = ref('')
    const uid = ref('')
    // 密码提示
    const hint = ref('')

    function setMasterPassword(pwd: string): void {
        masterPassword.value = pwd
    }

    function setUsername(name: string): void {
        username.value = name
    }

    function setHint(text: string): void {
        hint.value = text
    }

    function hasMasterPassword(): boolean {
        return masterPassword.value !== ''
    }

    function isLogin(): boolean {
        return uid.value !== ''
    }

    function logout(): void {
        uid.value = ''
        username.value = ''
        masterPassword.value = ''
        hint.value = ''
    }

    return {
        masterPassword,
        hint,
        username,
        uid,
        setMasterPassword,
        setHint,
        hasMasterPassword,
        setUsername,
        isLogin,
        logout,
    }
}, {
    persist: true,
})
