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
					<div class="actions-left">
						<n-button @click="downloadBackup">下载备份</n-button>
						<n-button @click="importBackup">导入备份</n-button>
						<n-button type="error" @click="deleteAccount"
							>删除账号</n-button
						>
					</div>
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
import { useFileStore } from "@/stores/fileStore";
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
	const ori = settings.masterPassword;
	settings.setMasterPassword(password.value);
	settings.setHint(hint.value);
	(settings as any).$persist?.();
	// 同步到后端（用户名、主密码、加密数据、密码提示）
	try {
		API.changePassword(
			settings.username,
			ori,
			settings.masterPassword,
			settings.hint,
		).then(() => {
			Crypto.push();
		});
	} catch (e) {
		console.error("同步到后端失败", e);
	}
	message.success("设置已保存");
	router.push("/file/");
}

function cancel() {
	router.push("/file/");
}

// 下载整个用户数据的备份文件（.umc，内容为加密后的数据）
function downloadBackup() {
	try {
		const encrypted = Crypto.stringify(settings.masterPassword);
		const payload = JSON.stringify(
			{
				app: "password-keeper",
				version: "2.0",
				username: settings.username,
				createdAt: Date.now(),
				data: encrypted,
			},
			null,
			2,
		);
		const blob = new Blob([payload], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `password-keeper-${settings.username || "backup"}.umc`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		message.success("备份已下载");
	} catch (e) {
		console.error("导出失败", e);
		message.error("导出失败");
	}
}

// 导入 .umc 备份，覆盖当前数据
function importBackup() {
	if (!settings.masterPassword) {
		message.warning("未设置主密码，无法导入");
		return;
	}
	const input = document.createElement("input");
	input.type = "file";
	input.accept = ".umc";
	input.onchange = async () => {
		const file = (input.files || [])[0];
		if (!file) return;
		try {
			const text = await file.text();
			const parsed = JSON.parse(text);
			if (parsed.app !== "password-keeper" || !parsed.data) {
				message.error("无效的 umc 备份文件");
				return;
			}
			// 用户名校验：备份所属账号必须与当前登录账号一致，否则禁止加载
			if (parsed.username && parsed.username !== settings.username) {
				message.error(
					`备份属于账号 "${parsed.username}"，与当前账号 "${settings.username}" 不一致，已禁止加载`,
				);
				return;
			}
			const ok = Crypto.restore(parsed.data, settings.masterPassword);
			if (!ok) {
				message.error("导入失败：主密码不匹配或文件损坏");
				return;
			}
			const fs = useFileStore();
			(fs as any).$persist?.();
			Crypto.push();
			message.success("导入成功");
		} catch (err) {
			console.error("导入失败", err);
			message.error("导入失败：文件格式错误");
		}
	};
	input.click();
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
.actions-left {
	display: flex;
	gap: 12px;
}
.actions-right {
	display: flex;
	gap: 12px;
}
</style>
