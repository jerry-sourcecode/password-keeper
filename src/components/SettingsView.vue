<template>
	<div class="settings-page">
		<div class="settings-card">
			<h2 class="settings-title">设置</h2>
			<n-form label-placement="top" class="settings-form">
				<n-form-item label="主密码">
					<n-input
						v-model:value="password"
						type="password"
						show-password-on="click"
						placeholder="请输入主密码" />
				</n-form-item>
				<n-form-item label="确认主密码">
					<n-input
						v-model:value="confirmPassword"
						type="password"
						show-password-on="click"
						placeholder="请再次输入主密码" />
				</n-form-item>
				<n-form-item label="密码提示">
					<n-input
						v-model:value="hint"
						placeholder="请输入密码提示（可选）" />
				</n-form-item>
				<div class="actions">
					<n-button type="error" @click="deleteAccount"
						>删除账号</n-button
					>
					<div class="actions-right">
						<n-button type="primary" @click="save">保存</n-button>
						<n-button @click="cancel">取消</n-button>
					</div>
				</div>
			</n-form>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useSettingsStore } from "@/stores/settingsStore";
import { Crypto } from "@/utils/crypto";
import { API } from "@/utils/api";
import {
	useMessage,
	useDialog,
	NForm,
	NFormItem,
	NInput,
	NButton,
} from "naive-ui";

const router = useRouter();
const settings = useSettingsStore();
const message = useMessage();
const dialog = useDialog();

const password = ref("");
const confirmPassword = ref("");
const hint = ref("");

onMounted(() => {
	hint.value = settings.hint || "";
});

function save() {
	if (!password.value) {
		message.warning("请输入主密码");
		return;
	}
	if (password.value !== confirmPassword.value) {
		message.error("两次输入的主密码不一致");
		return;
	}
	settings.setMasterPassword(password.value);
	settings.setHint(hint.value);
	(settings as any).$persist?.();
	// 同步到后端（用户名、主密码、加密数据、密码提示）
	try {
		Crypto.load();
	} catch (e) {
		console.error("同步到后端失败", e);
	}
	message.success("设置已保存");
	router.push("/file/");
}

function cancel() {
	router.push("/file/");
}

// 删除账号（危险操作，需二次确认）
function deleteAccount() {
	dialog.warning({
		title: "删除账号",
		content:
			"此操作将永久删除你的账号及所有加密数据，且无法恢复。确定继续吗？",
		positiveText: "删除",
		negativeText: "取消",
		async onPositiveClick() {
			try {
				await API.deleteUser(
					settings.username,
					settings.masterPassword,
				);
				message.success("账号已删除");
				settings.logout();
				(settings as any).$persist?.();
				router.push("/login");
			} catch (e: any) {
				message.error(e?.message || "删除失败");
			}
		},
	});
}
</script>

<style scoped>
.settings-page {
	min-height: calc(100vh - 7vh);
	display: flex;
	justify-content: center;
	align-items: flex-start;
	background: #f5f7fa;
	padding: 40px 20px;
}
.settings-card {
	width: 100%;
	max-width: 480px;
	background: #fff;
	border-radius: 8px;
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
	padding: 32px 28px;
}
.settings-title {
	margin: 0 0 24px;
	font-size: 20px;
}
.actions {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-top: 8px;
}
.actions-right {
	display: flex;
	gap: 12px;
}
</style>
