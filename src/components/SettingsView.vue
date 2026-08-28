<template>
	<div class="settings-page">
		<div class="settings-card">
			<h2 class="settings-title">设置</h2>
			<n-tabs type="line" animated>
				<n-tab-pane name="general" tab="通用设置">
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
								<n-button @click="downloadBackup"
									>下载备份</n-button
								>
								<n-button @click="importBackup"
									>导入备份</n-button
								>
								<n-button type="error" @click="deleteAccount"
									>删除账号</n-button
								>
							</div>
							<div class="actions-right">
								<n-button type="primary" @click="save"
									>保存</n-button
								>
								<n-button @click="cancel">取消</n-button>
							</div>
						</div>
					</n-form>
				</n-tab-pane>
				<n-tab-pane v-if="isAdmin" name="invite" tab="邀请码管理">
					<n-form label-placement="top" class="settings-form">
						<n-form-item label="管理员密钥">
							<n-input
								v-model:value="adminKey"
								type="password"
								show-password-on="click"
								placeholder="请输入管理员密钥" />
						</n-form-item>
						<div class="invite-actions">
							<n-button
								:loading="inviteLoading"
								@click="queryInvites"
								>查询邀请码</n-button
							>
							<n-button
								type="primary"
								:loading="inviteLoading"
								@click="generateInvite">
								生成邀请码
							</n-button>
						</div>
						<div v-if="invites.length" class="invite-list">
							<n-list bordered>
								<n-list-item
									v-for="code in invites"
									:key="code">
									<n-text code>{{ code }}</n-text>
									<template #suffix>
										<n-button
											size="small"
											quaternary
											@click="copyInvite(code)"
											>复制</n-button
										>
										<n-button
											size="small"
											type="error"
											@click="removeInvite(code)"
											>删除</n-button
										>
									</template>
								</n-list-item>
							</n-list>
						</div>
						<p v-else class="invite-empty">
							暂无邀请码，点击“查询邀请码”加载列表
						</p>
					</n-form>
				</n-tab-pane>
			</n-tabs>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
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
	NTabs,
	NTabPane,
	NList,
	NListItem,
	NText,
} from "naive-ui";

const router = useRouter();
const settings = useSettingsStore();
const message = useMessage();
const dialog = useDialog();

const password = ref("");
const confirmPassword = ref("");
const hint = ref("");
const adminKey = ref("");
const invites = ref<string[]>([]);
const inviteLoading = ref(false);
const isAdmin = computed(() => settings.username === "admin");

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

// ---------- 邀请码管理（仅 admin 账号可见） ----------
async function requireAdminKey(): Promise<boolean> {
	if (!adminKey.value) {
		message.warning("请输入管理员密钥");
		return false;
	}
	return true;
}

async function queryInvites() {
	if (!(await requireAdminKey())) return;
	inviteLoading.value = true;
	try {
		invites.value = await API.listInvites(adminKey.value);
		message.success(`查询成功，当前共有 ${invites.value.length} 个邀请码`);
	} catch (e: any) {
		message.error(e?.message || "查询邀请码失败");
	} finally {
		inviteLoading.value = false;
	}
}

async function generateInvite() {
	if (!(await requireAdminKey())) return;
	inviteLoading.value = true;
	try {
		const code = await API.generateInvite(adminKey.value);
		message.success(`邀请码已生成：${code}`);
		// 生成后刷新列表
		invites.value = await API.listInvites(adminKey.value);
	} catch (e: any) {
		message.error(e?.message || "生成邀请码失败");
	} finally {
		inviteLoading.value = false;
	}
}

function removeInvite(code: string) {
	dialog.warning({
		title: "删除邀请码",
		content: `确定删除邀请码 ${code} 吗？删除后该邀请码将无法用于注册。生效可能需要 1 分钟。`,
		positiveText: "删除",
		negativeText: "取消",
		async onPositiveClick() {
			try {
				await API.deleteInvite(adminKey.value, code);
				message.success("邀请码已删除");
				invites.value = invites.value.filter((c) => c !== code);
			} catch (e: any) {
				message.error(e?.message || "删除邀请码失败");
			}
		},
	});
}

async function copyInvite(code: string) {
	await navigator.clipboard.writeText(code);
	message.success("邀请码已复制");
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
.invite-actions {
	display: flex;
	gap: 12px;
	margin-top: 8px;
}
.invite-list {
	margin-top: 16px;
}
.invite-empty {
	margin: 16px 0 0;
	color: #909399;
	font-size: 13px;
}
</style>
