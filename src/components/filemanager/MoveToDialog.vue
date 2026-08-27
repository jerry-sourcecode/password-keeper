<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { NModal, NTree, NButton, useMessage } from "naive-ui";
import { useFileStore } from "@/stores/fileStore";
import { getParentPath, getBaseName } from "@/utils/path";

const props = defineProps<{
	show: boolean;
	targetId: string;
}>();

const emit = defineEmits<{
	(e: "update:show", value: boolean): void;
}>();

const fileStore = useFileStore();
const message = useMessage();

const selectedKeys = ref<string[]>([]);
const destination = ref<string | null>(null);

// 每次打开时重置选择
watch(
	() => props.show,
	(v) => {
		if (v) {
			selectedKeys.value = [];
			destination.value = null;
		}
	},
);

// 文件夹树（用于选择移动目标）
const folderTreeData = computed(() => {
	const map: Record<string, any> = {};
	fileStore.folders.forEach((f) => {
		map[f.path] = {
			key: f.path,
			label: f.path === "/" ? "根目录" : getBaseName(f.path),
			children: [],
		};
	});
	const roots: any[] = [];
	fileStore.folders.forEach((f) => {
		if (f.path === "/") {
			roots.push(map[f.path]);
		} else {
			const parent = getParentPath(f.path);
			if (map[parent]) map[parent].children.push(map[f.path]);
			else roots.push(map[f.path]);
		}
	});
	return roots;
});

function onSelectFolder(keys: (string | number)[]) {
	selectedKeys.value = keys as string[];
	destination.value = keys[0] ? String(keys[0]) : null;
}

function confirmMove() {
	const target = destination.value;
	if (!target) {
		message.warning("请选择目标文件夹");
		return;
	}
	const id = props.targetId;
	// 判断是文件还是文件夹（store 格式：文件夹以 / 结尾）
	const path = fileStore.getEntryByPath(id) ? id : id + "/";
	const targetPath = target.endsWith("/") ? target : target + "/";

	// 文件夹不能移动到自身或其子节点下（会造成循环嵌套）
	if (path.endsWith("/") && path !== "/") {
		if (targetPath === path || targetPath.startsWith(path)) {
			message.warning("不能将文件夹移动到自身或其子目录中");
			return;
		}
	}

	const blocked = fileStore.moveEntries([path], targetPath);
	if (blocked.length) {
		message.warning("目标位置已存在同名项目，无法移动");
	} else {
		message.success("移动成功");
	}
	emit("update:show", false);
}
</script>

<template>
	<n-modal
		:show="show"
		@update:show="emit('update:show', $event)"
		preset="card"
		title="移动到"
		style="width: 400px">
		<n-tree
			:data="folderTreeData"
			block-line
			:default-expand-all="true"
			:selected-keys="selectedKeys"
			@update:selected-keys="onSelectFolder" />
		<template #footer>
			<n-button
				@click="emit('update:show', false)"
				style="margin-right: 10px">
				取消
			</n-button>
			<n-button type="primary" @click="confirmMove">确定</n-button>
		</template>
	</n-modal>
</template>
