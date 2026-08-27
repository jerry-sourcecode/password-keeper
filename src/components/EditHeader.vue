<template>
	<div class="edit-header">
		<h2>{{ title }}</h2>
		<div>
			<n-button
				type="primary"
				@click="$emit('save')"
				style="margin-right: 10px"
				>保存</n-button
			>
			<n-button @click="$emit('cancel')">取消</n-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { NButton } from "naive-ui";

defineProps<{ title: string }>();
defineEmits<{ save: []; cancel: [] }>();
</script>

<style scoped>
.edit-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 12px 24px;
	border-bottom: 1px solid #e4e7ed;
	flex-shrink: 0;
}
.edit-header h2 {
	margin: 0;
	font-size: 18px;
}
</style>
