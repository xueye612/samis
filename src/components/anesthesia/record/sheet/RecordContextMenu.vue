<script setup lang="ts">
import type { MedicationRecord } from '@/types/anesthesia';
import type { DrugDictItem, FluidBloodDictItem } from '@/types/system';

/**
 * 交互层：纸面右键菜单。仅负责呈现与转发动作，不持有业务状态。
 * 菜单的可见性、坐标、目标对象、各分区显隐由主组件计算后以 props 传入，
 * 用户操作通过 emit 回传，使主组件的录入/作废/继续等逻辑保持单一来源。
 */
defineProps<{
  visible: boolean;
  x: number;
  y: number;
  readOnly: boolean;
  pendingDelete: boolean;
  hasLineTarget: boolean;
  type: string;
  medicationTarget: MedicationRecord | null;
  showDrugMenus: boolean;
  showInhaledMenus: boolean;
  showPlaneMenus: boolean;
  showFluidMenus: boolean;
  showAutologousMenus: boolean;
  showVitalMenus: boolean;
  showOutputMenus: boolean;
  ivCommonDrugs: DrugDictItem[];
  ivOtherDrugs: DrugDictItem[];
  inhaledDrugCatalog: DrugDictItem[];
  infusionCatalog: FluidBloodDictItem[];
  autologousCatalog: FluidBloodDictItem[];
  bloodCatalog: FluidBloodDictItem[];
}>();

const emit = defineEmits<{
  'update:pendingDelete': [value: boolean];
  edit: [];
  continue: [];
  'stop-pump': [];
  pause: [];
  resume: [];
  void: [];
  'add-medication': [drug: DrugDictItem];
  'add-fluid': [fluid: FluidBloodDictItem];
  'add-plane': [];
  'add-monitor': [];
  'batch-monitor': [];
  'add-lab': [];
  'open-observe': [];
  'add-output': [];
  'open-data-list': [];
}>();
</script>

<template>
  <div v-if="visible" class="live-context-menu" :style="{ left: `${x}px`, top: `${y}px` }" @click.stop>
    <div v-if="hasLineTarget" class="menu-section">
      <button :disabled="readOnly" @click="emit('edit')">编辑数据</button>
      <button v-if="type === 'medication' || type === 'inhaled' || type === 'infusion' || type === 'autologous'" :disabled="readOnly" @click="emit('continue')">继续用药/输液</button>
      <button v-if="(type === 'medication' || type === 'inhaled') && medicationTarget?.mode === '持续泵入' && !medicationTarget?.stopTime" :disabled="readOnly" @click="emit('stop-pump')">停止泵注</button>
      <button v-if="(type === 'medication' || type === 'inhaled') && medicationTarget?.mode === '持续泵入'" :disabled="readOnly" @click="emit('pause')">暂停泵注</button>
      <button v-if="(type === 'medication' || type === 'inhaled') && medicationTarget?.status === 'paused'" :disabled="readOnly" @click="emit('resume')">恢复泵注</button>
      <button v-if="!pendingDelete" class="danger-menu" :disabled="readOnly" @click="emit('update:pendingDelete', true)">作废当前项</button>
      <div v-else class="menu-delete-confirm">
        <p>确认作废？作废后不显示在记录单上，但会保留原始数据并记入修改痕迹，可在「已录入数据维护」中撤销。</p>
        <div class="menu-delete-actions">
          <button @click.stop="emit('update:pendingDelete', false)">取消</button>
          <button class="danger-menu" :disabled="readOnly" @click="emit('void')">确认作废</button>
        </div>
      </div>
    </div>

    <div v-if="showDrugMenus" class="menu-section">
      <strong>新增用药</strong>
      <button v-for="drug in ivCommonDrugs" :key="drug.id" :disabled="readOnly" @click="emit('add-medication', drug)">{{ drug.name }} {{ drug.specification }}</button>
      <button v-for="drug in ivOtherDrugs.slice(0, 6)" :key="drug.id" :disabled="readOnly" @click="emit('add-medication', drug)">{{ drug.name }}</button>
    </div>

    <div v-if="showInhaledMenus" class="menu-section">
      <strong>新增吸入麻醉</strong>
      <button v-for="drug in inhaledDrugCatalog" :key="drug.id" :disabled="readOnly" @click="emit('add-medication', drug)">{{ drug.name }} {{ drug.specification }}</button>
    </div>

    <div v-if="showPlaneMenus" class="menu-section">
      <strong>麻醉平面</strong>
      <button :disabled="readOnly" @click="emit('add-plane')">新增麻醉平面</button>
    </div>

    <div v-if="showFluidMenus" class="menu-section">
      <strong>新增输液</strong>
      <button v-for="fluid in infusionCatalog.slice(0, 8)" :key="fluid.id" :disabled="readOnly" @click="emit('add-fluid', fluid)">{{ fluid.name }} {{ fluid.defaultVolume ?? '' }}{{ fluid.defaultUnit ?? '' }}</button>
      <strong v-if="showAutologousMenus">新增自体血</strong>
      <button v-for="fluid in autologousCatalog" :key="fluid.id" :disabled="readOnly" @click="emit('add-fluid', fluid)">{{ fluid.name }} {{ fluid.defaultVolume ?? '' }}{{ fluid.defaultUnit ?? '' }}</button>
      <strong>新增输血</strong>
      <button v-for="fluid in bloodCatalog" :key="fluid.id" :disabled="readOnly" @click="emit('add-fluid', fluid)">{{ fluid.name }} {{ fluid.defaultVolume ?? '' }}{{ fluid.defaultUnit ?? '' }}</button>
    </div>

    <div class="menu-section">
      <button v-if="showVitalMenus" :disabled="readOnly" @click="emit('add-monitor')">添加生命体征</button>
      <button v-if="showVitalMenus" :disabled="readOnly" @click="emit('batch-monitor')">批量添加生命体征</button>
      <button v-if="showVitalMenus" :disabled="readOnly" @click="emit('add-lab')">添加血气/检验</button>
      <button v-if="showVitalMenus" :disabled="readOnly" @click="emit('open-observe')">监测项目设置</button>
      <button v-if="showOutputMenus" :disabled="readOnly" @click="emit('add-output')">添加出入量</button>
      <button @click="emit('open-data-list')">已录入数据维护</button>
    </div>
  </div>
</template>

<style scoped>
.live-context-menu {
  position: fixed;
  z-index: 1200;
  display: grid;
  min-width: 240px;
  max-height: 70vh;
  overflow: auto;
  padding: 5px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.16);
}

.menu-section {
  display: grid;
  padding: 4px 0;
  border-bottom: 1px solid #e5e7eb;
}

.menu-section strong {
  padding: 4px 10px;
  color: #475569;
  font-size: 12px;
}

.live-context-menu button {
  border: 0;
  border-radius: 5px;
  padding: 7px 10px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.live-context-menu button:hover {
  background: #e8f3ff;
}

.danger-menu {
  color: #dc2626;
}

.menu-delete-confirm {
  padding: 6px 10px;
}

.menu-delete-confirm p {
  margin: 0 0 6px;
  color: #92400e;
  font-size: 12px;
  line-height: 1.4;
}

.menu-delete-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.menu-delete-actions button {
  border: 1px solid #cbd5e1;
  border-radius: 5px;
  padding: 4px 12px;
}

.menu-delete-actions .danger-menu {
  border-color: #f1a5a5;
  background: #fef2f2;
  font-weight: 700;
}
</style>
