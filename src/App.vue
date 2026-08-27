<script setup lang="ts">
import "@svar-ui/vue-filemanager/all.css"; //import css file from the package
import { NMessageProvider, NPageHeader, NButton } from "naive-ui";
import { useRouter } from "vue-router";
import { onMounted } from "vue";
import { useSettingsStore } from "@/stores/settingsStore";
import { Crypto } from "@/utils/crypto";

const router = useRouter();
const settings = useSettingsStore();

// 每次开启应用时，若已登录则从远程拉取最新数据
onMounted(() => {
	Crypto.pull().catch(() => {});
});

function logout() {
	settings.logout();
	router.push("/login");
}
</script>

<template>
	<n-message-provider>
		<n-page-header class="header">
			<template #title>
				欢迎您，{{ settings.isLogin() ? settings.username : "访客" }}
			</template>
			<template #extra>
				<span>
					<n-button class="btn" @click="router.push('/settings')"
						>设置</n-button
					>
					<n-button @click="router.push('/')" class="btn"
						>文件</n-button
					>
					<n-button class="btn" @click="logout">注销</n-button>
				</span>
			</template>
		</n-page-header>
		<router-view />
	</n-message-provider>
</template>

<style lang="css" scoped>
.header {
	display: flex;
	align-items: center;
	height: 7vh;
	padding: 20px;
}
.header :deep(.n-page-header) {
	flex: 1;
}
.header :deep(.n-page-header__main) {
	flex: 1;
}
.header :deep(.n-page-header__extra) {
	margin-left: auto;
}
.btn {
	margin-right: 10px;
}
</style>
