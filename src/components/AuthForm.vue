<template>
	<div class="auth-page">
		<div class="auth-card">
			<h2 class="auth-title">Password Keeper</h2>
			<p class="auth-sub">
				{{ isRegister ? "创建新账号" : "请输入用户名和密码登录" }}
			</p>
			<n-form label-placement="top" class="auth-form">
				<n-form-item label="用户名">
					<n-input
						v-model:value="username"
						placeholder="请输入用户名" />
				</n-form-item>
				<n-form-item label="密码">
					<n-input
						v-model:value="password"
						type="password"
						show-password-on="click"
						placeholder="请输入密码"
						@keyup.enter="submit" />
				</n-form-item>
				<n-form-item v-if="isRegister" label="邀请码">
					<n-input
						v-model:value="inviteCode"
						placeholder="请输入邀请码"
						@keyup.enter="submit" />
				</n-form-item>
				<n-form-item v-if="isRegister" label="密码提示">
					<n-input
						v-model:value="passwordHint"
						placeholder="请输入密码提示（可选）"
						@keyup.enter="submit" />
				</n-form-item>
				<n-button
					type="primary"
					block
					:loading="loading"
					@click="submit">
					{{ isRegister ? "注册" : "登录" }}
				</n-button>
				<n-button
					block
					@click="router.push('/login')"
					style="margin-top: 10px"
					v-if="isRegister">
					已经有账号？前去登录
				</n-button>
				<n-button
					block
					v-else
					@click="router.push('/register')"
					style="margin-top: 10px">
					还没有账号？前去注册
				</n-button>
			</n-form>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useMessage, NForm, NFormItem, NInput, NButton } from "naive-ui";
import { API, ApiError } from "@/utils/api";
import { Crypto } from "@/utils/crypto";
import { useSettingsStore } from "@/stores/settingsStore";
const props = defineProps<{ mode: "login" | "register" }>();

const router = useRouter();
const route = useRoute();
const message = useMessage();

const isRegister = computed(() => props.mode === "register");

const username = ref("");
const password = ref("");
const inviteCode = ref("");
const passwordHint = ref("");
const loading = ref(false);
const settingStore = useSettingsStore();

// 校验函数：暂时由调用方补充，当前恒返回 true
async function validate(
	username: string,
	password: string,
	inviteCode?: string,
): Promise<boolean> {
	settingStore.setMasterPassword(password);
	settingStore.setUsername(username);
	if (isRegister.value) {
		try {
			const res = await API.registerUser(
				username,
				password,
				inviteCode!,
				passwordHint.value || undefined,
			);
			settingStore.uid = res;
			settingStore.setHint(passwordHint.value);
			message.success("注册成功！");
			router.push("/login");
			return true;
		} catch (err) {
			message.error((err as Error).message);
			return false;
		}
	} else {
		try {
			const res = await Crypto.pull();
			if (res) {
				settingStore.uid = res.uid;
				message.success("登录成功！");
				// 若路由带有 redirect（登录前想访问的页面），登录后跳转回去；否则回首页
				const redirect = (route.query.redirect as string) || "";
				router.push(redirect || "/");
				return true;
			}
			return false;
		} catch (err) {
			// 密码错误时后端会附带主密码提示，一并展示给用户
			if (err instanceof ApiError && err.hint) {
				message.error(`${(err as Error).message}（提示：${err.hint}）`);
			} else {
				message.error((err as Error).message);
			}
			return false;
		}
	}
}

async function submit() {
	if (!username.value || !password.value) {
		message.warning("请输入用户名和密码");
		return;
	}
	if (isRegister.value && !inviteCode.value) {
		message.warning("请输入邀请码");
		return;
	}
	loading.value = true;
	await validate(username.value, password.value, inviteCode.value);
	loading.value = false;
}
</script>

<style scoped>
.auth-page {
	min-height: calc(100vh - 7vh);
	display: flex;
	justify-content: center;
	align-items: center;
	background: #f5f7fa;
	padding: 20px;
}
.auth-card {
	width: 100%;
	max-width: 400px;
	background: #fff;
	border-radius: 8px;
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
	padding: 32px 28px;
}
.auth-title {
	margin: 0 0 4px;
	text-align: center;
	font-size: 22px;
}
.auth-sub {
	margin: 0 0 24px;
	text-align: center;
	color: #909399;
	font-size: 14px;
}
</style>
