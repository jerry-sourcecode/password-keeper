<template>
	<div v-if="entry" class="edit-page">
		<EditHeader :title="entry?.title" @save="save" @cancel="cancel" />
		<div class="edit-body">
			<div class="edit-card">
				<n-form label-placement="top" class="pwd-form">
					<n-form-item label="网址">
						<n-input-group>
							<n-input
								v-model:value="form.url"
								placeholder="请输入关联网址" />
							<n-button
								type="primary"
								ghost
								:disabled="!form.url"
								@click="openUrl"
								>打开</n-button
							>
						</n-input-group>
					</n-form-item>

					<n-form-item label="用户名">
						<n-input-group>
							<n-input
								v-model:value="form.username"
								placeholder="请输入用户名" />
							<n-button
								type="primary"
								ghost
								@click="copy(form.username)"
								>复制</n-button
							>
						</n-input-group>
					</n-form-item>

					<n-form-item label="密码">
						<n-input-group>
							<n-input
								v-model:value="form.password"
								type="password"
								show-password-on="click"
								placeholder="请输入密码" />
							<n-button
								type="primary"
								ghost
								@click="copy(form.password)"
								>复制</n-button
							>
						</n-input-group>
					</n-form-item>

					<n-form-item label="密码生成器">
						<div class="generator">
							<div class="gen-options">
								<n-input-number
									v-model:value="genLength"
									:min="6"
									:max="64"
									size="small"
									style="width: 90px" />
								<n-checkbox v-model:checked="genNumbers"
									>数字</n-checkbox
								>
								<n-checkbox v-model:checked="genLetters"
									>字母</n-checkbox
								>
								<n-checkbox v-model:checked="genSymbols"
									>符号</n-checkbox
								>
							</div>
							<n-button
								type="primary"
								size="small"
								@click="generate"
								>生成</n-button
							>
						</div>
					</n-form-item>

					<n-form-item label="手机号">
						<n-input
							v-model:value="form.phone"
							placeholder="请输入手机号" />
					</n-form-item>

					<n-form-item label="邮箱">
						<n-input
							v-model:value="form.email"
							placeholder="请输入邮箱" />
					</n-form-item>

					<n-form-item label="备注">
						<n-input
							v-model:value="form.remark"
							type="textarea"
							:autosize="{ minRows: 3, maxRows: 8 }"
							placeholder="请输入备注" />
					</n-form-item>
				</n-form>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useFileStore } from "@/stores/fileStore";
import {
	useMessage,
	NForm,
	NFormItem,
	NInput,
	NButton,
	NInputGroup,
	NInputNumber,
	NCheckbox,
} from "naive-ui";
import { getParentPath } from "@/utils/path";
import { getTxtFileSize } from "@/utils/utils";
import EditHeader from "./EditHeader.vue";

const route = useRoute();
const router = useRouter();
const store = useFileStore();
const message = useMessage();

const id = route.params.id as string;
const entry = ref(store.getEntryById(id));
const form = reactive({
	username: "",
	password: "",
	remark: "",
	phone: "",
	email: "",
	url: "",
});

onMounted(() => {
	if (entry.value) {
		const d = entry.value.data;
		form.username = d.username || "";
		form.password = d.password || "";
		form.remark = d.remark || "";
		form.phone = d.phone || "";
		form.email = d.email || "";
		form.url = d.url || "";
	} else {
		message.error("条目不存在");
		router.push("/file/");
	}
});

// ---------- 密码生成器 ----------
const genLength = ref(12);
const genNumbers = ref(true);
const genLetters = ref(true);
const genSymbols = ref(false);

const CHAR_NUMBERS = "0123456789";
const CHAR_LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CHAR_SYMBOLS = "!@#$%^&*()_+-=[]{};:,.<>?";

function generate() {
	const chars = [
		genNumbers.value ? CHAR_NUMBERS : "",
		genLetters.value ? CHAR_LETTERS : "",
		genSymbols.value ? CHAR_SYMBOLS : "",
	].join("");
	if (!chars) {
		message.warning("请至少选择一种字符类型");
		return;
	}
	let result = "";
	for (let i = 0; i < genLength.value; i++) {
		result += chars[Math.floor(Math.random() * chars.length)];
	}
	form.password = result;
}

// ---------- 复制到剪贴板 ----------
async function copy(text: string) {
	if (!text) {
		message.warning("没有可复制的内容");
		return;
	}
	try {
		await navigator.clipboard.writeText(text);
		message.success("已复制到剪贴板");
	} catch {
		message.error("复制失败");
	}
}

// ---------- 一键跳转网址 ----------
function openUrl() {
	if (!form.url) return;
	let url = form.url.trim();
	if (!/^https?:\/\//i.test(url)) {
		url = "https://" + url;
	}
	window.open(url, "_blank", "noopener,noreferrer");
}

function save() {
	if (!entry.value) return;
	const newData = {
		username: form.username,
		password: form.password,
		remark: form.remark,
		phone: form.phone,
		email: form.email,
		url: form.url,
	};
	// 容量检查：保存后若超出存储上限则阻止
	const newSize = getTxtFileSize(
		newData.username +
			newData.password +
			newData.remark +
			newData.email +
			newData.phone +
			newData.url,
	);
	if (store.wouldExceedLimit(id, newSize)) {
		message.error("存储空间不足，保存失败");
		return;
	}
	store.updateItem(id, {
		title: entry.value.title,
		data: newData,
	});
	// 确保嵌套 data 的修改被立即持久化（updateItem 只改动了 items 内部对象，
	// 依赖 $subscribe 可能因非深监听而漏写 localStorage）
	(store as any).$persist?.();
	message.success("保存成功");
	router.push(`/file${getParentPath(entry.value.path)}`);
}

function cancel() {
	if (entry.value) {
		router.push(`/file${getParentPath(entry.value.path)}`);
	} else {
		router.push("/file/");
	}
}
</script>

<style scoped>
.edit-page {
	height: 93vh;
	display: flex;
	flex-direction: column;
	background: #f5f7fa;
}
.edit-body {
	flex: 1;
	display: flex;
	justify-content: center;
	align-items: flex-start;
	padding: 32px 20px;
	overflow: auto;
}
.edit-card {
	width: 100%;
	max-width: 560px;
	background: #fff;
	border-radius: 8px;
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
	padding: 32px 28px;
}
.generator {
	display: flex;
	align-items: center;
	justify-content: space-between;
	width: 100%;
	gap: 16px;
}
.gen-options {
	display: flex;
	align-items: center;
	gap: 16px;
	flex-wrap: wrap;
}
</style>
