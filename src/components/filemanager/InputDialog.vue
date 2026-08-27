<script setup lang="ts">
import { ref } from "vue";
import { NModal, NInput, NButton, useMessage } from "naive-ui";

const props = defineProps<{
	show: boolean;
	title: string;
}>();

const emit = defineEmits<{
	(e: "update:show", value: boolean): void;
	(e: "confirm", name: string): void;
}>();

const message = useMessage();
const inputValue = ref("");

function confirmInput() {
	const name = inputValue.value.trim();
	if (!name) {
		message.warning("名称不能为空");
		return;
	}
	emit("update:show", false);
	emit("confirm", name);
	inputValue.value = "";
}
</script>

<template>
	<n-modal
		:show="show"
		@update:show="emit('update:show', $event)"
		preset="card"
		:title="title"
		style="width: 400px">
		<n-input
			v-model:value="inputValue"
			placeholder="请输入名称"
			clearable
			@keyup.enter="confirmInput" />
		<template #footer>
			<n-button
				@click="emit('update:show', false)"
				style="margin-right: 10px"
				>取消</n-button
			>
			<n-button type="primary" @click="confirmInput">确定</n-button>
		</template>
	</n-modal>
</template>
