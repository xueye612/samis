<template>
  <section class="live-record-card print-area" @contextmenu.prevent="openMenu($event, 'grid')">
    <div class="print-heading">
      <div></div>
      <h2>XXX医院麻醉记录单</h2>
      <div class="doc-meta"><span>编号</span><i>{{ record.patientId }}</i><strong>E</strong></div>
    </div>
    <div v-if="record.locked" class="sheet-locked-ribbon">已锁定，仅可查看</div>

    <div class="patient-lines">
      <div>
        <span>科别 {{ record.department }}</span>
        <span>床号 {{ record.sequence }}台</span>
        <span>住院号 {{ record.patientId ?? record.id }}</span>
        <span>手术日期 {{ formatDate(record.plannedStart) }}</span>
        <span>页号 1</span>
        <span>付费方式 未记录</span>
      </div>
      <div>
        <span>姓名 {{ record.patientName }}</span>
        <span>性别 {{ record.gender }}</span>
        <span>年龄 {{ record.age }}岁</span>
        <span>体重 {{ record.preVisit.weight }}kg</span>
        <span>血型 {{ bloodLabel }}</span>
        <span>ASA {{ record.asa }}</span>
      </div>
      <div>
        <span>术前诊断 {{ record.diagnosis }}</span>
        <span>术前用药 {{ record.preVisit.preMedication || '未记录' }}</span>
        <span>术前禁食 {{ record.preVisit.fasting || '未记录' }}</span>
      </div>
      <div>
        <span>拟施手术 {{ record.surgeryName }}</span>
        <span>手术体位 {{ record.recoveryRecord?.handoverNote || '未记录' }}</span>
        <span>身份证号 未记录</span>
      </div>
    </div>

    <section class="sheet-professional-summary" :class="{ 'has-impact': Boolean(templateImpact) }">
      <div class="professional-summary-head">
        <strong>专业麻醉记录</strong>
        <span v-if="appliedTemplateName">模板：{{ appliedTemplateName }}</span>
        <span>麻醉方法：{{ sheetAnesthesiaMethod }}</span>
        <span v-if="recentEventLabel" class="recent-event-pill">最近记录：{{ recentEventLabel }}</span>
      </div>
      <div class="professional-paper-grid">
        <section v-for="group in professionalFieldGroups" :key="group.title" class="professional-paper-group">
          <b>{{ group.title }}</b>
          <dl>
            <div v-for="item in group.items" :key="`${group.title}-${item.label}`">
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value || '待记录' }}</dd>
            </div>
          </dl>
        </section>
        <section class="professional-paper-group template-events" v-if="templateEventRows.length">
          <b>模板事件落单</b>
          <p>
            <span v-for="event in templateEventRows" :key="event.id">{{ event.time }} {{ event.type }}</span>
          </p>
        </section>
        <section class="professional-paper-group quality-tips" v-if="templateQualityTips.length">
          <b>质控提醒</b>
          <p>
            <span v-for="tip in templateQualityTips" :key="tip.text" :class="`tip-${tip.level}`">{{ tip.level }}：{{ tip.text }}</span>
          </p>
        </section>
      </div>
    </section>

    <div class="sheet-ruler">
      <div class="ruler-label">项目</div>
      <div class="ruler-track">
        <span v-for="tick in timeScale.majorTicks" :key="tick.time" :style="{ left: `${tick.percent}%` }">{{ tick.label }}</span>
        <i v-for="line in bandGrid(1).verticalLines" :key="`ruler-${line.id}`" :class="{ major: line.isMajor }" :style="{ left: `${line.percent}%` }"></i>
      </div>
    </div>

    <div class="sheet-band medication-band" :style="{ '--rows': medicationRowCount }">
      <div class="band-side">麻醉用药</div>
      <div class="band-labels">
        <span v-if="showAnesthesiaPlane">麻醉平面</span>
        <span v-for="row in medicationRows" :key="row.key">{{ row.label }}</span>
        <span v-for="index in Math.max(0, medicationRowCount - medicationRows.length - planeRowOffset)" :key="`med-empty-${index}`"></span>
      </div>
      <div class="band-track" :style="gridBackgroundStyle" @contextmenu.prevent.stop="openMenu($event, 'drugGrid')">
        <GridLines :grid="bandGrid(medicationRowCount)" />
        <span
          v-for="plane in planeRows"
          :key="plane.key"
          class="plane-marker"
          :style="pointStyle(plane.time, 0, medicationRowCount)"
          @contextmenu.prevent.stop="openMenu($event, 'plane', plane.source)"
          @dblclick="openPlaneEditor(plane.source)"
        >{{ plane.label }}</span>
        <template v-for="row in medicationRows" :key="row.key">
          <span
            v-if="!row.end"
            class="drug-point"
            :class="{ 'is-template': row.template }"
            :style="pointStyle(row.time, row.index, medicationRowCount)"
            @contextmenu.prevent.stop="openMenu($event, 'medication', row.source)"
            @dblclick="openMedicationEditor(row.source)"
          >{{ row.amount }}</span>
          <span
            v-else
            class="line-segment drug-line"
            :class="{ 'is-template': row.template }"
            :style="segmentStyle(row.time, row.end, row.index, medicationRowCount)"
            @contextmenu.prevent.stop="openMenu($event, 'medication', row.source)"
            @dblclick="openMedicationEditor(row.source)"
            @pointerdown.stop="startSegmentDrag($event, 'medication', row.source, 'move', row.index, medicationRowCount)"
          >
            <i class="segment-handle segment-handle-start" @pointerdown.stop="startSegmentDrag($event, 'medication', row.source, 'start', row.index, medicationRowCount)"></i>
            <span class="segment-label">{{ row.amount }}</span>
            <i class="segment-handle segment-handle-end" @pointerdown.stop="startSegmentDrag($event, 'medication', row.source, 'end', row.index, medicationRowCount)"></i>
          </span>
        </template>
        <span
          v-if="segmentDragPreview.active && segmentDragPreview.band === 'medication'"
          class="line-segment drag-preview drug-line"
          :style="segmentDragPreview.style"
        ><span class="segment-label">{{ segmentDragPreview.label }}</span></span>
      </div>
    </div>

    <div class="sheet-band" :style="{ '--rows': infusionRowCount }">
      <div class="band-side">输液</div>
      <div class="band-labels">
        <span v-for="row in infusionRows" :key="row.key">{{ row.label }}</span>
        <span v-for="index in Math.max(0, infusionRowCount - infusionRows.length)" :key="`inf-empty-${index}`"></span>
      </div>
      <div class="band-track" :style="gridBackgroundStyle" @contextmenu.prevent.stop="openMenu($event, 'infusionGrid')">
        <GridLines :grid="bandGrid(infusionRowCount)" />
        <span
          v-for="row in infusionRows"
          :key="row.key"
          class="line-segment fluid-line"
          :style="segmentStyle(row.time, row.end, row.index, infusionRowCount)"
          @contextmenu.prevent.stop="openMenu($event, 'infusion', row.source)"
          @dblclick="openFluidEditor(row.source)"
          @pointerdown.stop="startSegmentDrag($event, 'fluid', row.source, 'move', row.index, infusionRowCount)"
        >
          <i class="segment-handle segment-handle-start" @pointerdown.stop="startSegmentDrag($event, 'fluid', row.source, 'start', row.index, infusionRowCount)"></i>
          <span class="segment-label">{{ row.amount }}</span>
          <i class="segment-handle segment-handle-end" @pointerdown.stop="startSegmentDrag($event, 'fluid', row.source, 'end', row.index, infusionRowCount)"></i>
        </span>
        <span
          v-if="segmentDragPreview.active && segmentDragPreview.band === 'infusion'"
          class="line-segment drag-preview fluid-line"
          :style="segmentDragPreview.style"
        ><span class="segment-label">{{ segmentDragPreview.label }}</span></span>
      </div>
    </div>

    <div class="sheet-band" :style="{ '--rows': transfusionRowCount }">
      <div class="band-side">输血</div>
      <div class="band-labels">
        <span v-for="row in transfusionRows" :key="row.key">{{ row.label }}</span>
        <span v-for="index in Math.max(0, transfusionRowCount - transfusionRows.length)" :key="`blood-empty-${index}`"></span>
      </div>
      <div class="band-track" :style="gridBackgroundStyle" @contextmenu.prevent.stop="openMenu($event, 'transfusionGrid')">
        <GridLines :grid="bandGrid(transfusionRowCount)" />
        <span
          v-for="row in transfusionRows"
          :key="row.key"
          class="line-segment blood-line"
          :style="segmentStyle(row.time, row.end, row.index, transfusionRowCount)"
          @contextmenu.prevent.stop="openMenu($event, 'transfusion', row.source)"
          @dblclick="openFluidEditor(row.source)"
          @pointerdown.stop="startSegmentDrag($event, 'fluid', row.source, 'move', row.index, transfusionRowCount)"
        >
          <i class="segment-handle segment-handle-start" @pointerdown.stop="startSegmentDrag($event, 'fluid', row.source, 'start', row.index, transfusionRowCount)"></i>
          <span class="segment-label">{{ row.amount }}</span>
          <i class="segment-handle segment-handle-end" @pointerdown.stop="startSegmentDrag($event, 'fluid', row.source, 'end', row.index, transfusionRowCount)"></i>
        </span>
        <span
          v-if="segmentDragPreview.active && segmentDragPreview.band === 'transfusion'"
          class="line-segment drag-preview blood-line"
          :style="segmentDragPreview.style"
        ><span class="segment-label">{{ segmentDragPreview.label }}</span></span>
      </div>
    </div>

    <div class="sheet-band monitor-band" :style="{ '--rows': monitorRowCount }">
      <div class="band-side">监测</div>
      <div class="band-labels">
        <span v-for="item in monitorRows" :key="item.shortCode">{{ item.shortCode }}</span>
      </div>
      <div class="band-track" :style="gridBackgroundStyle" @contextmenu.prevent.stop="openMenu($event, 'monitor')">
        <GridLines :grid="bandGrid(monitorRowCount)" />
        <span
          v-for="cell in monitorCells"
          :key="cell.key"
          class="monitor-value"
          :class="{ abnormal: cell.abnormal }"
          :style="{ left: `${cell.leftPercent}%`, top: `${cell.topPercent}%` }"
          :title="`${isoOrClockToClock(cell.time)} ${cell.metric}: ${cell.value}${cell.unit}`"
          @contextmenu.prevent.stop="openMenu($event, 'vital', cell.row)"
          @dblclick="openMonitorDialog(cell.row)"
        >
          {{ cell.value }}
        </span>
      </div>
    </div>

    <div class="surgery-status-row">
      <div class="status-title">手术状态</div>
      <div class="status-track" :style="gridBackgroundStyle" @contextmenu.prevent.stop="openMenu($event, 'balance')">
        <GridLines :grid="bandGrid(1)" />
        <span
          v-for="event in statusEvents"
          :key="`status-${event.id}`"
          class="surgery-status-symbol"
          :class="event.className"
          :style="{ left: leftFor(event.time) }"
          :title="event.type"
          @click.stop="emit('selectEvent', event)"
        >{{ event.symbol }}</span>
      </div>
    </div>

    <div class="vital-chart">
      <div class="chart-legend">
        <div class="event-legend">
          <span v-for="item in eventLegend" :key="item.label"><b>{{ item.symbol }}</b>{{ item.label }}</span>
        </div>
        <div class="vital-symbol-legend">
          <span v-for="item in referenceLegendItems" :key="item.shortCode">
            <b :style="{ color: item.chartColor }">{{ symbolText(item.chartSymbol) }}</b>{{ item.legendLabel }}
          </span>
        </div>
        <div class="temp-scale-mini">
          <span>39</span><span>37</span><span>35</span><span>33</span>
          <em>体温</em>
        </div>
      </div>
      <div class="chart-scale">
        <span v-for="tick in chartTicks" :key="tick.value" :style="{ top: `${tick.top}%` }">{{ tick.value }}</span>
        <em v-for="tick in respiratoryTicks" :key="`rr-${tick.value}`" :style="{ top: `${tick.top}%` }">{{ tick.value }}</em>
        <small>mmHg</small>
        <small class="kpa-label">kPa</small>
      </div>
      <div ref="chartAreaRef" class="chart-area" :style="gridBackgroundStyle" @contextmenu.prevent.stop="openMenu($event, 'chart')">
        <GridLines :grid="chartGrid" chart />
        <svg viewBox="0 0 1000 300" preserveAspectRatio="none">
          <polyline v-for="item in chartVitals" :key="`line-${item.shortCode}`" :points="chartLine(item)" :stroke="item.chartColor ?? '#2563eb'" />
          <g v-for="item in chartVitals" :key="`points-${item.shortCode}`">
            <path
              v-for="point in chartPoints(item)"
              :key="point.key"
              :d="markerPath(item, point.x, point.y)"
              :fill="markerFill(item)"
              :stroke="item.chartColor ?? '#2563eb'"
              stroke-width="2"
              vector-effect="non-scaling-stroke"
              @pointerdown.stop="startVitalPointDrag($event, item, point.row)"
              @contextmenu.prevent.stop="openMenu($event, 'vital', point.row)"
              @dblclick="openMonitorDialog(point.row)"
            />
          </g>
        </svg>
        <span v-if="vitalDragState.active" class="drag-guide" :style="{ top: `${vitalDragState.y}px` }"></span>
        <span v-if="vitalDragState.active" class="drag-tooltip" :style="{ left: `${vitalDragState.left}px`, top: `${vitalDragState.top}px` }">
          {{ vitalDragState.item?.shortCode }} {{ vitalDragState.value }}{{ vitalDragState.item?.unit }}
        </span>
      </div>
    </div>

    <div class="sheet-band status-band" :style="{ '--rows': 5 }">
      <div class="band-side">出入量</div>
      <div class="band-labels">
        <span>尿量（ml）</span><span>出血量（ml）</span><span>其它（ml）</span><span>特殊用药序号</span><span>手术关键操作</span>
      </div>
      <div class="band-track" :style="gridBackgroundStyle" @contextmenu.prevent.stop="openMenu($event, 'balance')">
        <GridLines :grid="bandGrid(5)" />
        <span
          v-for="output in outputRows"
          :key="output.id"
          class="output-point output-marker"
          :style="pointStyle(output.time, output.index, 5)"
          @contextmenu.prevent.stop="openMenu($event, 'output', output.source)"
          @dblclick="openOutputEditor(output.source)"
        >{{ output.volume }}ml</span>
        <span v-for="event in statusEvents" :key="event.id" class="event-symbol" :style="pointStyle(event.time, 4, 5)">{{ event.symbol }}</span>
      </div>
    </div>

    <div class="sheet-notes reference-notes">
      <div class="note-vertical"><strong>麻醉诱导用药</strong></div>
      <div><strong>诱导及维持摘要</strong><p>{{ medSummary }}</p></div>
      <div><strong>辅助及特殊用药</strong><p>{{ eventSummary }}</p></div>
      <div><strong>手术关键操作</strong><p>{{ operationSummary }}</p></div>
      <div><strong>术后镇痛</strong><p>{{ postopAnalgesiaSummary }}</p></div>
    </div>

    <div class="sheet-footer-summary">
      <div><strong>术后诊断</strong><span>{{ record.diagnosis }}</span></div>
      <div><strong>实施手术</strong><span>{{ record.surgeryName }}</span></div>
      <div><strong>麻醉方法</strong><span>{{ sheetAnesthesiaMethod }}</span></div>
      <div><strong>手术医师</strong><span>{{ record.surgeon }}</span></div>
      <div><strong>麻醉医师</strong><span>{{ record.signatures?.anesthesiologist || record.anesthesiologist }}</span></div>
      <div><strong>洗手护士</strong><span>{{ record.anesthesiaNurse }}</span></div>
      <div><strong>巡回护士</strong><span>{{ record.signatures?.nurse || record.anesthesiaNurse }}</span></div>
      <div><strong>入量(ml)</strong><span>晶体液 {{ balanceSummary.crystalInput }}　胶体液 {{ balanceSummary.colloidInput }}　血液 {{ balanceSummary.bloodInput }}</span></div>
      <div><strong>出量(ml)</strong><span>尿量 {{ balanceSummary.urine }}　出血量 {{ balanceSummary.bloodLoss }}　其它 {{ balanceSummary.otherOutput }}</span></div>
      <div><strong>总进出量(ml)</strong><span>总入量 {{ balanceSummary.totalInput }}　总出量 {{ balanceSummary.totalOutput }}</span></div>
    </div>

    <div v-if="menu.visible" class="live-context-menu" :style="{ left: `${menu.x}px`, top: `${menu.y}px` }" @click.stop>
      <div v-if="hasLineTarget" class="menu-section">
        <button :disabled="readOnly" @click="openTargetEditor">编辑数据</button>
        <button v-if="menu.type === 'medication' || menu.type === 'infusion'" :disabled="readOnly" @click="continueTarget">继续用药/输液</button>
        <button class="danger-menu" :disabled="readOnly" @click="deleteTarget">删除当前项</button>
      </div>

      <div v-if="showDrugMenus" class="menu-section">
        <strong>新增用药</strong>
        <button v-for="drug in commonDrugs" :key="drug.id" :disabled="readOnly" @click="openMedicationEditor(drug)">{{ drug.name }} {{ drug.specification }}</button>
        <button v-for="drug in otherDrugs.slice(0, 6)" :key="drug.id" :disabled="readOnly" @click="openMedicationEditor(drug)">{{ drug.name }}</button>
      </div>

      <div v-if="showPlaneMenus" class="menu-section">
        <strong>麻醉平面</strong>
        <button :disabled="readOnly" @click="openPlaneEditor()">新增麻醉平面</button>
      </div>

      <div v-if="showFluidMenus" class="menu-section">
        <strong>新增输液</strong>
        <button v-for="fluid in infusionCatalog.slice(0, 8)" :key="fluid.id" :disabled="readOnly" @click="openFluidEditor(fluid)">{{ fluid.name }} {{ fluid.defaultVolume ?? '' }}{{ fluid.defaultUnit ?? '' }}</button>
        <strong>新增输血</strong>
        <button v-for="fluid in bloodCatalog" :key="fluid.id" :disabled="readOnly" @click="openFluidEditor(fluid)">{{ fluid.name }} {{ fluid.defaultVolume ?? '' }}{{ fluid.defaultUnit ?? '' }}</button>
      </div>

      <div class="menu-section">
        <button v-if="showVitalMenus" :disabled="readOnly" @click="openMonitorDialog()">添加生命体征</button>
        <button v-if="showVitalMenus" :disabled="readOnly" @click="openBatchMonitorDialog">批量添加生命体征</button>
        <button v-if="showVitalMenus" :disabled="readOnly" @click="observeVisible = true; menu.visible = false">监测项目设置</button>
        <button v-if="showOutputMenus" :disabled="readOnly" @click="openOutputEditor()">添加出入量</button>
        <button @click="openDataList(defaultDataList)">已录入数据维护</button>
      </div>
    </div>

    <RecordModalShell
      v-if="lineVisible"
      size="small"
      top-layer
      :title="`${lineForm.kind === 'medication' ? '用药' : lineForm.kind === 'transfusion' ? '输血' : '输液'}数据`"
      @close="lineVisible = false"
    >
        <div class="live-modal-body">
          <label>
            名称
            <select v-if="lineForm.kind === 'medication'" v-model="lineForm.name" @change="syncMedicationForm">
              <option v-for="drug in drugs" :key="drug.id" :value="drug.name">{{ drug.name }}（{{ drug.specification }}）</option>
            </select>
            <select v-else v-model="lineForm.name" @change="syncFluidForm">
              <option v-for="fluid in lineForm.kind === 'transfusion' ? bloodCatalog : infusionCatalog" :key="fluid.id" :value="fluid.name">{{ fluid.name }}</option>
            </select>
          </label>
          <label v-if="lineForm.kind === 'medication'">
            类型
            <span class="inline-options">
              <label><input v-model="lineForm.mode" type="radio" value="单次用药" />单次</label>
              <label><input v-model="lineForm.mode" type="radio" value="持续泵入" />持续</label>
            </span>
          </label>
          <label>开始时间<input v-model="lineForm.time" type="time" step="60" /></label>
          <label>
            结束时间
            <input v-model="lineForm.endTime" type="time" step="60" :disabled="lineForm.kind === 'medication' && lineForm.mode === '单次用药'" />
          </label>
          <label>剂量/容量<input v-model.number="lineForm.amount" type="number" min="0" /></label>
          <label>单位<input v-model="lineForm.unit" /></label>
          <label v-if="lineForm.kind === 'medication'">途径<input v-model="lineForm.route" /></label>
          <label>执行人<input v-model="lineForm.executor" /></label>
          <label v-if="lineForm.kind === 'medication'">核对人<input v-model="lineForm.checker" /></label>
          <template v-if="lineForm.kind === 'transfusion'">
            <label>血型<select v-model="lineForm.bloodType"><option value="">未填</option><option v-for="item in bloodTypes" :key="item">{{ item }}</option></select></label>
            <label>Rh<select v-model="lineForm.rh"><option value="">未填</option><option v-for="item in rhTypes" :key="item">{{ item }}</option></select></label>
            <label>血袋号<input v-model="lineForm.bagNo" /></label>
            <label>反应<select v-model="lineForm.reaction"><option v-for="item in transfusionReactions" :key="item">{{ item }}</option></select></label>
            <label>
              双人核对
              <span class="inline-options">
                <label><input v-model="lineForm.anesthesiaConfirmed" type="checkbox" />麻醉医师</label>
                <label><input v-model="lineForm.circulatingConfirmed" type="checkbox" />巡回护士</label>
              </span>
            </label>
          </template>
        </div>
        <template #footer>
          <button class="btn small" @click="lineVisible = false">关闭</button>
          <button class="btn small primary" :disabled="readOnly" @click="saveLineForm">保存</button>
        </template>
    </RecordModalShell>

    <RecordModalShell v-if="planeVisible" size="small" top-layer title="麻醉平面" @close="planeVisible = false">
      <div class="live-modal-body">
        <label>时间<span class="time-stepper"><button type="button" @click="shiftPlaneTime(-1)">-</button><input v-model="planeForm.time" type="time" step="60" /><button type="button" @click="shiftPlaneTime(1)">+</button></span></label>
        <label>平面<select v-model="planeForm.level"><option v-for="level in planeLevels" :key="level">{{ level }}</option></select></label>
        <label>变化<select v-model="planeForm.direction"><option value="down">下降 ↓</option><option value="up">上升 ↑</option><option value="fixed">稳定</option></select></label>
        <label>备注<input v-model="planeForm.remark" /></label>
      </div>
      <template #footer>
        <button class="btn small" @click="planeVisible = false">关闭</button>
        <button class="btn small primary" :disabled="readOnly" @click="savePlaneForm">保存</button>
      </template>
    </RecordModalShell>

    <RecordModalShell
      v-if="monitorVisible"
      size="large"
      top-layer
      :title="monitorBatch ? '批量生命体征' : monitorForm.id ? '编辑生命体征' : '新增生命体征'"
      @close="monitorVisible = false"
    >
        <div class="live-modal-body monitor-form">
          <label>时间<span class="time-stepper"><button type="button" @click="shiftMonitorTime('time', -1)">-</button><input v-model="monitorForm.time" type="time" step="60" /><button type="button" @click="shiftMonitorTime('time', 1)">+</button></span></label>
          <label v-if="monitorBatch">结束<span class="time-stepper"><button type="button" @click="shiftMonitorTime('end', -1)">-</button><input v-model="monitorEndTime" type="time" step="60" /><button type="button" @click="shiftMonitorTime('end', 1)">+</button></span></label>
          <label v-if="monitorBatch">间隔<input v-model.number="monitorInterval" type="number" min="1" /> 分钟</label>
          <div class="monitor-item-grid">
            <label v-for="item in monitorRows" :key="item.shortCode">
              {{ item.shortCode }} <small>{{ item.unit }}</small>
              <input v-model="monitorValues[item.shortCode]" :type="item.decimalPlaces ? 'number' : 'text'" />
            </label>
          </div>
          <label>来源<input v-model="monitorForm.source" /></label>
          <label>备注<input v-model="monitorForm.remark" /></label>
        </div>
        <template #footer>
          <button class="btn small primary" :disabled="readOnly" @click="saveMonitorForm">保存</button>
          <button class="btn small" @click="monitorVisible = false">关闭</button>
        </template>
    </RecordModalShell>

    <RecordModalShell v-if="outputVisible" size="small" top-layer title="出入量设置" @close="outputVisible = false">
        <div class="live-modal-body">
          <label>时间<span class="time-stepper"><button type="button" @click="shiftOutputTime(-1)">-</button><input v-model="outputForm.time" type="time" step="60" /><button type="button" @click="shiftOutputTime(1)">+</button></span></label>
          <label>类型<select v-model="outputForm.type"><option>尿量</option><option>出血量</option><option>引流量</option><option>其他</option></select></label>
          <label>容量 ml<input v-model.number="outputForm.volume" type="number" min="0" /></label>
          <label>备注<input v-model="outputForm.remark" /></label>
        </div>
        <template #footer>
          <button class="btn small" @click="outputVisible = false">关闭</button>
          <button class="btn small primary" :disabled="readOnly" @click="saveOutputForm">保存</button>
        </template>
    </RecordModalShell>

    <RecordModalShell v-if="observeVisible" size="large" top-layer title="监测项目设置" @close="observeVisible = false">
        <div class="observe-body">
          <section class="observe-panel">
            <header>
              <strong>可选项目</strong>
              <span>{{ availableMonitorItems.length }}项</span>
            </header>
            <button
              v-for="item in availableMonitorItems"
              :key="item.shortCode"
              class="observe-item"
              @click="toggleMonitorCode(item.shortCode)"
            >
              <b :style="{ color: item.chartColor ?? '#64748b' }">{{ symbolText(item.chartSymbol) }}</b>
              <span>{{ item.shortCode }}<small>{{ item.name }}</small></span>
              <em>{{ item.unit }}</em>
            </button>
          </section>
          <section class="observe-panel selected">
            <header>
              <strong>已显示项目</strong>
              <span>{{ selectedMonitorItems.length }}项</span>
            </header>
            <div
              v-for="item in selectedMonitorItems"
              :key="item.shortCode"
              class="observe-item active"
              draggable="true"
              @dragstart="draggedMonitorCode = item.shortCode"
              @dragover.prevent
              @drop.prevent="moveMonitorCode(item.shortCode, 'drop')"
              @click="toggleMonitorCode(item.shortCode)"
            >
              <b :style="{ color: item.chartColor ?? '#64748b' }">{{ symbolText(item.chartSymbol) }}</b>
              <span>{{ item.shortCode }}<small>{{ item.normalRange || '未设范围' }}</small></span>
              <em>{{ item.chartEnabled ? '曲线' : '数值' }}</em>
              <i class="observe-actions" @click.stop>
                <button type="button" @click="moveMonitorCode(item.shortCode, 'up')">↑</button>
                <button type="button" @click="moveMonitorCode(item.shortCode, 'down')">↓</button>
              </i>
            </div>
          </section>
        </div>
        <template #footer><button class="btn small primary" @click="closeObserveSetting">保存</button></template>
    </RecordModalShell>

    <RecordModalShell v-if="dataVisible" size="wide" top-layer title="已录入数据维护" @close="dataVisible = false">
        <div class="data-tabs">
          <button v-for="tab in dataTabs" :key="tab.key" :class="{ active: activeDataList === tab.key }" @click="activeDataList = tab.key">{{ tab.label }}</button>
        </div>
        <div class="live-modal-body data-list-body">
          <table v-if="activeDataList === 'planes'" class="live-data-table">
            <thead><tr><th>时间</th><th>平面</th><th>变化</th><th>备注</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="row in record.anesthesiaPlanes ?? []" :key="row.id" @dblclick="openPlaneEditor(row)">
                <td>{{ isoOrClockToClock(row.time) }}</td><td>{{ row.level }}</td><td>{{ planeDirectionText(row.direction) }}</td><td>{{ row.remark || '-' }}</td>
                <td><button @click="openPlaneEditor(row)">编辑</button><button :disabled="readOnly" @click="emit('deleteRecord', 'plane', row.id)">删除</button></td>
              </tr>
            </tbody>
          </table>
          <table v-else-if="activeDataList === 'medications'" class="live-data-table">
            <thead><tr><th>时间</th><th>名称</th><th>剂量</th><th>途径</th><th>核对</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="row in record.medications" :key="row.id" @dblclick="openMedicationEditor(row)">
                <td>{{ isoOrClockToClock(row.time ?? row.startTime) }}</td><td>{{ row.drug }}</td><td>{{ row.dose }}{{ row.unit }}</td><td>{{ row.route }}</td><td>{{ row.checker || '-' }}</td>
                <td><button @click="openMedicationEditor(row)">编辑</button><button :disabled="readOnly" @click="emit('deleteRecord', 'medication', row.id)">删除</button></td>
              </tr>
            </tbody>
          </table>
          <table v-else-if="activeDataList === 'infusions'" class="live-data-table">
            <thead><tr><th>时间</th><th>名称</th><th>容量</th><th>结束</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="row in record.fluids.filter((item) => item.category !== '血液制品')" :key="row.id" @dblclick="openFluidEditor(row)">
                <td>{{ isoOrClockToClock(row.startTime ?? row.time) }}</td><td>{{ row.name }}</td><td>{{ row.volume }}{{ row.unit }}</td><td>{{ isoOrClockToClock(row.endTime) || '-' }}</td>
                <td><button @click="openFluidEditor(row)">编辑</button><button :disabled="readOnly" @click="emit('deleteRecord', 'fluid', row.id)">删除</button></td>
              </tr>
            </tbody>
          </table>
          <table v-else-if="activeDataList === 'transfusions'" class="live-data-table">
            <thead><tr><th>时间</th><th>血品</th><th>血型</th><th>核对</th><th>反应</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="row in record.fluids.filter((item) => item.category === '血液制品')" :key="row.id" @dblclick="openFluidEditor(row)">
                <td>{{ isoOrClockToClock(row.startTime ?? row.time) }}</td><td>{{ row.name }} {{ row.volume }}{{ row.unit }}</td><td>{{ row.bloodType || '-' }} {{ row.rh || '' }}</td><td>{{ row.doubleCheck ? '完成' : '未完成' }}</td><td>{{ row.reaction || '-' }}</td>
                <td><button @click="openFluidEditor(row)">编辑</button><button :disabled="readOnly" @click="emit('deleteRecord', 'fluid', row.id)">删除</button></td>
              </tr>
            </tbody>
          </table>
          <table v-else-if="activeDataList === 'vitals'" class="live-data-table">
            <thead><tr><th>时间</th><th v-for="item in monitorRows" :key="item.shortCode">{{ item.shortCode }}</th><th>来源</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="row in visibleVitals" :key="row.id ?? row.time" @dblclick="openMonitorDialog(row)">
                <td>{{ isoOrClockToClock(row.time) }}</td><td v-for="item in monitorRows" :key="item.shortCode">{{ row[item.shortCode as keyof typeof row] ?? '' }}</td><td>{{ row.source }}</td>
                <td><button @click="openMonitorDialog(row)">编辑</button><button :disabled="readOnly || !row.id" @click="emit('deleteRecord', 'vital', row.id || '')">删除</button></td>
              </tr>
            </tbody>
          </table>
          <table v-else class="live-data-table">
            <thead><tr><th>时间</th><th>类型</th><th>容量</th><th>备注</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="row in record.outputRecords ?? []" :key="row.id" @dblclick="openOutputEditor(row)">
                <td>{{ isoOrClockToClock(row.time) }}</td><td>{{ row.type }}</td><td>{{ row.volume }}ml</td><td>{{ row.remark || '-' }}</td>
                <td><button @click="openOutputEditor(row)">编辑</button><button :disabled="readOnly" @click="emit('deleteRecord', 'output', row.id)">删除</button></td>
              </tr>
            </tbody>
          </table>
        </div>
    </RecordModalShell>
  </section>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, defineComponent, h, onBeforeUnmount, reactive, ref, watch } from 'vue';
import RecordModalShell from './RecordModalShell.vue';
import type { AnesthesiaEvent, AnesthesiaPlaneRecord, FluidRecord, MedicationRecord, OutputDetailRecord, SurgeryCase, VitalSign } from '@/types/anesthesia';
import type { DynamicModuleEntry, TemplateImpact, TemplateImpactEvent, TemplateImpactMedication } from '@/mock/anesthesiaRecordPrototype';
import type { DrugDictItem, FluidBloodDictItem, VitalSignDictItem } from '@/types/system';
import {
  buildMonitorCells,
  buildRecordBandGrid,
  buildBalanceSummary,
  chartYWithPadding,
  clampVitalValueByDict,
  calculateLiveSheetEnd,
  collectRecordTimes,
  createAnesthesiaPlaneDraft,
  createFluidLineDraft,
  createMedicationLineDraft,
  dragVitalPointValue,
  dragTimeSegment,
  isoOrClockToClock,
  minutesToClock,
  moveMonitorItemOrder,
  percentToTime,
  timeToPercent,
  clockToMinutes,
  vitalMarkerShape,
  type RecordBandGrid,
} from '@/services/anesthesiaRecordEngine';
import { buildLiveTimeScale } from '@/services/anesthesiaRecordEngine';

const GridLines = defineComponent({
  name: 'GridLines',
  props: {
    grid: { type: Object as () => RecordBandGrid, required: true },
    chart: { type: Boolean, default: false },
  },
  setup(props) {
    return () => [
      h('div', { class: 'print-grid-lines', 'aria-hidden': 'true' }, props.grid.verticalLines.map((line) =>
        h('span', { key: line.id, class: { major: line.isMajor }, style: { left: `${line.percent}%` } }),
      )),
      h('div', { class: props.chart ? 'print-chart-horizontal-lines' : 'print-row-lines', 'aria-hidden': 'true' }, props.grid.rowLines.map((line) =>
        h('span', { key: line.id, class: { major: line.isMajor }, style: { top: `${line.percent}%` } }),
      )),
    ];
  },
});

const props = withDefaults(defineProps<{
  record: SurgeryCase;
  vitals: VitalSignDictItem[];
  drugs: DrugDictItem[];
  fluids: FluidBloodDictItem[];
  bloodTypes?: string[];
  rhTypes?: string[];
  transfusionReactions?: string[];
  monitorOrder?: string[];
  readOnly?: boolean;
  showAnesthesiaPlane?: boolean;
  appliedTemplateName?: string;
  appliedMethodLabels?: string[];
  appliedModules?: DynamicModuleEntry[];
  templateImpact?: TemplateImpact;
  recentEventLabel?: string;
}>(), {
  bloodTypes: () => [],
  rhTypes: () => [],
  transfusionReactions: () => ['无'],
  monitorOrder: () => [],
  readOnly: false,
  showAnesthesiaPlane: true,
  appliedTemplateName: '',
  appliedMethodLabels: () => [],
  appliedModules: () => [],
  templateImpact: undefined,
  recentEventLabel: '',
});

const emit = defineEmits<{
  saveMedication: [record: MedicationRecord];
  saveFluid: [record: FluidRecord];
  saveVital: [record: VitalSign];
  saveOutput: [record: OutputDetailRecord];
  savePlane: [record: AnesthesiaPlaneRecord];
  saveMonitorOrder: [codes: string[]];
  deleteRecord: [kind: 'medication' | 'fluid' | 'vital' | 'output' | 'plane', id: string];
  selectEvent: [event: AnesthesiaEvent];
}>();

type MenuType = 'grid' | 'planeGrid' | 'plane' | 'drugGrid' | 'medication' | 'infusionGrid' | 'infusion' | 'transfusionGrid' | 'transfusion' | 'monitor' | 'chart' | 'vital' | 'balance' | 'output';

const menu = reactive<{ visible: boolean; x: number; y: number; type: MenuType; target: unknown; at: string }>({
  visible: false,
  x: 0,
  y: 0,
  type: 'grid',
  target: null,
  at: '',
});

const lineVisible = ref(false);
const monitorVisible = ref(false);
const monitorBatch = ref(false);
const outputVisible = ref(false);
const planeVisible = ref(false);
const observeVisible = ref(false);
const dataVisible = ref(false);
const activeDataList = ref<'planes' | 'medications' | 'infusions' | 'transfusions' | 'vitals' | 'outputs'>('medications');
const selectedMonitorCodes = ref<string[]>([]);
const monitorValues = reactive<Record<string, string>>({});
const monitorEndTime = ref('');
const monitorInterval = ref(5);
const draggedMonitorCode = ref('');
const chartAreaRef = ref<HTMLElement | null>(null);
const planeLevels = ['C8', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12', 'L1', 'L2'];

const lineForm = reactive({
  kind: 'medication' as 'medication' | 'infusion' | 'transfusion',
  id: '',
  name: '',
  mode: '单次用药' as MedicationRecord['mode'],
  category: '晶体液' as FluidRecord['category'],
  time: '',
  endTime: '',
  amount: 0,
  unit: '',
  route: '',
  executor: '',
  checker: '',
  highAlert: false,
  bloodType: '',
  rh: '',
  reaction: '无',
  bagNo: '',
  anesthesiaConfirmed: false,
  circulatingConfirmed: false,
});
const monitorForm = reactive({ id: '', time: '', source: '手工录入', remark: '' });
const outputForm = reactive({ id: '', time: '', type: '尿量' as OutputDetailRecord['type'], volume: 0, remark: '' });
const planeForm = reactive({
  id: '',
  time: '',
  level: 'T6',
  direction: 'down' as AnesthesiaPlaneRecord['direction'],
  remark: '',
});
const dragState = reactive<{
  active: boolean;
  kind: 'medication' | 'fluid';
  band: 'medication' | 'infusion' | 'transfusion';
  mode: 'move' | 'start' | 'end';
  source: MedicationRecord | FluidRecord | null;
  startX: number;
  left: number;
  width: number;
  rowIndex: number;
  rowTotal: number;
}>({
  active: false,
  kind: 'medication',
  band: 'medication',
  mode: 'move',
  source: null,
  startX: 0,
  left: 0,
  width: 1,
  rowIndex: 0,
  rowTotal: 1,
});
const segmentDragPreview = reactive<{
  active: boolean;
  band: 'medication' | 'infusion' | 'transfusion';
  style: Record<string, string>;
  label: string;
}>({
  active: false,
  band: 'medication',
  style: {},
  label: '',
});
const vitalDragState = reactive<{
  active: boolean;
  item: VitalSignDictItem | null;
  row: VitalSign | null;
  rect: DOMRect | null;
  value: number;
  y: number;
  left: number;
  top: number;
}>({
  active: false,
  item: null,
  row: null,
  rect: null,
  value: 0,
  y: 0,
  left: 0,
  top: 0,
});

const sheetStart = computed(() => isoOrClockToClock(props.record.anesthesiaStart ?? props.record.actualStart ?? props.record.plannedStart) || '08:00');
const sheetEnd = computed(() => calculateLiveSheetEnd(sheetStart.value, collectRecordTimes(props.record)));
const timeScale = computed(() => buildLiveTimeScale(sheetStart.value, sheetEnd.value));
const sheetAnesthesiaMethod = computed(() => props.appliedMethodLabels.length ? props.appliedMethodLabels.join(' + ') : props.record.anesthesiaMethod);
const gridBackgroundStyle = computed(() => ({ '--minor-count': Math.max(1, timeScale.value.minorTicks.length - 1) }));
const bandGrid = (rows: number) => buildRecordBandGrid(timeScale.value, rows);
const chartGrid = computed(() => buildRecordBandGrid(timeScale.value, 8));
const professionalFieldGroups = computed(() => {
  const fields = props.templateImpact?.professionalFields.length
    ? props.templateImpact.professionalFields
    : props.appliedModules.flatMap((module) => module.sections.flatMap((section) => section.items.map((item) => ({
      group: section.title,
      label: item.label,
      value: item.value,
      method: module.key,
    }))));
  const grouped = new Map<string, Array<{ label: string; value: string }>>();
  fields.forEach((field) => {
    if (!grouped.has(field.group)) grouped.set(field.group, []);
    grouped.get(field.group)?.push({ label: field.label, value: field.value });
  });
  return Array.from(grouped.entries()).map(([title, items]) => ({ title, items }));
});
const templateQualityTips = computed(() => props.templateImpact?.qualityTips ?? []);
const templateEventRows = computed(() => (props.templateImpact?.events ?? []).map((event, index) => ({
  id: `template-event-${index}-${event.name}`,
  type: event.name,
  time: event.time,
  source: event,
})));
const visibleVitals = computed(() => [...props.record.vitals].sort((a, b) => isoOrClockToClock(a.time).localeCompare(isoOrClockToClock(b.time))));
const enabledVitalItems = computed(() => props.vitals.filter((item) => item.enabled));
const selectedMonitorItems = computed(() => selectedMonitorCodes.value
  .map((code) => enabledVitalItems.value.find((item) => item.shortCode === code))
  .filter((item): item is VitalSignDictItem => Boolean(item)));
const availableMonitorItems = computed(() => enabledVitalItems.value.filter((item) => !selectedMonitorCodes.value.includes(item.shortCode)));
const monitorRows = computed(() => {
  const selected = selectedMonitorCodes.value.length ? selectedMonitorCodes.value : enabledVitalItems.value.slice(0, 8).map((item) => item.shortCode);
  const selectedWithTemplate = Array.from(new Set([...(props.templateImpact?.monitorCodes ?? []), ...selected]));
  return selectedWithTemplate
    .map((code) => enabledVitalItems.value.find((item) => item.shortCode === code))
    .filter((item): item is VitalSignDictItem => Boolean(item))
    .slice(0, 10);
});
const monitorOrderCodes = computed(() => monitorRows.value.map((item) => item.shortCode));
const chartVitals = computed(() => monitorRows.value.filter((item) => item.chartEnabled));
const chartTicks = computed(() => [220, 200, 180, 160, 140, 120, 100, 80, 60, 40, 20].map((value) => ({ value, top: (chartYWithPadding(value, { min: 20, max: 220, height: 300, padding: 18 }) / 300) * 100 })));
const respiratoryTicks = computed(() => [26, 24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4, 2].map((value) => ({ value, top: (chartYWithPadding(value, { min: 2, max: 26, height: 300, padding: 18 }) / 300) * 100 })));
const infusionCatalog = computed(() => props.fluids.filter((item) => item.enabled && item.subCategory !== '血液制品'));
const bloodCatalog = computed(() => props.fluids.filter((item) => item.enabled && item.subCategory === '血液制品'));
const commonDrugs = computed(() => props.drugs.filter((item) => item.enabled && item.common).slice(0, 8));
const otherDrugs = computed(() => props.drugs.filter((item) => item.enabled && !item.common));
const bloodLabel = computed(() => props.record.fluids.find((item) => item.category === '血液制品' && item.bloodType)?.bloodType ?? '-');
const planeRowOffset = computed(() => props.showAnesthesiaPlane ? 1 : 0);
const planeRows = computed(() => (props.showAnesthesiaPlane ? (props.record.anesthesiaPlanes ?? []) : []).map((item) => ({
  key: item.id,
  label: `${item.level}${planeDirectionText(item.direction)}`,
  time: item.time,
  source: item,
})));
const medicationRowCount = computed(() => Math.max(5, medicationRows.value.length + planeRowOffset.value));
const infusionRowCount = computed(() => Math.max(3, infusionRows.value.length));
const transfusionRowCount = computed(() => Math.max(2, transfusionRows.value.length));
const monitorRowCount = computed(() => Math.max(4, monitorRows.value.length));
const balanceSummary = computed(() => buildBalanceSummary(props.record));
const referenceLegendItems = computed(() => chartVitals.value.map((item) => ({
  ...item,
  legendLabel: item.shortCode === 'SBP' ? '有创血压'
    : item.shortCode === 'DBP' ? '无创血压'
      : item.shortCode === 'HR' ? '心'
        : item.shortCode === 'RR' ? '呼'
          : item.shortCode === 'TEMP' ? '体温'
            : item.shortCode,
})));
const eventLegend = [
  { symbol: 'X', label: '麻醉开始' },
  { symbol: 'Θ', label: '麻醉拔管' },
  { symbol: '*', label: '麻醉结束' },
  { symbol: '◎', label: '手术开始' },
  { symbol: 'Ⓞ', label: '手术结束' },
  { symbol: 'Φ', label: '麻醉插管' },
];
const monitorCells = computed(() => buildMonitorCells(visibleVitals.value, monitorRows.value, monitorOrderCodes.value, {
  start: sheetStart.value,
  end: sheetEnd.value,
  cellOffsetPercent: Math.min(1.2, Math.max(0.35, 45 / Math.max(180, timeScale.value.totalMinutes))),
}));
const hasLineTarget = computed(() => ['plane', 'medication', 'infusion', 'transfusion', 'vital', 'output'].includes(menu.type) && Boolean(menu.target));
const showPlaneMenus = computed(() => props.showAnesthesiaPlane && ['grid', 'planeGrid', 'plane', 'drugGrid'].includes(menu.type));
const showDrugMenus = computed(() => ['grid', 'drugGrid', 'medication'].includes(menu.type));
const showFluidMenus = computed(() => ['grid', 'infusionGrid', 'transfusionGrid', 'infusion', 'transfusion'].includes(menu.type));
const showVitalMenus = computed(() => ['grid', 'monitor', 'chart', 'vital'].includes(menu.type));
const showOutputMenus = computed(() => ['grid', 'balance', 'output'].includes(menu.type));
const defaultDataList = computed(() => {
  if (['medication', 'drugGrid'].includes(menu.type)) return 'medications';
  if (['plane', 'planeGrid'].includes(menu.type)) return 'planes';
  if (['infusion', 'infusionGrid'].includes(menu.type)) return 'infusions';
  if (['transfusion', 'transfusionGrid'].includes(menu.type)) return 'transfusions';
  if (['monitor', 'chart', 'vital'].includes(menu.type)) return 'vitals';
  return 'outputs';
});
const dataTabs = computed(() => ([
  { key: 'planes', label: '麻醉平面' },
  { key: 'medications', label: '用药' },
  { key: 'infusions', label: '输液' },
  { key: 'transfusions', label: '输血' },
  { key: 'vitals', label: '生命体征' },
  { key: 'outputs', label: '出入量' },
] as const).filter((item) => props.showAnesthesiaPlane || item.key !== 'planes'));

watch([enabledVitalItems, () => props.monitorOrder], ([items, order]) => {
  const enabledCodes = items.map((item) => item.shortCode);
  const saved = (order as string[]).filter((code) => enabledCodes.includes(code));
  const fallback = items.slice(0, 8).map((item) => item.shortCode);
  if (!selectedMonitorCodes.value.length || saved.length) selectedMonitorCodes.value = saved.length ? saved : fallback;
}, { immediate: true });

const templateMedicationSources = computed<MedicationRecord[]>(() => (props.templateImpact?.medications ?? []).map((item: TemplateImpactMedication, index) => ({
  id: `template-med-${index}-${item.drug}`,
  mode: item.mode ?? '单次用药',
  time: item.time,
  startTime: item.mode === '持续泵入' ? item.time : undefined,
  endTime: item.endTime,
  stopTime: item.endTime,
  drug: item.drug,
  name: item.drug,
  dose: item.dose,
  unit: item.unit,
  route: item.route,
  executor: props.record.anesthesiologist,
  pumpRate: item.pumpRate,
  reason: props.appliedTemplateName ? `模板落单：${props.appliedTemplateName}` : '模板落单',
})));
const medicationRows = computed(() => [...props.record.medications, ...templateMedicationSources.value].map((item, index) => ({
  key: item.id,
  label: item.drug,
  amount: item.mode === '持续泵入' ? (item.pumpRate || `${item.dose ?? ''}${item.unit ?? ''}`) : `${item.dose ?? ''}${item.unit ?? ''}`,
  time: item.time ?? item.startTime ?? props.record.plannedStart,
  end: item.stopTime ?? item.endTime,
  index: index + planeRowOffset.value,
  source: item,
  template: item.id.startsWith('template-med-'),
})));
const infusionRows = computed(() => props.record.fluids.filter((item) => item.category !== '血液制品').map((item, index) => ({
  key: item.id,
  label: item.name,
  amount: `${item.volume}${item.unit ?? 'ml'}`,
  time: item.startTime ?? item.time ?? props.record.plannedStart,
  end: item.endTime,
  index,
  source: item,
})));
const transfusionRows = computed(() => props.record.fluids.filter((item) => item.category === '血液制品').map((item, index) => {
  const dict = props.fluids.find((fluid) => fluid.name === item.name);
  return {
    key: item.id,
    label: item.name,
    amount: `${item.volume}${item.unit ?? dict?.defaultUnit ?? 'U'}`,
    time: item.startTime ?? item.time ?? props.record.plannedStart,
    end: item.endTime,
    index,
    source: item,
  };
}));
const outputRows = computed(() => {
  const records = props.record.outputRecords?.length
    ? props.record.outputRecords
    : [
      { id: 'summary-urine', time: props.record.surgeryEnd ?? props.record.leaveRoomTime ?? props.record.plannedStart, type: '尿量' as const, volume: props.record.outputs.urine },
      { id: 'summary-blood', time: props.record.surgeryEnd ?? props.record.leaveRoomTime ?? props.record.plannedStart, type: '出血量' as const, volume: props.record.outputs.bloodLoss },
      { id: 'summary-drainage', time: props.record.surgeryEnd ?? props.record.leaveRoomTime ?? props.record.plannedStart, type: '引流量' as const, volume: props.record.outputs.drainage },
    ];
  const indexByType: Record<OutputDetailRecord['type'], number> = { 尿量: 0, 出血量: 1, 引流量: 2, 其他: 3 };
  return records.map((row) => ({ id: row.id, time: row.time, volume: row.volume, index: indexByType[row.type], source: row }));
});
const symbolForEvent = (type: string) => (type.includes('入室') ? '>' : type.includes('麻醉开始') ? 'X' : type.includes('麻醉结束') ? '*' : type.includes('手术开始') ? '◎' : type.includes('手术结束') ? 'Ⓞ' : type.includes('插管') ? 'Φ' : type.includes('喉罩') ? '罩' : type.includes('穿刺') ? '针' : type.includes('平面') ? 'T' : type.includes('阻滞') ? 'B' : type.includes('拔管') ? 'Θ' : type.includes('离室') ? '▶' : '•');
const templateStatusEvents = computed(() => (props.templateImpact?.events ?? []).map((event: TemplateImpactEvent, index) => ({
  id: `template-status-${index}-${event.name}`,
  type: event.name,
  time: event.time,
  stage: event.stage,
  severity: event.severity,
  treatment: event.note,
  staff: [props.record.anesthesiologist],
  reported: false,
  qualityIncluded: event.severity !== '轻度',
  symbol: symbolForEvent(event.name),
  className: event.severity === '危急' || event.severity === '重度' ? 'is-critical is-template' : 'is-template',
})));
const statusEvents = computed(() => [
  ...props.record.events.map((event) => ({
    ...event,
    symbol: symbolForEvent(event.type),
    className: `${event.severity === '危急' || event.severity === '重度' ? 'is-critical' : ''}${props.recentEventLabel.startsWith(event.type) ? ' is-recent' : ''}`.trim(),
  })),
  ...templateStatusEvents.value,
]);
const medSummary = computed(() => medicationRows.value.slice(0, 4).map((item) => `${item.label}${item.amount}`).join('、') || '待记录');
const eventSummary = computed(() => statusEvents.value.filter((item) => item.severity === '重度' || item.severity === '危急').map((item) => item.type).join('、') || '无特殊事件');
const operationSummary = computed(() => statusEvents.value.filter((item) => ['手术开始', '手术结束', '插管', '拔管', '喉罩', '穿刺', '阻滞'].some((key) => item.type.includes(key))).map((item) => item.type).join('、') || eventSummary.value);
const postopAnalgesiaSummary = computed(() => (props.record.postoperativeAnalgesia ? `镇痛方式：${props.record.recoveryRecord?.conclusion ?? '待记录'}` : '未启用'));

const formatDate = (value?: string) => (value ? dayjs(value).format('YYYY-MM-DD') : '-');
const planeDirectionText = (direction?: AnesthesiaPlaneRecord['direction']) => direction === 'up' ? '↑' : direction === 'fixed' ? '－' : '↓';
const topFor = (index: number, total: number) => `${((index + 0.5) / Math.max(total, 1)) * 100}%`;
const leftFor = (time?: string) => `${timeToPercent(time, sheetStart.value, sheetEnd.value)}%`;
const pointStyle = (time: string | undefined, index: number, total: number) => ({ left: leftFor(time), top: topFor(index, total) });
const segmentStyle = (start: string | undefined, end: string | undefined, index: number, total: number) => {
  const left = timeToPercent(start, sheetStart.value, sheetEnd.value);
  const right = end ? timeToPercent(end, sheetStart.value, sheetEnd.value) : Math.min(100, left + 10);
  return { left: `${left}%`, top: topFor(index, total), width: `${Math.max(4, right - left)}%` };
};
const previewSegmentTimes = (event: PointerEvent) => {
  if (!dragState.active || !dragState.source) return null;
  const deltaPercent = ((event.clientX - dragState.startX) / dragState.width) * 100;
  const targetPercent = ((event.clientX - dragState.left) / dragState.width) * 100;
  if (dragState.kind === 'medication') {
    const source = dragState.source as MedicationRecord;
    return dragTimeSegment(
      { start: isoOrClockToClock(source.time ?? source.startTime), end: isoOrClockToClock(source.stopTime ?? source.endTime) || isoOrClockToClock(source.time ?? source.startTime) },
      { mode: dragState.mode, deltaPercent, targetPercent, sheetStart: sheetStart.value, sheetEnd: sheetEnd.value },
    );
  }
  const source = dragState.source as FluidRecord;
  return dragTimeSegment(
    { start: isoOrClockToClock(source.startTime ?? source.time), end: isoOrClockToClock(source.endTime) || isoOrClockToClock(source.startTime ?? source.time) },
    { mode: dragState.mode, deltaPercent, targetPercent, sheetStart: sheetStart.value, sheetEnd: sheetEnd.value },
  );
};
const updateSegmentDragPreview = (event: PointerEvent) => {
  const moved = previewSegmentTimes(event);
  if (!moved || !dragState.source) return;
  segmentDragPreview.active = true;
  segmentDragPreview.band = dragState.band;
  segmentDragPreview.style = segmentStyle(moved.start, moved.end, dragState.rowIndex, dragState.rowTotal);
  const source = dragState.source as MedicationRecord & FluidRecord;
  segmentDragPreview.label = dragState.kind === 'medication'
    ? `${source.drug ?? source.name ?? ''} ${moved.start}-${moved.end}`
    : `${source.name ?? ''} ${moved.start}-${moved.end}`;
};
const isAbnormal = (row: VitalSign, item: VitalSignDictItem) => {
  const value = row[item.shortCode as keyof VitalSign];
  if (typeof value !== 'number') return false;
  return (typeof item.lowerLimit === 'number' && value < item.lowerLimit) || (typeof item.upperLimit === 'number' && value > item.upperLimit);
};
const chartY = (value: number, item?: VitalSignDictItem) => {
  if (item?.shortCode === 'RR') return chartYWithPadding(value, { min: 2, max: 26, height: 300, padding: 18 });
  if (item?.shortCode === 'TEMP') return chartYWithPadding(value, { min: 33, max: 39, height: 300, padding: 18 });
  return chartYWithPadding(value, { min: 20, max: 220, height: 300, padding: 18 });
};
const chartPoints = (item: VitalSignDictItem) => visibleVitals.value
  .map((row) => ({ row, value: row[item.shortCode as keyof VitalSign] }))
  .filter((entry): entry is { row: VitalSign; value: number } => typeof entry.value === 'number')
  .map((entry) => ({
    key: `${entry.row.id ?? entry.row.time}-${item.shortCode}`,
    row: entry.row,
    x: Math.min(988, Math.max(12, timeToPercent(entry.row.time, sheetStart.value, sheetEnd.value) * 10)),
    y: chartY(entry.value, item),
  }));
const chartLine = (item: VitalSignDictItem) => chartPoints(item).map((point) => `${point.x},${point.y}`).join(' ');
const symbolText = (symbol?: string) => ({ 'triangle-down': '▽', 'triangle-up': '△', circle: '●', 'hollow-circle': '○', diamond: '◇', star: '★', square: '■', text: '•' }[symbol ?? 'text']);
const markerPath = (item: VitalSignDictItem, x: number, y: number) => {
  const marker = vitalMarkerShape(item);
  if (marker.shape === 'triangle-down') return `M ${x - 5} ${y - 4} L ${x + 5} ${y - 4} L ${x} ${y + 6} Z`;
  if (marker.shape === 'triangle-up') return `M ${x - 5} ${y + 5} L ${x + 5} ${y + 5} L ${x} ${y - 5} Z`;
  if (marker.shape === 'square') return `M ${x - 5} ${y - 5} H ${x + 5} V ${y + 5} H ${x - 5} Z`;
  if (marker.shape === 'diamond') return `M ${x} ${y - 6} L ${x + 6} ${y} L ${x} ${y + 6} L ${x - 6} ${y} Z`;
  if (marker.shape === 'hollow-circle' || marker.shape === 'circle') {
    return `M ${x} ${y - 5} A 5 5 0 1 1 ${x - 0.01} ${y - 5} Z`;
  }
  return `M ${x - 5} ${y} H ${x + 5} M ${x} ${y - 5} V ${y + 5}`;
};
const markerFill = (item: VitalSignDictItem) => vitalMarkerShape(item).fill ? (item.chartColor ?? '#2563eb') : '#fff';

const eventClock = (event: MouseEvent) => {
  const element = event.currentTarget as HTMLElement;
  const track = element.classList.contains('band-track') || element.classList.contains('chart-area')
    ? element
    : element.closest('.band-track,.chart-area') as HTMLElement | null;
  if (!track) return sheetStart.value;
  const rect = track.getBoundingClientRect();
  const percent = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 100;
  return percentToTime(percent, sheetStart.value, sheetEnd.value);
};
const openMenu = (event: MouseEvent, type: MenuType, target: unknown = null) => {
  menu.visible = true;
  menu.x = Math.min(event.clientX, window.innerWidth - 260);
  menu.y = Math.min(event.clientY, window.innerHeight - 360);
  menu.type = type;
  menu.target = target;
  menu.at = eventClock(event);
};
const closeMenu = () => { menu.visible = false; };

const applyLineDraft = (draft: ReturnType<typeof createMedicationLineDraft> | ReturnType<typeof createFluidLineDraft>) => {
  lineForm.kind = draft.kind;
  lineForm.id = draft.id ?? '';
  lineForm.name = draft.name;
  lineForm.mode = draft.mode ?? '单次用药';
  lineForm.category = draft.category ?? '晶体液';
  lineForm.time = draft.time;
  lineForm.endTime = draft.endTime ?? '';
  lineForm.amount = Number(draft.amount) || 0;
  lineForm.unit = draft.unit ?? '';
  lineForm.route = draft.route ?? '';
  lineForm.executor = draft.executor ?? props.record.anesthesiologist;
  lineForm.checker = draft.checker ?? '';
  lineForm.highAlert = Boolean(draft.highAlert);
  lineForm.bloodType = draft.bloodType ?? '';
  lineForm.rh = draft.rh ?? '';
  lineForm.reaction = draft.reaction ?? '无';
  lineForm.bagNo = draft.bagNo ?? '';
  lineForm.anesthesiaConfirmed = Boolean(draft.anesthesiaConfirm);
  lineForm.circulatingConfirmed = Boolean(draft.circulatingConfirm);
};
const openMedicationEditor = (source?: DrugDictItem | MedicationRecord) => {
  closeMenu();
  if (source && 'drug' in source) {
    applyLineDraft({
      kind: 'medication',
      id: source.id,
      name: source.drug,
      mode: source.mode,
      time: isoOrClockToClock(source.time ?? source.startTime) || menu.at || sheetStart.value,
      endTime: isoOrClockToClock(source.stopTime ?? source.endTime),
      amount: source.dose,
      unit: source.unit,
      route: source.route,
      executor: source.executor,
      checker: source.checker,
      highAlert: source.highAlert,
    });
  } else if (source) {
    applyLineDraft(createMedicationLineDraft(source, { at: menu.at || sheetStart.value, executor: props.record.anesthesiologist }));
  } else {
    const fallback = commonDrugs.value[0] ?? props.drugs.find((item) => item.enabled);
    if (fallback) applyLineDraft(createMedicationLineDraft(fallback, { at: menu.at || sheetStart.value, executor: props.record.anesthesiologist }));
  }
  lineVisible.value = true;
};
const openFluidEditor = (source?: FluidBloodDictItem | FluidRecord) => {
  closeMenu();
  if (source && 'startTime' in source) {
    applyLineDraft({
      kind: source.category === '血液制品' ? 'transfusion' : 'infusion',
      id: source.id,
      name: source.name,
      category: source.category,
      time: isoOrClockToClock(source.startTime ?? source.time) || menu.at || sheetStart.value,
      endTime: isoOrClockToClock(source.endTime),
      amount: source.volume,
      unit: source.unit,
      executor: source.executor,
      bloodType: source.bloodType,
      rh: source.rh,
      reaction: source.reaction,
      bagNo: source.bagNo,
      anesthesiaConfirm: source.anesthesiaConfirm,
      circulatingConfirm: source.circulatingConfirm,
      doubleCheck: source.doubleCheck,
    });
    lineForm.anesthesiaConfirmed = Boolean(source.anesthesiaConfirm || source.doubleCheck);
    lineForm.circulatingConfirmed = Boolean(source.circulatingConfirm || source.doubleCheck);
  } else if (source) {
    applyLineDraft(createFluidLineDraft(source, {
      at: menu.at || sheetStart.value,
      executor: props.record.anesthesiaNurse,
      bloodType: props.bloodTypes[0],
      rh: props.rhTypes[0],
    }));
  } else {
    const fallback = menu.type === 'transfusionGrid' ? bloodCatalog.value[0] : infusionCatalog.value[0];
    if (fallback) applyLineDraft(createFluidLineDraft(fallback, { at: menu.at || sheetStart.value, executor: props.record.anesthesiaNurse }));
  }
  lineVisible.value = true;
};
const syncMedicationForm = () => {
  const drug = props.drugs.find((item) => item.name === lineForm.name);
  if (!drug) return;
  const id = lineForm.id;
  applyLineDraft(createMedicationLineDraft(drug, { at: lineForm.time, executor: lineForm.executor }));
  lineForm.id = id;
};
const syncFluidForm = () => {
  const fluid = props.fluids.find((item) => item.name === lineForm.name);
  if (!fluid) return;
  const id = lineForm.id;
  applyLineDraft(createFluidLineDraft(fluid, { at: lineForm.time, executor: lineForm.executor, bloodType: lineForm.bloodType, rh: lineForm.rh }));
  lineForm.id = id;
};
const openPlaneEditor = (source?: AnesthesiaPlaneRecord) => {
  closeMenu();
  const draft = createAnesthesiaPlaneDraft(source, { at: menu.at || sheetStart.value });
  planeForm.id = draft.id ?? '';
  planeForm.time = draft.time;
  planeForm.level = draft.level;
  planeForm.direction = draft.direction;
  planeForm.remark = draft.remark ?? '';
  planeVisible.value = true;
};
const savePlaneForm = () => {
  emit('savePlane', {
    id: planeForm.id,
    time: planeForm.time,
    level: planeForm.level,
    direction: planeForm.direction,
    remark: planeForm.remark,
  });
  planeVisible.value = false;
};
const saveLineForm = () => {
  if (lineForm.kind === 'medication') {
    emit('saveMedication', {
      id: lineForm.id,
      mode: lineForm.mode,
      time: lineForm.time,
      startTime: lineForm.time,
      endTime: lineForm.mode === '持续泵入' ? lineForm.endTime : undefined,
      stopTime: lineForm.mode === '持续泵入' ? lineForm.endTime : undefined,
      drug: lineForm.name,
      name: lineForm.name,
      dose: Number(lineForm.amount) || undefined,
      unit: lineForm.unit,
      route: lineForm.route,
      executor: lineForm.executor,
      checker: lineForm.checker,
      highAlert: lineForm.highAlert,
    });
  } else {
    const isBlood = lineForm.kind === 'transfusion';
    emit('saveFluid', {
      id: lineForm.id,
      category: isBlood ? '血液制品' : lineForm.category,
      name: lineForm.name,
      product: isBlood ? lineForm.name : undefined,
      startTime: lineForm.time,
      time: lineForm.time,
      endTime: lineForm.endTime,
      volume: Number(lineForm.amount) || 0,
      unit: lineForm.unit,
      executor: lineForm.executor,
      bloodType: isBlood ? lineForm.bloodType : undefined,
      rh: isBlood ? lineForm.rh : undefined,
      reaction: isBlood ? lineForm.reaction : undefined,
      bagNo: isBlood ? lineForm.bagNo : undefined,
      anesthesiaConfirm: isBlood && lineForm.anesthesiaConfirmed ? props.record.anesthesiologist : '',
      circulatingConfirm: isBlood && lineForm.circulatingConfirmed ? props.record.anesthesiaNurse : '',
      doubleCheck: isBlood ? lineForm.anesthesiaConfirmed && lineForm.circulatingConfirmed : true,
    });
  }
  lineVisible.value = false;
};
const openTargetEditor = () => {
  if (menu.type === 'plane') openPlaneEditor(menu.target as AnesthesiaPlaneRecord);
  if (menu.type === 'medication') openMedicationEditor(menu.target as MedicationRecord);
  if (menu.type === 'infusion' || menu.type === 'transfusion') openFluidEditor(menu.target as FluidRecord);
  if (menu.type === 'vital') openMonitorDialog(menu.target as VitalSign);
  if (menu.type === 'output') openOutputEditor(menu.target as OutputDetailRecord);
};
const continueTarget = () => {
  if (menu.type === 'medication') {
    const source = menu.target as MedicationRecord;
    openMedicationEditor({ ...source, id: '', time: isoOrClockToClock(source.stopTime ?? source.endTime) || menu.at });
  }
  if (menu.type === 'infusion') {
    const source = menu.target as FluidRecord;
    openFluidEditor({ ...source, id: '', startTime: isoOrClockToClock(source.endTime) || menu.at });
  }
};
const deleteTarget = () => {
  if (!hasLineTarget.value) return;
  const target = menu.target as { id?: string };
  if (!target.id) return;
  if (menu.type === 'medication') emit('deleteRecord', 'medication', target.id);
  if (menu.type === 'plane') emit('deleteRecord', 'plane', target.id);
  if (menu.type === 'infusion' || menu.type === 'transfusion') emit('deleteRecord', 'fluid', target.id);
  if (menu.type === 'vital') emit('deleteRecord', 'vital', target.id);
  if (menu.type === 'output') emit('deleteRecord', 'output', target.id);
  closeMenu();
};

const openMonitorDialog = (row?: VitalSign) => {
  closeMenu();
  monitorBatch.value = false;
  monitorVisible.value = true;
  monitorForm.id = row?.id ?? '';
  monitorForm.time = isoOrClockToClock(row?.time) || menu.at || sheetStart.value;
  monitorForm.source = row?.source ?? '手工录入';
  monitorForm.remark = row?.remark ?? '';
  Object.keys(monitorValues).forEach((key) => delete monitorValues[key]);
  monitorRows.value.forEach((item) => {
    const value = row?.[item.shortCode as keyof VitalSign];
    monitorValues[item.shortCode] = value == null ? '' : String(value);
  });
};
const openBatchMonitorDialog = () => {
  openMonitorDialog();
  monitorBatch.value = true;
  monitorEndTime.value = minutesToClock((clockToMinutes(monitorForm.time) ?? 0) + 15);
};
const saveOneVital = (time: string, id = '') => {
  const payload: VitalSign & Record<string, unknown> = { id: id || undefined, time, source: monitorForm.source as VitalSign['source'], remark: monitorForm.remark };
  monitorRows.value.forEach((item) => {
    const raw = monitorValues[item.shortCode];
    const numeric = Number(raw);
    payload[item.shortCode] = raw === '' ? undefined : Number.isFinite(numeric) ? numeric : raw;
  });
  emit('saveVital', payload);
};
const saveMonitorForm = () => {
  if (monitorBatch.value) {
    const start = clockToMinutes(monitorForm.time) ?? 0;
    const end = Math.max(start, clockToMinutes(monitorEndTime.value) ?? start);
    for (let minute = start; minute <= end; minute += Math.max(1, monitorInterval.value)) saveOneVital(minutesToClock(minute));
  } else {
    saveOneVital(monitorForm.time, monitorForm.id);
  }
  monitorVisible.value = false;
};
const shiftClockValue = (value: string, deltaMinutes: number) => minutesToClock((clockToMinutes(value) ?? clockToMinutes(sheetStart.value) ?? 0) + deltaMinutes);
const shiftMonitorTime = (field: 'time' | 'end', deltaSteps: number) => {
  const delta = deltaSteps * 1;
  if (field === 'time') monitorForm.time = shiftClockValue(monitorForm.time, delta);
  else monitorEndTime.value = shiftClockValue(monitorEndTime.value, delta);
};
const shiftOutputTime = (deltaSteps: number) => { outputForm.time = shiftClockValue(outputForm.time, deltaSteps); };
const shiftPlaneTime = (deltaSteps: number) => { planeForm.time = shiftClockValue(planeForm.time, deltaSteps); };
const openOutputEditor = (row?: OutputDetailRecord) => {
  closeMenu();
  outputVisible.value = true;
  outputForm.id = row?.id ?? '';
  outputForm.time = isoOrClockToClock(row?.time) || menu.at || sheetStart.value;
  outputForm.type = row?.type ?? '尿量';
  outputForm.volume = row?.volume ?? 0;
  outputForm.remark = row?.remark ?? '';
};
const saveOutputForm = () => {
  emit('saveOutput', { id: outputForm.id, time: outputForm.time, type: outputForm.type, volume: Number(outputForm.volume) || 0, remark: outputForm.remark });
  outputVisible.value = false;
};
const openDataList = (key: typeof activeDataList.value) => {
  closeMenu();
  activeDataList.value = key;
  dataVisible.value = true;
};
const persistMonitorOrder = () => emit('saveMonitorOrder', selectedMonitorCodes.value);
const toggleMonitorCode = (code: string) => {
  selectedMonitorCodes.value = selectedMonitorCodes.value.includes(code)
    ? selectedMonitorCodes.value.filter((item) => item !== code)
    : [...selectedMonitorCodes.value, code];
  persistMonitorOrder();
};
const moveMonitorCode = (code: string, mode: 'up' | 'down' | 'drop') => {
  const next = mode === 'drop'
    ? moveMonitorItemOrder(selectedMonitorCodes.value, draggedMonitorCode.value, 'to-index', selectedMonitorCodes.value.indexOf(code))
    : moveMonitorItemOrder(selectedMonitorCodes.value, code, mode);
  selectedMonitorCodes.value = next;
  draggedMonitorCode.value = '';
  persistMonitorOrder();
};
const closeObserveSetting = () => {
  persistMonitorOrder();
  observeVisible.value = false;
};
const startSegmentDrag = (event: PointerEvent, kind: 'medication' | 'fluid', source: MedicationRecord | FluidRecord, mode: 'move' | 'start' | 'end', rowIndex = 0, rowTotal = 1) => {
  if (props.readOnly || event.button !== 0) return;
  const track = (event.currentTarget as HTMLElement).closest('.band-track');
  if (!track) return;
  const rect = track.getBoundingClientRect();
  dragState.active = true;
  dragState.kind = kind;
  dragState.band = kind === 'medication' ? 'medication' : (source as FluidRecord).category === '血液制品' ? 'transfusion' : 'infusion';
  dragState.mode = mode;
  dragState.source = source;
  dragState.startX = event.clientX;
  dragState.left = rect.left;
  dragState.width = Math.max(1, rect.width);
  dragState.rowIndex = rowIndex;
  dragState.rowTotal = rowTotal;
  updateSegmentDragPreview(event);
  window.addEventListener('pointermove', updateSegmentDragPreview);
  window.addEventListener('pointerup', finishSegmentDrag, { once: true });
};
const vitalDragRange = (item: VitalSignDictItem) => {
  if (item.shortCode === 'RR') return { min: 2, max: 26, height: 300, padding: 18 };
  if (item.shortCode === 'TEMP') return { min: 33, max: 39, height: 300, padding: 18 };
  return { min: 20, max: 220, height: 300, padding: 18 };
};
const updateVitalDragPreview = (event: PointerEvent) => {
  if (!vitalDragState.active || !vitalDragState.item || !vitalDragState.rect) return;
  const rect = vitalDragState.rect;
  const y = Math.max(0, Math.min(300, ((event.clientY - rect.top) / Math.max(1, rect.height)) * 300));
  vitalDragState.value = dragVitalPointValue(y, vitalDragState.item, vitalDragRange(vitalDragState.item));
  vitalDragState.y = (y / 300) * rect.height;
  vitalDragState.left = Math.max(8, Math.min(rect.width - 120, event.clientX - rect.left + 8));
  vitalDragState.top = Math.max(4, Math.min(rect.height - 28, vitalDragState.y - 26));
};
const finishVitalPointDrag = (event: PointerEvent) => {
  updateVitalDragPreview(event);
  if (vitalDragState.active && vitalDragState.item && vitalDragState.row) {
    const payload = {
      ...vitalDragState.row,
      [vitalDragState.item.shortCode]: clampVitalValueByDict(vitalDragState.value, vitalDragState.item),
      source: '手工修正' as const,
    };
    emit('saveVital', payload);
  }
  vitalDragState.active = false;
  vitalDragState.item = null;
  vitalDragState.row = null;
  vitalDragState.rect = null;
  window.removeEventListener('pointermove', updateVitalDragPreview);
};
const startVitalPointDrag = (event: PointerEvent, item: VitalSignDictItem, row: VitalSign) => {
  if (props.readOnly || event.button !== 0) return;
  const rect = chartAreaRef.value?.getBoundingClientRect();
  if (!rect) return;
  vitalDragState.active = true;
  vitalDragState.item = item;
  vitalDragState.row = row;
  vitalDragState.rect = rect;
  updateVitalDragPreview(event);
  window.addEventListener('pointermove', updateVitalDragPreview);
  window.addEventListener('pointerup', finishVitalPointDrag, { once: true });
};
const finishSegmentDrag = (event: PointerEvent) => {
  if (!dragState.active || !dragState.source) return;
  updateSegmentDragPreview(event);
  const deltaPercent = ((event.clientX - dragState.startX) / dragState.width) * 100;
  const targetPercent = ((event.clientX - dragState.left) / dragState.width) * 100;
  if (dragState.mode === 'move' && Math.abs(deltaPercent) < 0.2) {
    dragState.active = false;
    dragState.source = null;
    segmentDragPreview.active = false;
    window.removeEventListener('pointermove', updateSegmentDragPreview);
    return;
  }
  if (dragState.kind === 'medication') {
    const source = dragState.source as MedicationRecord;
    const moved = dragTimeSegment(
      { start: isoOrClockToClock(source.time ?? source.startTime), end: isoOrClockToClock(source.stopTime ?? source.endTime) || isoOrClockToClock(source.time ?? source.startTime) },
      { mode: dragState.mode, deltaPercent, targetPercent, sheetStart: sheetStart.value, sheetEnd: sheetEnd.value },
    );
    emit('saveMedication', {
      ...source,
      time: moved.start,
      startTime: moved.start,
      endTime: source.mode === '持续泵入' ? moved.end : undefined,
      stopTime: source.mode === '持续泵入' ? moved.end : undefined,
    });
  } else {
    const source = dragState.source as FluidRecord;
    const moved = dragTimeSegment(
      { start: isoOrClockToClock(source.startTime ?? source.time), end: isoOrClockToClock(source.endTime) || isoOrClockToClock(source.startTime ?? source.time) },
      { mode: dragState.mode, deltaPercent, targetPercent, sheetStart: sheetStart.value, sheetEnd: sheetEnd.value },
    );
    emit('saveFluid', { ...source, startTime: moved.start, time: moved.start, endTime: moved.end });
  }
  dragState.active = false;
  dragState.source = null;
  segmentDragPreview.active = false;
  window.removeEventListener('pointermove', updateSegmentDragPreview);
};
onBeforeUnmount(() => {
  window.removeEventListener('pointerup', finishSegmentDrag);
  window.removeEventListener('pointermove', updateSegmentDragPreview);
  window.removeEventListener('pointermove', updateVitalDragPreview);
  window.removeEventListener('pointerup', finishVitalPointDrag);
});
</script>

<style scoped>
.live-record-card {
  position: relative;
  border: 2px solid #111827;
  background: #fff;
  color: #111827;
  font-family: "SimSun", "Microsoft YaHei", serif;
  overflow: auto;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.12);
}

.sheet-locked-ribbon {
  position: absolute;
  top: 44px;
  right: 18px;
  z-index: 8;
  padding: 3px 10px;
  border: 1px solid #c2410c;
  border-radius: 999px;
  background: #fff7ed;
  color: #9a3412;
  font-family: "Microsoft YaHei", sans-serif;
  font-size: 12px;
  font-weight: 700;
}

.print-heading {
  display: grid;
  grid-template-columns: 1fr 1.4fr 1fr;
  align-items: end;
  padding: 10px 12px 4px;
}

.print-heading h2 {
  margin: 0;
  text-align: center;
  font-size: 22px;
}

.doc-meta {
  display: flex;
  justify-content: flex-end;
  align-items: end;
  gap: 8px;
}

.doc-meta i {
  min-width: 70px;
  border-bottom: 1px solid #555;
  font-style: normal;
}

.doc-meta strong {
  font-size: 32px;
  line-height: 1;
}

.patient-lines {
  border-top: 1px solid #111827;
  border-bottom: 1px solid #111827;
  padding: 4px 10px;
  font-size: 12px;
}

.patient-lines div {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
  min-height: 24px;
  align-items: end;
}

.patient-lines div:nth-child(2) {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

.patient-lines span {
  border-bottom: 1px solid #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-professional-summary {
  display: grid;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid #111827;
  background: #fcfdff;
  font-size: 12px;
}

.sheet-professional-summary.has-impact {
  background: linear-gradient(90deg, #f0f7ff 0%, #ffffff 28%, #ffffff 100%);
}

.professional-summary-head {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.professional-summary-head strong {
  font-size: 13px;
}

.professional-summary-head span {
  padding-bottom: 1px;
  border-bottom: 1px solid #999;
}

.recent-event-pill {
  border: 1px solid #27c346;
  border-radius: 999px;
  padding: 2px 8px !important;
  background: #f0fff4;
  color: #15803d;
  font-family: "Microsoft YaHei", sans-serif;
}

.professional-paper-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 6px;
}

.professional-paper-group {
  min-width: 0;
  border: 1px solid #b9c6d5;
  background: #fff;
}

.professional-paper-group b {
  display: block;
  padding: 4px 6px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #1e293b;
}

.professional-paper-group dl {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  margin: 0;
}

.professional-paper-group dl div {
  display: grid;
  grid-template-columns: minmax(86px, 0.42fr) minmax(0, 1fr);
  min-height: 26px;
  border-right: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
}

.professional-paper-group dt,
.professional-paper-group dd {
  margin: 0;
  padding: 4px 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.professional-paper-group dt {
  border-right: 1px solid #e2e8f0;
  color: #475569;
}

.professional-paper-group dd {
  font-weight: 700;
}

.template-events p,
.quality-tips p {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin: 0;
  padding: 5px 6px;
}

.template-events span,
.quality-tips span {
  white-space: nowrap;
}

.tip-关注 {
  color: #c2410c;
}

.tip-预警 {
  color: #b91c1c;
  font-weight: 700;
}

@media (max-width: 1280px) {
  .professional-paper-grid {
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }
}

.sheet-ruler,
.sheet-band,
.vital-chart {
  display: grid;
  grid-template-columns: 140px 1fr;
  border-bottom: 1px solid #111827;
}

.ruler-label,
.band-side {
  display: grid;
  place-items: center;
  border-right: 1px solid #111827;
  background: #f8fafc;
  font-weight: 700;
}

.ruler-track,
.band-track,
.chart-area {
  position: relative;
  min-height: 32px;
}

.band-track,
.chart-area {
  background-image: linear-gradient(to right, rgba(100, 116, 139, 0.28) 1px, transparent 1px);
  background-repeat: repeat;
  background-size: calc(100% / var(--minor-count, 42)) 100%;
}

.ruler-track span,
.ruler-track i {
  position: absolute;
  top: 0;
  bottom: 0;
}

.ruler-track span {
  z-index: 4;
  transform: translateX(-50%);
  padding: 2px 4px;
  background: #fff;
  font-size: 12px;
}

.ruler-track i {
  border-left: 1px solid #9ca3af;
}

.ruler-track i.major {
  border-left-color: #111827;
}

.sheet-band {
  grid-template-columns: 28px 112px 1fr;
  min-height: calc(var(--rows, 3) * 22px);
}

.band-side {
  writing-mode: vertical-rl;
  letter-spacing: 2px;
}

.band-labels {
  display: grid;
  grid-template-rows: repeat(var(--rows, 3), minmax(0, 1fr));
  border-right: 1px solid #111827;
}

.band-labels span {
  display: grid;
  place-items: center;
  min-height: 22px;
  padding: 0 4px;
  border-bottom: 1px solid #b8c0cc;
  font-size: 12px;
  line-height: 1.15;
  text-align: center;
  overflow: hidden;
}

.band-track {
  min-height: calc(var(--rows, 3) * 22px);
}

.medication-band {
  min-height: 96px;
}

.monitor-band {
  min-height: 176px;
}

.print-grid-lines,
.print-row-lines,
.print-chart-horizontal-lines {
  position: absolute;
  inset: 0;
  display: block;
  pointer-events: none;
  z-index: 1;
}

:deep(.print-grid-lines span),
:deep(.print-row-lines span),
:deep(.print-chart-horizontal-lines span) {
  position: absolute;
  display: block;
  box-sizing: border-box;
}

:deep(.print-grid-lines span) {
  top: 0;
  bottom: 0;
  width: 0;
  border-left: 1px solid #94a3b8;
}

:deep(.print-grid-lines span.major) {
  border-left-color: #111827;
}

:deep(.print-row-lines span),
:deep(.print-chart-horizontal-lines span) {
  left: 0;
  right: 0;
  height: 0;
  border-top: 1px solid #aeb8c4;
}

.drug-point,
.blood-point,
.monitor-value,
.output-point,
.event-symbol {
  position: absolute;
  z-index: 3;
  transform: translate(-50%, -50%);
  max-width: 64px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.drug-point {
  padding: 0 4px;
  border: 1px solid #111827;
  background: #fef08a;
  font-weight: 700;
}

.drug-point.is-template {
  border-color: #165dff;
  background: #dbeafe;
  color: #0f3a8c;
}

.blood-point,
.output-point {
  color: #dc2626;
  font-weight: 700;
}

.output-marker {
  min-width: 34px;
  padding: 1px 5px;
  border: 1px solid rgba(220, 38, 38, 0.45);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.92);
  text-align: center;
  line-height: 1.2;
}

.monitor-value {
  z-index: 3;
  max-width: 34px;
  padding: 1px 3px;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  background: rgba(255, 255, 255, 0.86);
  color: #165dff;
  font-weight: 700;
  line-height: 1;
  pointer-events: auto;
  transform: translate(0, -50%);
}

.monitor-value.abnormal {
  color: #dc2626;
}

.line-segment {
  position: absolute;
  z-index: 3;
  transform: none;
  min-width: 24px;
  border-top: 3px solid #165dff;
  color: #165dff;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  cursor: grab;
  user-select: none;
}

.line-segment.is-template {
  border-top-color: #165dff;
  color: #0f3a8c;
}

.plane-marker {
  position: absolute;
  z-index: 4;
  min-width: 34px;
  max-width: 72px;
  padding: 1px 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  transform: translate(-50%, -50%);
  border: 1px solid #7a6514;
  background: #ffeb57;
  color: #111827;
  font-family: "SimSun", serif;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.15;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 1px 0 rgba(15, 23, 42, 0.12);
}

.line-segment:hover {
  filter: brightness(0.95);
}

.line-segment.drag-preview {
  z-index: 6;
  opacity: 0.68;
  pointer-events: none;
  border-top-style: dashed;
  filter: drop-shadow(0 1px 2px rgba(15, 23, 42, 0.24));
}

.segment-label {
  position: absolute;
  top: 3px;
  left: 0;
  display: inline-block;
  max-width: 72px;
  padding: 0 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  background: rgba(255, 255, 255, 0.9);
  line-height: 1.15;
  vertical-align: top;
}

.segment-handle {
  position: absolute;
  top: -7px;
  width: 10px;
  height: 14px;
  border: 1px solid currentColor;
  border-radius: 3px;
  background: #fff;
  opacity: 0;
  transition: opacity 0.12s ease;
  cursor: ew-resize;
}

.line-segment:hover .segment-handle {
  opacity: 1;
}

.segment-handle-start {
  left: -5px;
}

.segment-handle-end {
  right: -5px;
}

.fluid-line {
  border-top-color: #047857;
  color: #047857;
}

.blood-line {
  border-top-color: #dc2626;
  color: #dc2626;
}

.vital-chart {
  grid-template-columns: 176px 54px 1fr;
  height: 300px;
}

.chart-legend,
.chart-scale {
  border-right: 1px solid #111827;
  background: #f8fafc;
}

.chart-legend {
  display: grid;
  grid-template-columns: 76px 1fr 22px;
  gap: 2px;
  padding: 4px 2px;
  font-size: 11px;
}

.event-legend,
.vital-symbol-legend,
.temp-scale-mini {
  display: grid;
  align-content: center;
  gap: 1px;
  min-height: 0;
}

.event-legend {
  border-right: 1px solid #d5dde8;
  text-align: left;
  justify-items: start;
  overflow: hidden;
}

.vital-symbol-legend span {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  min-height: 15px;
  line-height: 1.15;
}

.event-legend span {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  width: 100%;
  margin: 1px 0;
  overflow: hidden;
  min-height: 15px;
  font-size: 11px;
  line-height: 1.15;
  white-space: nowrap;
}

.event-legend b {
  color: #111827;
  font-weight: 700;
}

.vital-symbol-legend {
  padding-left: 1px;
  font-size: 11px;
}

.temp-scale-mini {
  justify-items: center;
  border-left: 1px solid #cbd5e1;
  font-size: 11px;
  line-height: 1.1;
}

.temp-scale-mini em {
  writing-mode: vertical-rl;
  font-style: normal;
}

.chart-scale {
  position: relative;
}

.chart-scale span {
  position: absolute;
  left: 3px;
  transform: translateY(-50%);
  font-size: 12px;
}

.chart-scale em {
  position: absolute;
  right: 3px;
  transform: translateY(-50%);
  color: #475569;
  font-size: 12px;
  font-style: normal;
}

.chart-scale small {
  position: absolute;
  left: 4px;
  bottom: 2px;
  color: #475569;
  font-size: 11px;
}

.chart-scale .kpa-label {
  right: 4px;
  left: auto;
}

.chart-area svg {
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.chart-area polyline {
  fill: none;
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.drag-guide {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 4;
  border-top: 1px dashed #0f766e;
  pointer-events: none;
}

.drag-tooltip {
  position: absolute;
  z-index: 5;
  padding: 3px 8px;
  border: 1px solid #0f766e;
  border-radius: 4px;
  background: #ecfdf5;
  color: #0f513f;
  font-size: 12px;
  font-weight: 700;
  pointer-events: none;
  white-space: nowrap;
}

.surgery-status-row {
  display: grid;
  grid-template-columns: 140px 1fr;
  min-height: 32px;
  border-bottom: 1px solid #111827;
}

.status-title {
  display: grid;
  place-items: center;
  border-right: 1px solid #111827;
  background: #f8fafc;
  font-weight: 700;
}

.status-track {
  position: relative;
  background-image: linear-gradient(to right, rgba(100, 116, 139, 0.28) 1px, transparent 1px);
  background-repeat: repeat;
  background-size: calc(100% / var(--minor-count, 42)) 100%;
}

.surgery-status-symbol {
  position: absolute;
  z-index: 4;
  top: 50%;
  display: inline-grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  transform: translate(-50%, -50%);
  border: 1px solid rgba(15, 23, 42, 0.45);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.96);
  color: #111827;
  font-size: 17px;
  font-weight: 800;
  line-height: 1;
  text-shadow: 0 1px 0 #fff;
}

.surgery-status-symbol.is-critical {
  border-color: #dc2626;
  color: #dc2626;
}

.surgery-status-symbol.is-template {
  border-color: #165dff;
  background: #e8f3ff;
  color: #0f3a8c;
  box-shadow: 0 0 0 3px rgba(22, 93, 255, 0.12);
}

.surgery-status-symbol.is-recent {
  border-color: #00b42a;
  background: #f0fff4;
  color: #15803d;
  box-shadow: 0 0 0 4px rgba(0, 180, 42, 0.14);
}

.sheet-notes {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.sheet-notes div {
  min-height: 76px;
  padding: 8px;
  border-right: 1px solid #111827;
}

.sheet-notes p {
  margin: 6px 0 0;
  line-height: 1.5;
}

.reference-notes {
  grid-template-columns: 80px 1.25fr 1.25fr 1.1fr 1fr;
  border-bottom: 1px solid #111827;
}

.reference-notes > div:not(.note-vertical) {
  min-width: 0;
}

.reference-notes > div:not(.note-vertical) strong {
  display: block;
  max-width: 100%;
  line-height: 1.25;
  white-space: normal;
  word-break: keep-all;
  overflow-wrap: anywhere;
}

.reference-notes .note-vertical {
  display: grid;
  place-items: center;
  padding: 0;
}

.reference-notes .note-vertical strong {
  writing-mode: vertical-rl;
  letter-spacing: 2px;
}

.sheet-footer-summary {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  border-bottom: 1px solid #111827;
  font-size: 12px;
}

.sheet-footer-summary div {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  min-height: 24px;
  border-right: 1px solid #111827;
  border-bottom: 1px solid #111827;
}

.sheet-footer-summary strong {
  padding: 4px 6px;
  border-right: 1px solid #111827;
  font-weight: 700;
}

.sheet-footer-summary span {
  padding: 4px 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

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

.live-context-menu button,
.live-data-table button {
  border: 0;
  border-radius: 5px;
  padding: 7px 10px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.live-context-menu button:hover,
.live-data-table button:hover {
  background: #e8f3ff;
}

.danger-menu {
  color: #dc2626;
}

.live-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1300;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.28);
}

.live-modal {
  width: min(920px, 96vw);
  max-height: 88vh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fbfdff;
  box-shadow: 0 18px 46px rgba(15, 23, 42, 0.2);
}

.live-modal.small {
  width: min(560px, 96vw);
}

.live-modal header,
.live-modal footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
}

.live-modal footer {
  justify-content: flex-end;
  border-top: 1px solid #e5e7eb;
  border-bottom: 0;
}

.live-modal header button {
  border: 0;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
}

.live-modal-body {
  box-sizing: border-box;
  max-width: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 16px;
}

.live-modal-body label {
  display: grid;
  gap: 5px;
  margin-bottom: 10px;
  color: #334155;
  font-size: 13px;
}

.live-modal-body input,
.live-modal-body select {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 32px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 3px 7px;
  background: #fff;
}

.time-stepper {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 4px;
  width: 100%;
  max-width: 100%;
}

.time-stepper button {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #fff;
  color: #1f2937;
  line-height: 1;
  cursor: pointer;
}

.time-stepper input {
  width: 100%;
  min-width: 0;
}

.inline-options {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.inline-options label {
  display: inline-flex;
  grid-template-columns: none;
  align-items: center;
  gap: 4px;
  margin: 0;
}

.monitor-item-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px 14px;
  overflow-x: hidden;
}

.monitor-form .monitor-item-grid label {
  min-width: 0;
  margin-bottom: 0;
}

.monitor-form .monitor-item-grid small {
  display: block;
  min-height: 16px;
  color: #64748b;
  font-size: 11px;
}

@media (max-width: 720px) {
  .monitor-item-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 460px) {
  .monitor-item-grid {
    grid-template-columns: 1fr;
  }
}

.observe-body {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 16px;
  overflow: auto;
}

.observe-panel {
  min-height: 320px;
  padding: 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
}

.observe-panel header {
  display: flex;
  justify-content: space-between;
  padding: 0 0 8px;
  border: 0;
  background: transparent;
  color: #475569;
}

.observe-panel header span {
  color: #94a3b8;
  font-size: 12px;
}

.observe-item {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin-bottom: 6px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 8px;
  background: #fff;
  text-align: left;
}

.observe-item.active {
  cursor: grab;
}

.observe-item span {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.observe-item small {
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.observe-item em {
  color: #64748b;
  font-size: 12px;
  font-style: normal;
}

.observe-item.active {
  border-color: #165dff;
  background: #e8f3ff;
  color: #165dff;
}

.observe-actions {
  display: inline-flex;
  gap: 3px;
  font-style: normal;
}

.observe-actions button {
  width: 24px;
  height: 24px;
  border: 1px solid #bfd2ea;
  border-radius: 4px;
  background: #fff;
  color: #165dff;
  text-align: center;
}

.data-tabs {
  display: flex;
  gap: 6px;
  padding: 10px 14px 0;
}

.data-tabs button {
  border: 1px solid #cbd5e1;
  border-radius: 4px 4px 0 0;
  padding: 6px 12px;
  background: #f8fafc;
}

.data-tabs button.active {
  background: #fff;
  color: #165dff;
  border-bottom-color: #fff;
}

.data-list-body {
  max-height: 62vh;
  overflow: auto;
}

.live-data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.live-data-table th,
.live-data-table td {
  border: 1px solid #e2e8f0;
  padding: 6px;
  text-align: left;
}

.btn {
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  padding: 6px 12px;
  background: #fff;
  cursor: pointer;
}

.btn.primary {
  border-color: #165dff;
  background: #165dff;
  color: #fff;
}

@media print {
  .live-record-card {
    overflow: visible;
    border: 1px solid #111;
  }

  .live-context-menu,
  .live-modal-backdrop {
    display: none !important;
  }

  .print-grid-lines span {
    border-left-color: #8a8a8a;
  }

  .print-grid-lines span.major,
  .print-row-lines span.major,
  .print-chart-horizontal-lines span.major {
    border-color: #111;
  }
}
</style>
