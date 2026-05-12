<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: [String, Number, Array],
    default: '',
  },
  options: {
    type: Array,
    default: () => [],
  },
  placeholder: {
    type: String,
    default: '请选择',
  },
  multiple: {
    type: Boolean,
    default: false,
  },
  clearable: {
    type: Boolean,
    default: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  collapseTags: {
    type: Boolean,
    default: false,
  },
  collapseTagsTooltip: {
    type: Boolean,
    default: false,
  },
  pageSize: {
    type: Number,
    default: 8,
  },
  optionValueKey: {
    type: String,
    default: 'id',
  },
  optionLabelKey: {
    type: String,
    default: 'name',
  },
  optionLabelFn: {
    type: Function,
    default: null,
  },
  searchKeys: {
    type: Array,
    default: () => ['name', 'title', 'introduction', 'detail', 'id'],
  },
})

const emit = defineEmits(['update:modelValue', 'change'])

const currentPage = ref(1)
const keyword = ref('')

function getOptionValue(option) {
  return option?.[props.optionValueKey]
}

function getOptionLabel(option) {
  if (props.optionLabelFn) {
    return props.optionLabelFn(option)
  }

  return option?.[props.optionLabelKey] ?? option?.name ?? option?.id ?? ''
}

const normalizedSelectedValues = computed(() => {
  if (props.multiple) {
    return Array.isArray(props.modelValue) ? props.modelValue.map((item) => String(item)) : []
  }

  if (props.modelValue === '' || props.modelValue === null || props.modelValue === undefined) {
    return []
  }

  return [String(props.modelValue)]
})

const filteredOptions = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  if (!query) {
    return props.options
  }

  return props.options.filter((option) => {
    const searchText = [
      getOptionLabel(option),
      ...props.searchKeys.map((key) => option?.[key]),
    ]
      .filter((item) => item !== null && item !== undefined)
      .join(' ')
      .toLowerCase()

    return searchText.includes(query)
  })
})

const total = computed(() => filteredOptions.value.length)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / props.pageSize)))

const selectedOptions = computed(() => {
  const optionMap = new Map(
    props.options.map((option) => [String(getOptionValue(option)), option]),
  )

  return normalizedSelectedValues.value.map((value) => optionMap.get(value)).filter(Boolean)
})

const pagedOptions = computed(() => {
  const start = (currentPage.value - 1) * props.pageSize
  const end = start + props.pageSize
  return filteredOptions.value.slice(start, end)
})

const visibleOptions = computed(() => {
  const optionMap = new Map()

  selectedOptions.value.forEach((option) => {
    optionMap.set(String(getOptionValue(option)), option)
  })

  pagedOptions.value.forEach((option) => {
    optionMap.set(String(getOptionValue(option)), option)
  })

  return Array.from(optionMap.values())
})

watch(
  total,
  () => {
    if (currentPage.value > pageCount.value) {
      currentPage.value = pageCount.value
    }
  },
  { immediate: true },
)

watch(keyword, () => {
  currentPage.value = 1
})

function handleKeywordChange(value) {
  keyword.value = value
}

function handleVisibleChange(visible) {
  if (!visible) {
    keyword.value = ''
    currentPage.value = 1
  }
}

function updateValue(value) {
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<template>
  <el-select
    :model-value="modelValue"
    :multiple="multiple"
    :clearable="clearable"
    :disabled="disabled"
    :placeholder="placeholder"
    :collapse-tags="collapseTags"
    :collapse-tags-tooltip="collapseTagsTooltip"
    filterable
    remote
    reserve-keyword
    class="paginated-select"
    :remote-method="handleKeywordChange"
    @update:model-value="updateValue"
    @visible-change="handleVisibleChange"
  >
    <el-option
      v-for="option in visibleOptions"
      :key="getOptionValue(option)"
      :label="getOptionLabel(option)"
      :value="getOptionValue(option)"
    />

    <template #footer>
      <div class="select-footer">
        <span class="select-summary">共 {{ total }} 项</span>
        <el-pagination
          v-if="total > pageSize"
          small
          background
          layout="prev, pager, next"
          :total="total"
          :page-size="pageSize"
          :pager-count="5"
          :current-page="currentPage"
          @current-change="currentPage = $event"
        />
      </div>
    </template>
  </el-select>
</template>

<style scoped>
.paginated-select {
  width: 100%;
}

.select-footer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px 12px 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.select-summary {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1;
}

.select-footer :deep(.el-pagination) {
  justify-content: flex-end;
}
</style>
