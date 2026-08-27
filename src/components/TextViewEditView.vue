<template>
	<div v-if="entry" class="edit-page">
		<EditHeader :title="entry?.title" @save="save" @cancel="cancel" />
		<div class="edit-body">
			<MdEditor
				v-model="content"
				:toolbars="toolbars"
				:language="'zh-CN'"
				preview-theme="default"
				code-theme="github"
				@on-save="save" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useFileStore } from "@/stores/fileStore";
import { useMessage } from "naive-ui";
import { MdEditor, type ToolbarNames } from "md-editor-v3";
import "md-editor-v3/lib/style.css";
import { getParentPath } from "@/utils/path";
import { getTxtFileSize } from "@/utils/utils";
import EditHeader from "./EditHeader.vue";

const route = useRoute();
const router = useRouter();
const store = useFileStore();
const message = useMessage();

const id = route.params.id as string;
const entry = ref(store.getEntryById(id));
const content = ref("");

onMounted(() => {
	if (entry.value) {
		content.value = entry.value.data.content || "";
	} else {
		message.error("条目不存在");
		router.push("/");
	}
});

// 工具栏配置（可根据需要增减）
const toolbars: ToolbarNames[] = [
	"bold",
	"italic",
	"strikeThrough",
	"title",
	"underline",
	"quote",
	"unorderedList",
	"orderedList",
	"codeRow",
	"code",
	"link",
	"image",
	"table",
	"preview",
	"catalog",
	"save",
	"fullscreen",
];

function save() {
	if (!entry.value) return;
	// 容量检查：保存后若超出存储上限则阻止
	if (store.wouldExceedLimit(id, getTxtFileSize(content.value))) {
		message.error("存储空间不足，保存失败");
		return;
	}
	store.updateItem(id, {
		title: entry.value.title,
		data: {
			content: content.value,
		},
	});
	// 确保嵌套 data 的修改被立即持久化
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
}
.edit-body {
	flex: 1;
	overflow: hidden;
}
/* md-editor-v3 默认高度 100% 需要父容器有明确高度 */
.edit-body :deep(.md-editor) {
	height: 100%;
}
</style>
