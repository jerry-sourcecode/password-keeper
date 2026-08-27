<script setup lang="ts">
import {
	Filemanager,
	getMenuOptions,
	type IApi,
	type IParsedEntity,
	type TContextMenuType,
	type IFileMenuOption,
} from "@svar-ui/vue-filemanager";
import { Willow } from "@svar-ui/vue-filemanager";
import "@svar-ui/vue-filemanager/all.css"; //import css file from the package
import { cn } from "@/locale";
import { Locale } from "@svar-ui/vue-core";
import { useFileStore, MAX_STORAGE } from "@/stores/fileStore";
import { getPathType, getParentPath, joinPath } from "@/utils/path";
import { TYPE_PASSWORD } from "@/models/PasswordEntry";
import { TYPE_TEXT, type TextData, type TextEntry } from "@/models/TextEntry";
import type { EntryType } from "@/models/EntryFactory";
import { useMessage } from "naive-ui";
import MoveToDialog from "./filemanager/MoveToDialog.vue";
import InputDialog from "./filemanager/InputDialog.vue";
import { useRoute, useRouter } from "vue-router";
import { onMounted, watch, computed, ref } from "vue";

const fileStore = useFileStore();
const message = useMessage();
const route = useRoute();
const router = useRouter();
let apiInstance: IApi | null = null;
let isUpdatingFromRouter = false;
let lastSetPath = "";
const rootRef = ref<HTMLElement | null>(null);

// 这是 FileManager 初始化时调用的方法
function init(api: IApi) {
	apiInstance = api;

	// 监听内部路径变化
	api.on("set-path", ({ id }: { id: string }) => {
		if (isUpdatingFromRouter) {
			// 如果是路由触发，则清除标志，不进行路由跳转
			isUpdatingFromRouter = false;
			return;
		}
		// 更新路由：根目录 id 为 "/" → URL /file/；其他文件夹 id 如 /new → URL /file/new/
		const newRoutePath = routePathFor(id);
		if (router.currentRoute.value.path !== newRoutePath) {
			router.push(newRoutePath);
		}
		// 记录当前路径
		lastSetPath = id;
	});

	// 拦截 "create-file" 动作
	api.intercept("create-file", ({ file, parent }) => {
		// 0. 上传文件（file.file 为 File 对象）走上传逻辑
		if ((file as any).file) {
			return handleUpload(file, parent);
		}
		// 1. 获取用户输入的文件名（来自原生弹窗）
		const fileName = file.name;
		const ext = getPathType(fileName);

		// 1.1 检查文件名是否包含斜杠 "/"（文件名中不允许出现路径分隔符）
		if (fileName.includes("/")) {
			message.error(`文件名不能包含 "/"`);
			return false; // 阻止原生添加
		}

		// 2. 构造完整路径（确保 parent 以 / 结尾）
		const fullPath = parent.endsWith("/")
			? parent + fileName
			: parent + "/" + fileName;

		// 3. 检查重名（文件与文件夹同名视为冲突，如 a.txt 与 a.txt/）
		if (fileStore.isNameTaken(fullPath)) {
			message.error(`项目 "${fileName}" 已存在！`);
			return false; // 阻止原生添加
		}

		if (file.type === "folder") {
			fileStore.addFolder(fullPath + "/");
			message.success("添加成功");
			return false;
		}

		// 4. 根据扩展名决定条目类型和默认数据
		let type: EntryType | null = null;
		let defaultData = {};
		switch (ext) {
			case "pwd":
				type = TYPE_PASSWORD;
				defaultData = {
					username: "",
					password: "",
					remark: "",
					phone: "",
					email: "",
					url: "",
				};
				break;
			case "md":
				type = TYPE_TEXT;
				defaultData = { content: "" };
				break;
			default:
				message.error(`不支持的文件类型: ${ext}`);
				return false; // 阻止原生添加
		}

		// 5. 添加条目到 store
		fileStore.addItem({
			path: fullPath,
			title: fileName,
			type: type,
			data: defaultData as any,
		});

		message.success("添加成功");

		// 6. 返回 false 阻止原生添加操作
		return false;
	});
	api.on("open-file", (config) => {
		const id = config.id;
		const entryId = fileStore.getEntryByPath(id)?.id;
		switch (getPathType(id)) {
			case "md":
				router.push(`/edit/text/${entryId}`);
				break;
			case "pwd":
				router.push(`/edit/password/${entryId}`);
				break;
		}
	});

	// 删除文件/文件夹时同步移除 store 中的数据，
	// 否则被删条目仍留在 store 里，数据刷新时会“复活”
	api.intercept("delete-files", ({ ids }) => {
		ids.forEach((id: string) => {
			const entry = fileStore.getEntryByPath(id);
			if (entry) {
				fileStore.deleteItem(entry.id);
				return;
			}
			const folderPath = id.endsWith("/") ? id : id + "/";
			const folder = fileStore.getFolderByPath(folderPath);
			if (folder && folder.path !== "/") {
				fileStore.deleteFolder(folder.id);
			}
		});
		return false; // 已自行处理，阻止 SVAR 原生删除
	});

	// 重命名文件/文件夹时同步到 store
	api.intercept("rename-file", ({ id, name }) => {
		// 1. 新文件名不能包含斜杠
		if (name.includes("/")) {
			message.error(`文件名不能包含 "/"`);
			return false;
		}

		const entry = fileStore.getEntryByPath(id);
		if (entry) {
			// 2. 检查冲突（排除自身）
			const newPath = joinPath(getParentPath(entry.path), name);
			if (newPath !== entry.path && fileStore.isNameTaken(newPath)) {
				message.error(`项目 "${name}" 已存在！`);
				return false;
			}
			fileStore.renameItem(entry.id, name);
		} else {
			const folder = fileStore.getFolderByPath(id + "/");
			if (folder && folder.path !== "/") {
				const newPath = joinPath(getParentPath(folder.path), name);
				if (newPath !== id && fileStore.isNameTaken(newPath)) {
					message.error(`项目 "${name}" 已存在！`);
					return false;
				}
				fileStore.renameFolder(folder.id, name);
			}
		}
		return false;
	});

	// 移动（剪切+粘贴）时同步到 store
	api.intercept("move-files", ({ ids, target }) => {
		const paths = ids.map((id: string) =>
			fileStore.getEntryByPath(id) ? id : id + "/",
		);
		const targetPath = target === "/" ? "/" : target + "/";
		const blocked = fileStore.moveEntries(paths, targetPath);
		if (blocked.length) {
			message.warning(
				`目标位置已存在同名项目，未移动：${blocked.join("、")}`,
			);
		}
		return false;
	});

	// 复制（复制+粘贴）时同步到 store
	api.intercept("copy-files", ({ ids, target }) => {
		const paths = ids.map((id: string) =>
			fileStore.getEntryByPath(id) ? id : id + "/",
		);
		const targetPath = target === "/" ? "/" : target + "/";
		const blocked = fileStore.copyEntries(paths, targetPath);
		if (blocked.length) {
			message.warning(
				`目标位置已存在同名项目，未复制：${blocked.join("、")}`,
			);
		}
		return false;
	});

	// 下载 pwd / md 文件
	api.on("download-file", ({ id }) => {
		const entry = fileStore.getEntryByPath(id);
		if (!entry) return;
		const ext = getPathType(id);
		let content = "";
		if (ext === "md") {
			content = entry.data.content || "";
		} else if (ext === "pwd") {
			content = JSON.stringify(
				{
					username: entry.data.username || "",
					password: entry.data.password || "",
					remark: entry.data.remark || "",
					phone: entry.data.phone || "",
					email: entry.data.email || "",
					url: entry.data.url || "",
				},
				null,
				2,
			);
		} else {
			return;
		}
		// 触发浏览器下载
		const blob = new Blob([content], {
			type: "text/plain;charset=utf-8",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = entry.title;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	});

	start();
}

// 处理上传的 pwd / md 文件
async function handleUpload(file: any, parent: string) {
	const fileName = file.name;
	const ext = getPathType(fileName);

	if (fileName.includes("/")) {
		message.error(`文件名不能包含 "/"`);
		return false;
	}

	const fullPath = parent.endsWith("/")
		? parent + fileName
		: parent + "/" + fileName;

	// 重名检查
	if (fileStore.items.some((item) => item.path === fullPath)) {
		message.error(`文件 "${fileName}" 已存在！`);
		return false;
	}

	// 容量检查：上传文件需在剩余空间内
	const fileSize = file.file.size || 0;
	if (isFull(fileSize)) {
		message.error("存储空间不足，无法上传该文件");
		return false;
	}

	const text = await file.file.text();
	let type: EntryType | null = null;
	let data: Record<string, any> = {};
	switch (ext) {
		case "md":
			type = TYPE_TEXT;
			data = { content: text };
			break;
		case "pwd":
			type = TYPE_PASSWORD;
			try {
				const parsed = JSON.parse(text);
				data = {
					username: parsed.username || "",
					password: parsed.password || "",
					remark: parsed.remark || "",
					phone: parsed.phone || "",
					email: parsed.email || "",
					url: parsed.url || "",
				};
			} catch {
				message.error("pwd 文件格式无效（应为 JSON）");
				return false;
			}
			break;
		default:
			message.error(`不支持的文件类型: ${ext}`);
			return false;
	}

	fileStore.addItem({
		path: fullPath,
		title: fileName,
		type: type!,
		data: data as any,
	});
	message.success("上传成功");
	return false;
}

function getPathFromRoute(): string {
	// 从路由参数还原 SVAR 文件夹 id：根目录为 "/"，其他文件夹去掉末尾斜杠
	// /file/       → "/"
	// /file/new/   → "/new"
	// /file/new/x/ → "/new/x"
	const pathParam = (route.params.path as string) || "";
	if (!pathParam) return "/";
	const svrId = "/" + pathParam.replace(/\/$/, "");
	// 根目录始终存在
	if (svrId === "/") return "/";
	// 若该路径对应的文件夹在 store 中不存在，则回退到根目录
	// （store 中的文件夹路径以 "/" 结尾，如 "/new/"）
	const exists = fileStore.folders.some((f) => f.path === svrId + "/");
	return exists ? svrId : "/";
}

// 文件夹 id → 对应的 URL 路径
// "/"     → "/file/"
// "/new"  → "/file/new/"
function routePathFor(target: string): string {
	return target === "/" ? "/file/" : `/file${target}/`;
}

const start = async () => {
	// 直接刷新页面时，路由的初始导航尚未完成，此时 route.params 还是空的（START_LOCATION），
	// 必须先等待 router.isReady()，才能读到真实的 URL 参数
	await router.isReady();

	const initialPath = getPathFromRoute();
	if (initialPath) {
		lastSetPath = initialPath;
		// 仅当 URL 已是对应路径时才只做内部导航；
		// 若该路径不存在（回退到 "/"），则让 set-path 处理回写正确的 URL
		if (router.currentRoute.value.path === routePathFor(initialPath)) {
			isUpdatingFromRouter = true;
		}
		apiInstance!.exec("set-path", { id: initialPath });
	}

	watch(
		() => route.params.path,
		() => {
			// 仅在文件管理路由下处理，避免进入编辑页等其它路由时误触发
			if (route.name !== "file-manager") return;
			const targetPath = getPathFromRoute();
			if (targetPath === lastSetPath) return; // 避免重复
			lastSetPath = targetPath;
			if (router.currentRoute.value.path === routePathFor(targetPath)) {
				isUpdatingFromRouter = true;
			}
			apiInstance!.exec("set-path", { id: targetPath });
		},
	);
};

// 在 FileManagerView.vue 中定义
function showExtraInfo(file: IParsedEntity) {
	// 1. 如果是特殊状态（搜索/多选），不显示
	if (
		typeof file === "object" &&
		file.type &&
		["search", "multiple", "none"].includes(file.type)
	) {
		return null;
	}

	const base = {
		文件路径: file.id,
		创建时间: new Date(file.date!).toLocaleString(),
	};

	// 2. 如果是文件夹，可以显示子项数量
	if (file.type === "folder") {
		// 统计该文件夹下的条目数量（包括子文件夹）
		return {
			...base,
		} as any;
	}

	// 3. 根据扩展名显示不同信息
	const ext = file.ext || "";
	// 从 store 中获取该条目的完整数据（包含 data 字段）
	const entry = fileStore.getEntryByPath(file.id);
	if (!entry) return null;

	let data = entry.data;

	if (ext === "pwd") {
		return {
			...base,
			网址: data.url || "无",
			用户名: data.username || "未设置",
		};
	}

	if (ext === "md") {
		data = data as TextData;
		const contentLength = (data.content || "").length;
		return {
			...base,
			内容预览:
				contentLength > 50
					? data.content.slice(0, 50) + "..."
					: data.content,
		};
	}

	// 4. 未知类型返回 null（显示默认信息）
	return null;
}

// 存储用量：used 为所有条目大小总和
// 注意：SVAR 的 Drive 组件用 `used && total` 判断是否渲染，
// used 为 0（空存储）时是 falsy，会导致进度条不显示，因此最小给到 1
const drive = computed(() => ({
	used: fileStore.totalSize,
	total: MAX_STORAGE,
}));

// 是否已达到容量上限（extraBytes 为本次预计新增的字节数）
function isFull(extraBytes = 0): boolean {
	return fileStore.totalSize + extraBytes >= MAX_STORAGE;
}

// 修复 SVAR 搜索模式点击“非子后代项”无法跳转的问题：
// SVAR 在双击时会先清空搜索，再用“当前目录”的 _files 查找被点击项，
// 非子后代项不在当前目录中 → 查找失败 → 不触发 open-file/set-path。
// 这里在捕获阶段自行解析并导航。
onMounted(() => {
	const container = rootRef.value;
	if (!container) return;
	container.addEventListener(
		"dblclick",
		(e) => {
			// 仅处理搜索模式
			if (!container.querySelector(".wx-search")) return;
			const target = e.target as HTMLElement;
			const el = target.closest?.("[data-id]");
			if (!el) return;
			const id = (el.getAttribute("data-id") || "").replace(/^:/, "");
			if (!id || id === "body" || id === "/wx-filemanager-parent-link")
				return;

			const entry = fileStore.getEntryByPath(id);
			if (entry) {
				e.preventDefault();
				e.stopPropagation();
				const t = getPathType(id);
				if (t === "md") router.push(`/edit/text/${entry.id}`);
				else if (t === "pwd") router.push(`/edit/password/${entry.id}`);
				return;
			}
			const folder = fileStore.getFolderByPath(
				id.endsWith("/") ? id : id + "/",
			);
			if (folder && folder.path !== "/") {
				e.preventDefault();
				e.stopPropagation();
				router.push(routePathFor(folder.path.replace(/\/$/, "")));
			}
		},
		true, // 捕获阶段，先于 SVAR 处理，避免其先清空搜索
	);
});

function menuOptions(mode: TContextMenuType): IFileMenuOption[] {
	switch (mode) {
		case "body": {
			const defaultOptions = getMenuOptions(mode) as any;
			return [
				...defaultOptions,
				{
					text: "添加文件",
					id: "add-file",
					hotkey: "Ctrl+Shift+A",
					handler: () => {
						openInputDialog("添加文件", (fileName) => {
							// 由 create-file 拦截器统一校验并写入 store
							apiInstance!.exec("create-file", {
								parent: getCurrentPath(),
								file: { name: fileName },
							});
						});
					},
				},
				{
					text: "添加文件夹",
					id: "add-folder",
					hotkey: "Ctrl+Alt+A",
					handler: () => {
						openInputDialog("添加文件夹", (folderName) => {
							// type 为 folder 时，create-file 拦截器会调用 addFolder
							apiInstance!.exec("create-file", {
								parent: getCurrentPath(),
								file: { name: folderName, type: "folder" },
							});
						});
					},
				},
			];
		}
		case "file":
		case "folder": {
			// 获取默认菜单项
			const defaultOptions = getMenuOptions(mode);
			// 添加分隔符和自定义菜单
			return [
				...defaultOptions,
				{ type: "separator" } as any,
				{
					text: "复制路径",
					id: "copy-path",
					hotkey: "Ctrl+Shift+C",
					handler: ({ context }: { context: any }) => {
						if (context?.id) {
							navigator.clipboard
								.writeText(context.id)
								.then(() => message.success("路径已复制"))
								.catch(() => message.error("复制失败"));
						}
					},
				},
				{
					text: "移动到……",
					id: "move-to",
					hotkey: "Ctrl+Shift+M",
					handler: ({ context }: { context: any }) => {
						openMoveDialog(context);
					},
				},
			];
		}
		default:
			return getMenuOptions(mode) as IFileMenuOption[];
	}
}

// ---------- “移动到” 对话框 ----------
const moveDialogVisible = ref(false);
const moveTargetId = ref("");

function openMoveDialog(context: any) {
	moveTargetId.value = context.id;
	moveDialogVisible.value = true;
}

// 获取当前面板所在路径（SVAR 路径：根目录为 "/"，其余无末尾斜杠）
function getCurrentPath(): string {
	const { panels, activePanel } = apiInstance!.getState();
	return panels![activePanel!]!.path!;
}

// ---------- 通用输入对话框 ----------
const inputVisible = ref(false);
const inputTitle = ref("");
let inputCallback: ((name: string) => void) | null = null;

function openInputDialog(title: string, cb: (name: string) => void) {
	inputTitle.value = title;
	inputCallback = cb;
	inputVisible.value = true;
}

function handleInputConfirm(name: string) {
	inputVisible.value = false;
	inputCallback?.(name);
	inputCallback = null;
}
</script>

<template>
	<div ref="rootRef" class="filemanager-root">
		<Willow>
			<Locale :words="cn">
				<Filemanager
					:init="init"
					:extra-info="showExtraInfo"
					:drive
					:menu-options="menuOptions"
					:data="fileStore.fileManagerData" />
			</Locale>
		</Willow>

		<!-- 移动到：选择目标文件夹 -->
		<move-to-dialog
			:show="moveDialogVisible"
			:target-id="moveTargetId"
			@update:show="moveDialogVisible = $event" />

		<!-- 添加文件 / 添加文件夹：输入名称 -->
		<input-dialog
			:show="inputVisible"
			:title="inputTitle"
			@update:show="inputVisible = $event"
			@confirm="handleInputConfirm" />
	</div>
</template>

<style lang="css" scoped>
.filemanager-root {
	height: 100%;
}
</style>
