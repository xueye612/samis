<template>
  <section
    class="live-record-card print-area"
    :class="{
      'is-rescue': rescueModeActive && !printMode,
      'is-print-mode': printMode || interactionMode === 'print',
      'is-screen-mode': !printMode && interactionMode !== 'print',
      'is-locked': record.locked && !printMode,
      'is-interaction-edit': interactionMode === 'edit' && !printMode,
      'is-interaction-view': interactionMode === 'view' && !printMode,
    }"
    @contextmenu.prevent="openMenu($event, 'grid')"
  >
    <div v-if="record.locked && !printMode" class="sheet-lock-banner" role="status" aria-live="polite">
      <span class="sheet-lock-icon" aria-hidden="true">🔒</span>
      <strong>记录单已锁定</strong>
      <span class="sheet-lock-desc">当前仅可查看，修改需在工作台解锁</span>
    </div>
    <RecordHeader
      v-if="displaySnapshot"
      :snapshot="displaySnapshot"
      :record-no="record.recordDocument?.recordNo"
      :read-only="readOnly"
      :print-mode="printMode"
      :interaction-mode="interactionMode"
      :actual-surgery-name="record.actualSurgeryName"
      :surgical-position="record.position"
      :anesthesiologist="record.anesthesiologist"
      :surgeon="record.surgeon"
      :circulating-nurses="record.circulatingNurses"
      :scrub-nurses="record.scrubNurses"
      :method-primary="methodPrimary"
      :method-auxiliary="methodAuxiliary"
      :position-options="headerPickerOptions?.positions"
      :surgery-options="headerPickerOptions?.surgeries"
      :anesthesiologist-options="headerPickerOptions?.anesthesiologists"
      :surgeon-options="headerPickerOptions?.surgeons"
      :nurse-options="headerPickerOptions?.nurses"
      @update:actual-surgery-name="emit('saveHeaderField', { actualSurgeryName: $event })"
      @update:surgical-position="emit('saveHeaderField', { position: $event })"
      @update:anesthesiologist="emit('saveHeaderField', { anesthesiologist: $event })"
      @update:surgeon="emit('saveHeaderField', { surgeon: $event })"
      @update:circulating-nurses="emit('saveHeaderField', { circulatingNurses: $event })"
      @update:scrub-nurses="emit('saveHeaderField', { scrubNurses: $event })"
      @apply-method-selection="emit('saveMethodSelection', $event)"
    />
    <div v-else class="print-heading">
      <div></div>
      <h2>麻醉记录单</h2>
      <div class="doc-meta"><span>编号</span><i>{{ record.id }}</i></div>
    </div>

    <div v-if="record.printedAt" class="sheet-print-watermark">已打印 {{ formatDate(record.printedAt) }}</div>

    <RecordTimeAxis :time-scale="timeScale" :grid="bandGrid(1)" />

    <div v-if="!isPacuRecord" ref="medicationBandRef" class="sheet-band medication-band" :style="{ '--rows': medicationRowCount }">
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
          :title="printMode ? undefined : plane.markerTooltip"
          @contextmenu.prevent.stop="openMenu($event, 'plane', plane.source)"
          @dblclick="openPlaneEditor(plane.source)"
          @pointerdown.stop="startPlaneDrag($event, plane.source)"
        >{{ plane.label }}</span>
        <template v-for="row in medicationRows" :key="row.key">
          <span
            v-if="row.renderAsPoint"
            class="drug-point"
            :class="{ 'is-template': row.template, 'is-special': row.isSpecial }"
            :style="pointStyle(row.time, row.index, medicationRowCount)"
            :title="printMode ? undefined : row.markerTooltip"
            @contextmenu.prevent.stop="openMenu($event, 'medication', row.source)"
            @dblclick="openMedicationEditor(row.source)"
            @pointerdown.stop="startMedicationPointDrag($event, row.source, row.index, medicationRowCount)"
          >{{ row.pointLabel }}</span>
          <span
            v-else
            class="line-segment drug-line"
            :class="{ 'is-template': row.template, 'is-special': row.isSpecial, [`line-label--${row.lineLabelMode}`]: Boolean(row.lineLabelMode) }"
            :style="segmentStyle(row.time, row.segmentEnd, row.index, medicationRowCount)"
            :title="printMode ? undefined : row.markerTooltip"
            @contextmenu.prevent.stop="openMenu($event, 'medication', row.source)"
            @dblclick="openMedicationEditor(row.source)"
            @pointerdown.stop="startSegmentDrag($event, 'medication', row.source, 'move', row.index, medicationRowCount)"
          >
            <span
              class="segment-edge segment-edge-start"
              @pointerdown.stop="startSegmentDrag($event, 'medication', row.source, 'start', row.index, medicationRowCount)"
            />
            <span v-if="row.lineLabel" class="segment-label">{{ row.lineLabel }}</span>
            <span
              class="segment-edge segment-edge-end"
              @pointerdown.stop="startSegmentDrag($event, 'medication', row.source, 'end', row.index, medicationRowCount)"
            />
          </span>
        </template>
        <template v-if="segmentDragPreview.active && segmentDragPreview.band === 'medication'">
          <span
            v-if="segmentDragPreview.isPoint && segmentDragPreview.isPlane"
            class="plane-marker drag-preview"
            :style="segmentDragPreview.style"
          >{{ segmentDragPreview.label }}</span>
          <span
            v-else-if="segmentDragPreview.isPoint"
            class="drug-point drag-preview"
            :style="segmentDragPreview.style"
          >{{ segmentDragPreview.label }}</span>
          <span v-else class="line-segment drag-preview drug-line" :style="segmentDragPreview.style">
            <span class="segment-label">{{ segmentDragPreview.label }}</span>
          </span>
          <span class="segment-drag-start-guide" :style="segmentDragPreview.startGuideStyle" />
          <span class="segment-drag-tooltip" :style="segmentDragPreview.tooltipStyle">{{ segmentDragPreview.timeHint }}</span>
        </template>
      </div>
    </div>

    <div v-if="showInhaledBand" class="sheet-band inhaled-band" :style="{ '--rows': inhaledRowCount }">
      <div class="band-side">吸入麻醉</div>
      <div class="band-labels">
        <span v-for="row in inhaledMedicationRows" :key="row.key">{{ row.label }}</span>
        <span v-for="index in Math.max(0, inhaledRowCount - inhaledMedicationRows.length)" :key="`inh-empty-${index}`"></span>
      </div>
      <div class="band-track" :style="gridBackgroundStyle" @contextmenu.prevent.stop="openMenu($event, 'inhaledGrid')">
        <GridLines :grid="bandGrid(inhaledRowCount)" />
        <template v-for="row in inhaledMedicationRows" :key="row.key">
          <span
            v-if="row.renderAsPoint"
            class="drug-point inhaled-point"
            :class="{ 'is-template': row.template, 'is-special': row.isSpecial }"
            :style="pointStyle(row.time, row.index, inhaledRowCount)"
            :title="printMode ? undefined : row.markerTooltip"
            @contextmenu.prevent.stop="openMenu($event, 'inhaled', row.source)"
            @dblclick="openMedicationEditor(row.source)"
            @pointerdown.stop="startMedicationPointDrag($event, row.source, row.index, inhaledRowCount)"
          >{{ row.pointLabel }}</span>
          <span
            v-else
            class="line-segment drug-line inhaled-line"
            :class="{ 'is-template': row.template, 'is-special': row.isSpecial, [`line-label--${row.lineLabelMode}`]: Boolean(row.lineLabelMode) }"
            :style="segmentStyle(row.time, row.segmentEnd, row.index, inhaledRowCount)"
            :title="printMode ? undefined : row.markerTooltip"
            @contextmenu.prevent.stop="openMenu($event, 'inhaled', row.source)"
            @dblclick="openMedicationEditor(row.source)"
            @pointerdown.stop="startSegmentDrag($event, 'medication', row.source, 'move', row.index, inhaledRowCount)"
          >
            <span
              class="segment-edge segment-edge-start"
              @pointerdown.stop="startSegmentDrag($event, 'medication', row.source, 'start', row.index, inhaledRowCount)"
            />
            <span v-if="row.lineLabel" class="segment-label">{{ row.lineLabel }}</span>
            <span
              class="segment-edge segment-edge-end"
              @pointerdown.stop="startSegmentDrag($event, 'medication', row.source, 'end', row.index, inhaledRowCount)"
            />
          </span>
        </template>
        <template v-if="segmentDragPreview.active && segmentDragPreview.band === 'inhaled'">
          <span
            v-if="segmentDragPreview.isPoint"
            class="drug-point inhaled-point drag-preview"
            :style="segmentDragPreview.style"
          >{{ segmentDragPreview.label }}</span>
          <span v-else class="line-segment drag-preview drug-line inhaled-line" :style="segmentDragPreview.style">
            <span class="segment-label">{{ segmentDragPreview.label }}</span>
          </span>
          <span class="segment-drag-start-guide" :style="segmentDragPreview.startGuideStyle" />
          <span class="segment-drag-tooltip" :style="segmentDragPreview.tooltipStyle">{{ segmentDragPreview.timeHint }}</span>
        </template>
      </div>
    </div>

    <div v-if="!isPacuRecord" class="sheet-band" :style="{ '--rows': infusionRowCount }">
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
          :title="printMode ? undefined : row.markerTooltip"
          @contextmenu.prevent.stop="openMenu($event, 'infusion', row.source)"
          @dblclick="openFluidEditor(row.source)"
          @pointerdown.stop="startSegmentDrag($event, 'fluid', row.source, 'move', row.index, infusionRowCount)"
        >
          <span class="segment-edge segment-edge-start" @pointerdown.stop="startSegmentDrag($event, 'fluid', row.source, 'start', row.index, infusionRowCount)" />
          <span class="segment-label">{{ row.amount }}</span>
          <span class="segment-edge segment-edge-end" @pointerdown.stop="startSegmentDrag($event, 'fluid', row.source, 'end', row.index, infusionRowCount)" />
        </span>
        <template v-if="segmentDragPreview.active && segmentDragPreview.band === 'infusion'">
          <span class="line-segment drag-preview fluid-line" :style="segmentDragPreview.style">
            <span class="segment-label">{{ segmentDragPreview.label }}</span>
          </span>
          <span class="segment-drag-start-guide" :style="segmentDragPreview.startGuideStyle" />
          <span class="segment-drag-tooltip" :style="segmentDragPreview.tooltipStyle">{{ segmentDragPreview.timeHint }}</span>
        </template>
      </div>
    </div>

    <div v-if="showAutologousBand" class="sheet-band autologous-band" :style="{ '--rows': autologousRowCount }">
      <div class="band-side">自体血回输</div>
      <div class="band-labels">
        <span v-for="row in autologousRows" :key="row.key">{{ row.label }}</span>
        <span v-for="index in Math.max(0, autologousRowCount - autologousRows.length)" :key="`auto-empty-${index}`"></span>
      </div>
      <div class="band-track" :style="gridBackgroundStyle" @contextmenu.prevent.stop="openMenu($event, 'autologousGrid')">
        <GridLines :grid="bandGrid(autologousRowCount)" />
        <span
          v-for="row in autologousRows"
          :key="row.key"
          class="line-segment autologous-line"
          :style="segmentStyle(row.time, row.end, row.index, autologousRowCount)"
          :title="printMode ? undefined : row.markerTooltip"
          @contextmenu.prevent.stop="openMenu($event, 'autologous', row.source)"
          @dblclick="openFluidEditor(row.source)"
          @pointerdown.stop="startSegmentDrag($event, 'fluid', row.source, 'move', row.index, autologousRowCount)"
        >
          <span class="segment-edge segment-edge-start" @pointerdown.stop="startSegmentDrag($event, 'fluid', row.source, 'start', row.index, autologousRowCount)" />
          <span class="segment-label">{{ row.amount }}</span>
          <span class="segment-edge segment-edge-end" @pointerdown.stop="startSegmentDrag($event, 'fluid', row.source, 'end', row.index, autologousRowCount)" />
        </span>
        <template v-if="segmentDragPreview.active && segmentDragPreview.band === 'autologous'">
          <span class="line-segment drag-preview autologous-line" :style="segmentDragPreview.style">
            <span class="segment-label">{{ segmentDragPreview.label }}</span>
          </span>
          <span class="segment-drag-start-guide" :style="segmentDragPreview.startGuideStyle" />
          <span class="segment-drag-tooltip" :style="segmentDragPreview.tooltipStyle">{{ segmentDragPreview.timeHint }}</span>
        </template>
      </div>
    </div>

    <div v-if="!isPacuRecord" class="sheet-band" :style="{ '--rows': transfusionRowCount }">
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
          :title="printMode ? undefined : row.markerTooltip"
          @contextmenu.prevent.stop="openMenu($event, 'transfusion', row.source)"
          @dblclick="openFluidEditor(row.source)"
          @pointerdown.stop="startSegmentDrag($event, 'fluid', row.source, 'move', row.index, transfusionRowCount)"
        >
          <span class="segment-edge segment-edge-start" @pointerdown.stop="startSegmentDrag($event, 'fluid', row.source, 'start', row.index, transfusionRowCount)" />
          <span class="segment-label">{{ row.amount }}</span>
          <span class="segment-edge segment-edge-end" @pointerdown.stop="startSegmentDrag($event, 'fluid', row.source, 'end', row.index, transfusionRowCount)" />
        </span>
        <template v-if="segmentDragPreview.active && segmentDragPreview.band === 'transfusion'">
          <span class="line-segment drag-preview blood-line" :style="segmentDragPreview.style">
            <span class="segment-label">{{ segmentDragPreview.label }}</span>
          </span>
          <span class="segment-drag-start-guide" :style="segmentDragPreview.startGuideStyle" />
          <span class="segment-drag-tooltip" :style="segmentDragPreview.tooltipStyle">{{ segmentDragPreview.timeHint }}</span>
        </template>
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

    <LabResultLayer
      :labs="labResults"
      :left-for="leftFor"
      :read-only="readOnly"
      :print-mode="printMode"
      @select="openLabEditor"
    />

    <div ref="statusBandRef" class="vital-chart">
      <div class="chart-layout">
        <RecordChartLegend
          :event-legend-pairs="eventLegendPairs"
          :room-legend-items="roomLegendItems"
          :reference-legend-items="referenceLegendItems"
        />
        <div ref="chartAreaRef" class="chart-area" :style="gridBackgroundStyle" @contextmenu.prevent.stop="openMenu($event, 'chart')">
          <div class="chart-status-overlay">
            <component
              :is="printMode ? 'span' : 'button'"
              v-for="event in statusEvents"
              :key="`chart-status-${event.id}`"
              :ref="(el: Element | null) => registerStatusSymbol(event.id, el as HTMLElement | null)"
              :type="printMode ? null : 'button'"
              class="chart-status-symbol"
              :class="[event.className, { 'is-active': isStatusEventActive(event) }]"
              :style="{ left: leftFor(event.time) }"
              :title="statusEventTitle(event)"
              @click.stop="selectStatusEvent(event)"
            >{{ event.symbol }}</component>
          </div>
          <div class="chart-scale">
            <span
              v-for="tick in tempScaleTicks"
              :key="`temp-${tick.value}`"
              class="temp-scale-tick"
              :style="{ top: `${tick.top}%` }"
            >{{ tick.value }}</span>
            <span v-for="tick in chartTicks" :key="tick.value" :style="{ top: `${tick.top}%` }">{{ tick.value }}</span>
            <em v-for="tick in respiratoryTicks" :key="`rr-${tick.value}`" :style="{ top: `${tick.top}%` }">{{ tick.value }}</em>
            <small>体温 / mmHg</small>
          </div>
          <GridLines :grid="chartGrid" chart />
          <svg viewBox="0 0 1000 300" preserveAspectRatio="none">
            <polyline
              v-for="item in chartLineVitals"
              :key="`line-${item.shortCode}`"
              :points="chartLine(item)"
              :stroke="item.chartColor ?? '#2563eb'"
            />
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
    </div>

    <div ref="ioBandRef" class="sheet-band status-band" :style="{ '--rows': 5 }">
      <div class="band-side">出入量</div>
      <div class="band-labels">
        <span>尿量（ml）</span><span>出血量（ml）</span><span>引流量（ml）</span><span>特殊用药序号</span><span>手术关键操作</span>
      </div>
      <div class="band-track" :style="gridBackgroundStyle" @contextmenu.prevent.stop="openMenu($event, 'balance')">
        <GridLines :grid="bandGrid(5)" />
        <span
          v-for="output in outputRows"
          :key="output.id"
          class="output-point"
          :class="output.markerClass"
          :style="pointStyle(output.time, output.index, 5)"
          @contextmenu.prevent.stop="openMenu($event, 'output', output.source)"
          @dblclick="openOutputEditor(output.source)"
        >{{ output.display }}</span>
        <span
          v-for="marker in sequenceMarkers"
          :key="marker.id"
          class="sequence-marker"
          :class="[marker.tone, { 'is-active': isSequenceMarkerActive(marker) }]"
          :style="pointStyle(marker.time, marker.rowIndex, 5)"
          :title="`${marker.number}. ${marker.content}`"
          @click="highlightSequenceMarker(marker)"
        >{{ marker.number }}</span>
      </div>
    </div>

    <div ref="notesSectionRef" class="sheet-notes reference-notes">
      <NumberedNoteColumn
        label="麻醉诱导用药"
        :model-value="summaryNotes.inductionMeds"
        :readonly="readOnly"
        :print-mode="printMode"
        placeholder="每行一条诱导用药"
        @update:model-value="updateSummaryNote('inductionMeds', $event)"
      />
      <NumberedNoteColumn
        label="辅助及特殊用药"
        :model-value="summaryNotes.specialMeds"
        :readonly="readOnly"
        :print-mode="printMode"
        :highlight-indexes="specialMedHighlightIndexes"
        timeline-enabled
        placeholder="每行一条；需上时间轴请写 HH:mm，如 09:15 昂丹司琼 8mg"
        @update:model-value="updateSummaryNote('specialMeds', $event)"
        @select-line="focusSequenceMarker('specialMeds', $event)"
      />
      <NumberedNoteColumn
        label="手术关键操作"
        :model-value="keyOperationsText"
        :readonly="readOnly"
        :print-mode="printMode"
        :highlight-indexes="keyOperationHighlightIndexes"
        timeline-enabled
        placeholder="每行一条；需上时间轴请写 HH:mm，如 10:20 动脉穿刺置管"
        @update:model-value="updateSummaryNote('keyOperations', $event)"
        @select-line="focusSequenceMarker('keyOperations', $event)"
      />
      <NumberedNoteColumn
        v-if="showPostopAnalgesiaNote"
        label="术后镇痛"
        :model-value="summaryNotes.postopAnalgesia"
        :readonly="readOnly"
        :print-mode="printMode"
        placeholder="镇痛方式、PCA 设置等"
        @update:model-value="updateSummaryNote('postopAnalgesia', $event)"
      />
    </div>

    <section
      v-if="showProfessionalSummary && printMode && includeProfessionalAppendix"
      class="sheet-professional-summary is-print"
      :class="{ 'has-impact': Boolean(templateImpact) }"
    >
      <div class="professional-summary-head">
        <strong>专业麻醉记录</strong>
        <span v-if="appliedTemplateName">模板：{{ appliedTemplateName }}</span>
        <span>麻醉方法：{{ sheetAnesthesiaMethod }}</span>
      </div>
      <div class="professional-paper-grid">
        <section v-for="group in professionalFieldGroups" :key="group.title" class="professional-paper-group">
          <b>{{ group.title }}</b>
          <dl>
            <div
              v-for="item in group.items"
              :key="`${group.title}-${item.label}`"
              class="professional-editable-field"
              :class="{ disabled: readOnly }"
            >
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value || '待记录' }}</dd>
            </div>
          </dl>
        </section>
        <section v-if="templateEventRows.length" class="professional-paper-group template-events">
          <b>模板事件落单</b>
          <p>
            <span v-for="event in templateEventRows" :key="event.id">{{ event.time }} {{ event.type }}</span>
          </p>
        </section>
        <section v-if="templateQualityTips.length" class="professional-paper-group quality-tips">
          <b>质控提醒</b>
          <p>
            <span v-for="tip in templateQualityTips" :key="tip.text" :class="`tip-${tip.level}`">{{ tip.level }}：{{ tip.text }}</span>
          </p>
        </section>
      </div>
    </section>

    <RecordFooterSummary
      v-if="displaySnapshot && (!printMode || isLastPage)"
      :summary="displaySummary"
      :autologous-total="balanceSummary.autologousInput"
      :signatures="record.signatures"
      :read-only="readOnly"
      :print-mode="printMode"
      :compact="!printMode"
      @update:anesthesia-effect="emit('saveSummaryField', { anesthesiaEffect: $event as '优' | '良' | '差' })"
      @update:destination="emit('saveSummaryField', { destination: $event })"
      @update:analgesia-method="emit('saveSummaryField', { analgesiaMethod: $event })"
      @update:handover-note="emit('saveSummaryField', { handoverNote: $event })"
    />

    <div v-if="printMode" class="print-page-mark">第 {{ pageNo }} / {{ totalPages }} 页</div>

    <RecordContextMenu
      :visible="menu.visible"
      :x="menu.x"
      :y="menu.y"
      :read-only="readOnly"
      v-model:pending-delete="pendingDelete"
      :has-line-target="hasLineTarget"
      :type="menu.type"
      :medication-target="medicationTarget"
      :show-drug-menus="showDrugMenus"
      :show-inhaled-menus="showInhaledMenus"
      :show-plane-menus="showPlaneMenus"
      :show-fluid-menus="showFluidMenus"
      :show-autologous-menus="showAutologousMenus"
      :show-vital-menus="showVitalMenus"
      :show-output-menus="showOutputMenus"
      :iv-common-drugs="ivCommonDrugs"
      :iv-other-drugs="ivOtherDrugs"
      :inhaled-drug-catalog="inhaledDrugCatalog"
      :infusion-catalog="infusionCatalog"
      :autologous-catalog="autologousCatalog"
      :blood-catalog="bloodCatalog"
      @edit="openTargetEditor"
      @continue="continueTarget"
      @stop-pump="stopMedicationPump"
      @pause="pauseMedication"
      @resume="resumeMedication"
      @void="voidTarget"
      @add-medication="openMedicationEditor"
      @add-fluid="openFluidEditor"
      @add-plane="openPlaneEditor()"
      @add-monitor="openMonitorDialog()"
      @batch-monitor="openBatchMonitorDialog"
      @add-lab="openLabEditor()"
      @open-observe="observeVisible = true; menu.visible = false"
      @add-output="openOutputEditor()"
      @open-data-list="openDataList(defaultDataList)"
    />

    <RecordModalShell
      v-if="lineVisible"
      :size="lineForm.kind === 'medication' || lineForm.kind === 'infusion' || lineForm.kind === 'transfusion' ? 'clinical' : 'compact'"
      top-layer
      :title="lineModalTitle"
      @close="lineVisible = false"
    >
      <MedicationLineForm
        :form="lineForm"
        :drugs="drugs"
        :fluid-catalog="fluidCatalogForForm"
        :blood-types="bloodTypes"
        :rh-types="rhTypes"
        :transfusion-reactions="transfusionReactions"
        @update:form="patchLineForm"
        @sync-medication="syncMedicationForm"
        @sync-fluid="syncFluidForm"
        @shift-time="shiftLineTime"
      />
      <template #footer>
        <div class="footer-actions">
          <a-button @click="lineVisible = false">取消</a-button>
          <a-button type="primary" :disabled="readOnly" @click="saveLineForm">保存</a-button>
        </div>
      </template>
    </RecordModalShell>

    <RecordModalShell v-if="professionalEditor.visible" size="small" top-layer title="专业字段编辑" @close="professionalEditor.visible = false">
      <div class="live-modal-body professional-editor-body">
        <label>
          模块
          <input v-model="professionalEditor.group" disabled />
        </label>
        <label>
          字段
          <input v-model="professionalEditor.label" disabled />
        </label>
        <label class="field-wide">
          内容
          <textarea v-model="professionalEditor.value" rows="3" />
        </label>
      </div>
      <template #footer>
        <button class="btn small" @click="professionalEditor.visible = false">关闭</button>
        <button class="btn small primary" :disabled="readOnly" @click="saveProfessionalFieldEdit">保存</button>
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
      :size="monitorBatch ? 'medium' : 'clinical'"
      top-layer
      :title="monitorBatch ? '批量生命体征' : monitorForm.id ? '编辑生命体征' : '新增生命体征'"
      @close="monitorVisible = false"
    >
      <VitalSignEntryForm
        :form="monitorForm"
        :values="monitorValues"
        :rows="monitorRows"
        :batch="monitorBatch"
        :end-time="monitorEndTime"
        :interval="monitorInterval"
        @update:form="patchMonitorForm"
        @update:values="patchMonitorValues"
        @update:end-time="monitorEndTime = $event"
        @update:interval="monitorInterval = $event"
        @shift-time="shiftMonitorTime"
      />
      <template #footer>
        <a-button @click="monitorVisible = false">关闭</a-button>
        <a-button type="primary" :disabled="readOnly" @click="saveMonitorForm">保存</a-button>
      </template>
    </RecordModalShell>

    <RecordModalShell v-if="outputVisible" size="compact" top-layer title="出入量设置" @close="outputVisible = false">
      <OutputLineForm
        :form="outputForm"
        :disabled="readOnly"
        @update:form="patchOutputForm"
        @shift-time="shiftOutputTime"
        @shift-volume="shiftOutputVolume"
      />
      <template #footer>
        <a-button @click="outputVisible = false">关闭</a-button>
        <a-button type="primary" :disabled="readOnly" @click="saveOutputForm">保存</a-button>
      </template>
    </RecordModalShell>

    <RecordModalShell v-if="labVisible" size="compact" top-layer title="血气/检验结果" @close="labVisible = false">
      <LabResultEntryForm
        :form="labForm"
        :disabled="readOnly"
        @update:form="patchLabForm"
        @shift-time="shiftLabTime"
      />
      <template #footer>
        <a-button @click="labVisible = false">关闭</a-button>
        <a-button type="primary" :disabled="readOnly" @click="saveLabForm">保存</a-button>
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
              <tr v-for="row in record.anesthesiaPlanes ?? []" :key="row.id" :class="{ 'row-voided': row.status === 'voided' }" @dblclick="openPlaneEditor(row)">
                <td>{{ isoOrClockToClock(row.time) }}</td><td>{{ row.level }}</td><td>{{ planeDirectionText(row.direction) }}</td><td>{{ row.remark || '-' }}</td>
                <td><button @click="openPlaneEditor(row)">编辑</button><button v-if="row.status === 'voided'" :disabled="readOnly" @click="emit('restoreRecord', 'plane', row.id)">撤销</button><button v-else class="danger-menu" :disabled="readOnly" @click="emit('voidRecord', 'plane', row.id)">作废</button></td>
              </tr>
            </tbody>
          </table>
          <table v-else-if="activeDataList === 'medications'" class="live-data-table">
            <thead><tr><th>类型</th><th>时间</th><th>名称</th><th>剂量/泵速</th><th>途径</th><th>核对</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="row in tableIvMedications" :key="row.id" :class="{ 'row-voided': row.status === 'voided' }" @dblclick="openMedicationEditor(row)">
                <td><span class="table-pill" :class="{ continuous: row.mode === '持续泵入' }">{{ row.mode === '持续泵入' ? '持续' : '单次' }}</span></td>
                <td>{{ medicationTimeText(row) }}</td><td>{{ row.drug }}</td><td>{{ medicationDoseText(row) }}</td><td>{{ row.route || '-' }}</td><td>{{ row.checker || '-' }}</td>
                <td><button @click="openMedicationEditor(row)">编辑</button><button v-if="row.status === 'voided'" :disabled="readOnly" @click="emit('restoreRecord', 'medication', row.id)">撤销</button><button v-else class="danger-menu" :disabled="readOnly" @click="emit('voidRecord', 'medication', row.id)">作废</button></td>
              </tr>
            </tbody>
          </table>
          <table v-else-if="activeDataList === 'inhaled'" class="live-data-table">
            <thead><tr><th>类型</th><th>时间</th><th>名称</th><th>浓度/剂量</th><th>途径</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="row in tableInhaledMedications" :key="row.id" :class="{ 'row-voided': row.status === 'voided' }" @dblclick="openMedicationEditor(row)">
                <td><span class="table-pill" :class="{ continuous: row.mode === '持续泵入' }">{{ row.mode === '持续泵入' ? '持续' : '单次' }}</span></td>
                <td>{{ medicationTimeText(row) }}</td><td>{{ row.drug }}</td><td>{{ medicationDoseText(row) }}</td><td>{{ row.route || '吸入' }}</td>
                <td><button @click="openMedicationEditor(row)">编辑</button><button v-if="row.status === 'voided'" :disabled="readOnly" @click="emit('restoreRecord', 'medication', row.id)">撤销</button><button v-else class="danger-menu" :disabled="readOnly" @click="emit('voidRecord', 'medication', row.id)">作废</button></td>
              </tr>
            </tbody>
          </table>
          <table v-else-if="activeDataList === 'infusions'" class="live-data-table">
            <thead><tr><th>类别</th><th>时间</th><th>名称</th><th>容量</th><th>执行人</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="row in record.fluids.filter((item) => isInfusionFluidCategory(item.category))" :key="row.id" :class="{ 'row-voided': row.status === 'voided' }" @dblclick="openFluidEditor(row)">
                <td><span class="table-pill fluid">{{ row.category }}</span></td><td>{{ fluidTimeText(row) }}</td><td>{{ row.name }}</td><td>{{ row.volume }}{{ row.unit ?? 'ml' }}</td><td>{{ row.executor || '-' }}</td>
                <td><button @click="openFluidEditor(row)">编辑</button><button v-if="row.status === 'voided'" :disabled="readOnly" @click="emit('restoreRecord', 'fluid', row.id)">撤销</button><button v-else class="danger-menu" :disabled="readOnly" @click="emit('voidRecord', 'fluid', row.id)">作废</button></td>
              </tr>
            </tbody>
          </table>
          <table v-else-if="activeDataList === 'autologous'" class="live-data-table">
            <thead><tr><th>时间</th><th>名称</th><th>容量</th><th>执行人</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="row in record.fluids.filter((item) => isAutologousFluidCategory(item.category, item.name))" :key="row.id" :class="{ 'row-voided': row.status === 'voided' }" @dblclick="openFluidEditor(row)">
                <td>{{ fluidTimeText(row) }}</td><td>{{ row.name }}</td><td>{{ row.volume }}{{ row.unit ?? 'ml' }}</td><td>{{ row.executor || '-' }}</td>
                <td><button @click="openFluidEditor(row)">编辑</button><button v-if="row.status === 'voided'" :disabled="readOnly" @click="emit('restoreRecord', 'fluid', row.id)">撤销</button><button v-else class="danger-menu" :disabled="readOnly" @click="emit('voidRecord', 'fluid', row.id)">作废</button></td>
              </tr>
            </tbody>
          </table>
          <table v-else-if="activeDataList === 'transfusions'" class="live-data-table">
            <thead><tr><th>时间</th><th>血品</th><th>容量</th><th>血型</th><th>核对</th><th>反应</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="row in record.fluids.filter((item) => item.category === '血液制品')" :key="row.id" :class="{ 'row-voided': row.status === 'voided' }" @dblclick="openFluidEditor(row)">
                <td>{{ fluidTimeText(row) }}</td><td>{{ row.name }}</td><td>{{ row.volume }}{{ row.unit ?? 'ml' }}</td><td>{{ row.bloodType || '-' }} {{ row.rh || '' }}</td><td><span class="table-pill" :class="{ danger: !row.doubleCheck }">{{ row.doubleCheck ? '完成' : '未完成' }}</span></td><td>{{ row.reaction || '-' }}</td>
                <td><button @click="openFluidEditor(row)">编辑</button><button v-if="row.status === 'voided'" :disabled="readOnly" @click="emit('restoreRecord', 'fluid', row.id)">撤销</button><button v-else class="danger-menu" :disabled="readOnly" @click="emit('voidRecord', 'fluid', row.id)">作废</button></td>
              </tr>
            </tbody>
          </table>
          <table v-else-if="activeDataList === 'vitals'" class="live-data-table">
            <thead><tr><th>时间</th><th v-for="item in monitorRows" :key="item.shortCode">{{ item.shortCode }}</th><th>来源</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="row in pageVitals" :key="row.id ?? row.time" :class="{ 'row-voided': row.status === 'voided' }" @dblclick="openMonitorDialog(row)">
                <td>{{ isoOrClockToClock(row.time) }}</td><td v-for="item in monitorRows" :key="item.shortCode">{{ row[item.shortCode as keyof typeof row] ?? '' }}</td><td>{{ row.source }}</td>
                <td><button @click="openMonitorDialog(row)">编辑</button><button v-if="row.status === 'voided'" :disabled="readOnly || !row.id" @click="emit('restoreRecord', 'vital', row.id || '')">撤销</button><button v-else class="danger-menu" :disabled="readOnly || !row.id" @click="emit('voidRecord', 'vital', row.id || '')">作废</button></td>
              </tr>
            </tbody>
          </table>
          <table v-else class="live-data-table">
            <thead><tr><th>时间</th><th>类型</th><th>容量</th><th>备注</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="row in record.outputRecords ?? []" :key="row.id" :class="{ 'row-voided': row.status === 'voided' }" @dblclick="openOutputEditor(row)">
                <td>{{ isoOrClockToClock(row.time) }}</td><td>{{ row.type }}</td><td>{{ row.volume }}ml</td><td>{{ row.remark || '-' }}</td>
                <td><button @click="openOutputEditor(row)">编辑</button><button v-if="row.status === 'voided'" :disabled="readOnly" @click="emit('restoreRecord', 'output', row.id)">撤销</button><button v-else class="danger-menu" :disabled="readOnly" @click="emit('voidRecord', 'output', row.id)">作废</button></td>
              </tr>
            </tbody>
          </table>
        </div>
    </RecordModalShell>
  </section>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import RecordHeader from '@/components/anesthesia/record/sheet/RecordHeader.vue';
import RecordFooterSummary from '@/components/anesthesia/record/sheet/RecordFooterSummary.vue';
import NumberedNoteColumn from '@/components/anesthesia/record/sheet/NumberedNoteColumn.vue';
import RecordTimeAxis from '@/components/anesthesia/record/sheet/RecordTimeAxis.vue';
import LabResultLayer from '@/components/anesthesia/record/sheet/LabResultLayer.vue';
import GridLines from '@/components/anesthesia/record/sheet/RecordGridLines';
import RecordChartLegend from '@/components/anesthesia/record/sheet/RecordChartLegend.vue';
import RecordContextMenu from '@/components/anesthesia/record/sheet/RecordContextMenu.vue';
import { useVitalChartDrawing } from '@/components/anesthesia/record/sheet/useVitalChartDrawing';
import type { AnesthesiaMethodKey } from '@/mock/anesthesiaRecordPrototype';
import {
  getMethodTimelineNodes,
  resolveKeyOperationsDisplayText,
  type MethodTimelineNode,
} from '@/services/methodTimelineEngine';
import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import RecordModalShell from './RecordModalShell.vue';
import MedicationLineForm from '@/components/anesthesia/record/sheet/MedicationLineForm.vue';
import VitalSignEntryForm from '@/components/anesthesia/record/sheet/VitalSignEntryForm.vue';
import OutputLineForm from '@/components/anesthesia/record/sheet/OutputLineForm.vue';
import LabResultEntryForm from '@/components/anesthesia/record/sheet/LabResultEntryForm.vue';
import type { AnesthesiaEvent, AnesthesiaPlaneRecord, FluidRecord, MedicationRecord, OutputDetailRecord, SurgeryCase, VitalSign } from '@/types/anesthesia';
import type { DynamicModuleEntry, TemplateImpact, TemplateImpactEvent, TemplateImpactMedication } from '@/mock/anesthesiaRecordPrototype';
import type { DrugDictItem, FluidBloodDictItem, VitalSignDictItem } from '@/types/system';
import type { LabResultRecord } from '@/types/anesthesiaRecord';
import { buildSequenceMarkersFromNotes, parseNumberedNoteLines } from '@/utils/numberedNotes';
import {
  assignSpecialNumbers,
  buildInductionMedicationSummaryText,
  buildMedicationDisplayModel,
  buildFluidMarkerTooltip,
  formatMedicationSpecialNoteLine,
  formatSegmentDurationLabel,
  medicationEventTime,
  medicationStartTime,
  mergeSpecialMedicationNotes,
  shouldRenderAsLine,
  shouldRenderInSpecialMedication,
} from '@/services/medicationDisplayRules';
import {
  buildMedicationLineRecommendPatch,
  findDrugByName,
} from '@/services/drugDictRecommend';
import {
  buildMonitorCells,
  selectDisplayVitalsForBand,
  buildRecordBandGrid,
  buildBalanceSummary,
  buildRecordSnapshot,
  buildRecordSummaryFields,
  buildTempScaleTicks,
  chartYWithPadding,
  clampVitalValueByDict,
  addMinutesToClock,
  collectRecordTimes,
  createAnesthesiaPlaneDraft,
  LIVE_DEFAULT_SEGMENT_MINUTES,
  createFluidLineDraft,
  createMedicationLineDraft,
  dragVitalPointValue,
  dragTimeSegment,
  isoOrClockToClock,
  resolveRecordSheetNowClock,
  minutesToClock,
  moveMonitorItemOrder,
  percentToTime,
  PRESSURE_CHART_SCALE,
  resolveChartY,
  shouldDrawChartPolyline,
  timeToPercent,
  clockToMinutes,
  vitalMarkerShape,
  resolveTimeAxisIntervals,
  isRescueModeActive,
  resolveDefaultMonitorOrder,
  isInhaledMedication,
  hasInhaledEventHint,
  hasInhaledMethodHint,
  isAutologousFluidCategory,
  isBloodProductCategory,
  isInfusionFluidCategory,
  type RecordBandGrid,
} from '@/services/anesthesiaRecordEngine';
import { buildLiveTimeScale } from '@/services/anesthesiaRecordEngine';
import { buildRecordPagination, clipSegmentToPage, isSegmentCrossingPage, isTimeOnPage } from '@/services/recordPaginationEngine';
import { buildMonitorLayoutObjects, mergeLayoutWarnings, resolveLayoutCollisions } from '@/services/recordLayoutEngine';
import { buildMilestoneStatusEvents } from '@/services/methodTimelineEngine';
import { buildEventLegendPairs, buildRoomLegendItems, resolveEventSymbol } from '@/config/recordEventSymbols';
import { useRecordCoordinates } from '@/components/anesthesia/record/sheet/useRecordCoordinates';
import { resolveSectionVisible, type RecordSectionVisibility } from '@/config/recordSections';

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
  interactionMode?: 'edit' | 'view' | 'print';
  vitalDisplayIntervalMinutes?: number;
  sectionVisibility?: RecordSectionVisibility;
  appliedTemplateName?: string;
  appliedMethodLabels?: string[];
  appliedModules?: DynamicModuleEntry[];
  templateImpact?: TemplateImpact;
  recentEventLabel?: string;
  methodKeys?: AnesthesiaMethodKey[];
  methodLabels?: string[];
  methodPrimary?: AnesthesiaMethodKey;
  methodAuxiliary?: AnesthesiaMethodKey[];
  pageNo?: number;
  printMode?: boolean;
  includeProfessionalAppendix?: boolean;
  headerPickerOptions?: {
    positions: string[];
    surgeries: string[];
    anesthesiaMethods: string[];
    anesthesiologists: string[];
    surgeons: string[];
    nurses: string[];
  };
}>(), {
  bloodTypes: () => [],
  rhTypes: () => [],
  transfusionReactions: () => ['无'],
  monitorOrder: () => [],
  readOnly: false,
  interactionMode: 'edit',
  vitalDisplayIntervalMinutes: 5,
  showAnesthesiaPlane: true,
  sectionVisibility: () => ({}),
  appliedTemplateName: '',
  appliedMethodLabels: () => [],
  appliedModules: () => [],
  templateImpact: undefined,
  recentEventLabel: '',
  methodKeys: () => [],
  methodLabels: () => [],
  methodPrimary: 'general',
  methodAuxiliary: () => [],
  pageNo: 1,
  printMode: false,
  includeProfessionalAppendix: false,
  headerPickerOptions: () => ({
    positions: [],
    surgeries: [],
    anesthesiaMethods: [],
    anesthesiologists: [],
    surgeons: [],
    nurses: [],
  }),
});

const rescueModeActive = computed(() => isRescueModeActive(props.record));

const emit = defineEmits<{
  saveMedication: [record: MedicationRecord];
  saveFluid: [record: FluidRecord];
  saveVital: [record: VitalSign];
  saveOutput: [record: OutputDetailRecord];
  savePlane: [record: AnesthesiaPlaneRecord];
  saveMonitorOrder: [codes: string[]];
  deleteRecord: [kind: 'medication' | 'fluid' | 'vital' | 'output' | 'plane', id: string];
  voidRecord: [kind: 'medication' | 'fluid' | 'vital' | 'output' | 'plane', id: string];
  restoreRecord: [kind: 'medication' | 'fluid' | 'vital' | 'output' | 'plane', id: string];
  selectEvent: [event: AnesthesiaEvent];
  saveProfessionalField: [group: string, label: string, value: string];
  saveTimeline: [node: MethodTimelineNode, isoTime: string];
  saveLab: [record: LabResultRecord];
  layoutWarnings: [warnings: import('@/types/anesthesiaRecord').LayoutWarning[]];
  saveHeaderField: [patch: {
    actualSurgeryName?: string;
    position?: string;
    anesthesiologist?: string;
    surgeon?: string;
    anesthesiaNurse?: string;
    circulatingNurses?: string;
    scrubNurses?: string;
    anesthesiaMethod?: string;
  }];
  saveMethodSelection: [payload: { primary: AnesthesiaMethodKey; auxiliary: AnesthesiaMethodKey[] }];
  saveSummaryField: [patch: Partial<import('@/types/anesthesiaRecord').RecordSummaryFields>];
  saveSummaryNotes: [patch: Partial<import('@/types/anesthesiaRecord').RecordSummaryNotes>];
  stopMedicationPump: [medicationId: string];
  sectionVisibilityReason: [payload: { section: 'inhaled' | 'autologous'; visible: boolean; reason: string }];
}>();

const activeTimelineKey = ref('');
const highlightedEventType = ref('');
const highlightedSequence = ref<{ noteKey: 'specialMeds' | 'keyOperations'; index: number } | null>(null);
const statusSymbolRefs = new Map<string, HTMLElement>();

type MenuType = 'grid' | 'planeGrid' | 'plane' | 'drugGrid' | 'medication' | 'inhaledGrid' | 'inhaled' | 'infusionGrid' | 'infusion' | 'autologousGrid' | 'autologous' | 'transfusionGrid' | 'transfusion' | 'monitor' | 'chart' | 'vital' | 'balance' | 'output';

const menu = reactive<{ visible: boolean; x: number; y: number; type: MenuType; target: unknown; at: string }>({
  visible: false,
  x: 0,
  y: 0,
  type: 'grid',
  target: null,
  at: '',
});

const pendingDelete = ref(false);
const lineVisible = ref(false);
watch(lineVisible, (visible) => {
  if (!visible) return;
  nextTick(() => {
    const body = document.querySelector('.record-modal-backdrop.top .record-modal-body');
    body?.scrollTo(0, 0);
  });
});
const lineModalTitle = computed(() => {
  if (lineForm.kind === 'medication') return '用药记录';
  if (lineForm.category === '自体血回输') return '自体血回输';
  if (lineForm.kind === 'transfusion') return '输血记录';
  return '输液记录';
});
const monitorVisible = ref(false);
const monitorBatch = ref(false);
const outputVisible = ref(false);
const planeVisible = ref(false);
const labVisible = ref(false);
const observeVisible = ref(false);
const dataVisible = ref(false);
const activeDataList = ref<'planes' | 'medications' | 'inhaled' | 'infusions' | 'autologous' | 'transfusions' | 'vitals' | 'outputs'>('medications');
const selectedMonitorCodes = ref<string[]>([]);
const monitorValues = reactive<Record<string, string>>({});
const monitorEndTime = ref('');
const monitorInterval = ref(5);
const draggedMonitorCode = ref('');
const chartAreaRef = ref<HTMLElement | null>(null);
const statusBandRef = ref<HTMLElement | null>(null);
const ioBandRef = ref<HTMLElement | null>(null);
const notesSectionRef = ref<HTMLElement | null>(null);
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
  drugId: '',
  isSpecial: false,
  isSpecialUserTouched: false,
  recommendIsSpecial: false,
  specialCategory: '' as import('@/types/drugDict').SpecialDrugCategory | '',
  specialReason: '',
  reason: '',
  bloodType: '',
  rh: '',
  reaction: '无',
  bagNo: '',
  anesthesiaConfirmed: false,
  circulatingConfirmed: false,
});
const professionalFieldEdits = reactive<Record<string, string>>({});
watch(() => props.record.professionalFieldValues, (values) => {
  Object.keys(professionalFieldEdits).forEach((key) => delete professionalFieldEdits[key]);
  Object.assign(professionalFieldEdits, values ?? {});
}, { immediate: true, deep: true });
const professionalEditor = reactive({
  visible: false,
  group: '',
  label: '',
  value: '',
});
const monitorForm = reactive({ id: '', time: '', source: '手工录入', remark: '' });
const outputForm = reactive<{ id: string; time: string; type: OutputDetailRecord['type']; volume?: number; remark: string }>({
  id: '',
  time: '',
  type: '尿量',
  volume: undefined,
  remark: '',
});
const labForm = reactive({
  id: '',
  resultTime: '',
  labType: '动脉血气',
  displayMode: 'number' as LabResultRecord['displayMode'],
  ph: '',
  pco2: '',
  po2: '',
  be: '',
  lac: '',
});
const planeForm = reactive({
  id: '',
  time: '',
  level: 'T6',
  direction: 'down' as AnesthesiaPlaneRecord['direction'],
  remark: '',
});
const dragState = reactive<{
  active: boolean;
  isPoint: boolean;
  kind: 'medication' | 'fluid' | 'plane';
  band: 'medication' | 'inhaled' | 'infusion' | 'autologous' | 'transfusion';
  mode: 'move' | 'start' | 'end';
  source: MedicationRecord | FluidRecord | AnesthesiaPlaneRecord | null;
  startX: number;
  left: number;
  width: number;
  rowIndex: number;
  rowTotal: number;
  captureEl: HTMLElement | null;
}>({
  active: false,
  isPoint: false,
  kind: 'medication',
  band: 'medication',
  mode: 'move',
  source: null,
  startX: 0,
  left: 0,
  width: 1,
  rowIndex: 0,
  rowTotal: 1,
  captureEl: null,
});
const releaseSegmentPointer = (event: PointerEvent) => {
  if (!dragState.captureEl?.releasePointerCapture) return;
  try {
    dragState.captureEl.releasePointerCapture(event.pointerId);
  } catch {
    /* ignore */
  }
  dragState.captureEl = null;
};
const segmentDragPreview = reactive<{
  active: boolean;
  isPoint: boolean;
  isPlane: boolean;
  band: 'medication' | 'inhaled' | 'infusion' | 'autologous' | 'transfusion';
  style: Record<string, string>;
  label: string;
  timeHint: string;
  startGuideStyle: Record<string, string>;
  tooltipStyle: Record<string, string>;
}>({
  active: false,
  isPoint: false,
  isPlane: false,
  band: 'medication',
  style: {},
  label: '',
  timeHint: '',
  startGuideStyle: {},
  tooltipStyle: {},
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

const {
  pagination,
  currentPage,
  isLastPage,
  sheetStart,
  sheetEnd,
  timeScale,
  gridBackgroundStyle,
  bandGrid,
  chartGrid,
  leftFor,
  topFor,
  pointStyle,
  segmentStyle,
} = useRecordCoordinates(() => props.record, () => props.pageNo);

// 打印分页：每页可识别页码（患者身份由 RecordHeader 在每页渲染，签名仅末页）
const totalPages = computed(() => Number(props.record.recordDocument?.pageCount ?? 1));
const displaySnapshot = computed(() => props.record.recordSnapshot ?? buildRecordSnapshot(props.record, props.record.recordDocument?.hospitalName));
const displaySummary = computed(() => buildRecordSummaryFields(props.record));
const labResults = computed(() => (props.record.labResults ?? []).filter(
  (row) => !currentPage.value || isTimeOnPage(row.resultTime, currentPage.value),
));
const isPacuRecord = computed(() => props.record.recordDocument?.recordType === 'pacu');
const sheetAnesthesiaMethod = computed(() => props.appliedMethodLabels.length ? props.appliedMethodLabels.join(' + ') : props.record.anesthesiaMethod);
const professionalFieldKey = (group: string, label: string) => `${group}::${label}`;
const professionalFieldGroups = computed(() => {
  const modules = props.methodKeys.length
    ? props.appliedModules.filter((module) => props.methodKeys.includes(module.key))
    : props.appliedModules;
  const fields = props.templateImpact?.professionalFields.length
    ? props.templateImpact.professionalFields
    : modules.flatMap((module) => module.sections.flatMap((section) => section.items.map((item) => ({
      group: section.title,
      label: item.label,
      value: item.value,
      method: module.key,
    }))));
  const grouped = new Map<string, Array<{ label: string; value: string }>>();
  fields.forEach((field) => {
    if (!grouped.has(field.group)) grouped.set(field.group, []);
    grouped.get(field.group)?.push({
      label: field.label,
      value: professionalFieldEdits[professionalFieldKey(field.group, field.label)]
        ?? props.record.professionalFieldValues?.[professionalFieldKey(field.group, field.label)]
        ?? field.value,
    });
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
const professionalFieldCount = computed(() => professionalFieldGroups.value.reduce((sum, group) => sum + group.items.length, 0));
const showProfessionalSummary = computed(() => professionalFieldGroups.value.length > 0 || templateEventRows.value.length > 0 || templateQualityTips.value.length > 0);
const pageVitals = computed(() => [...props.record.vitals]
  .filter((row) => !currentPage.value || isTimeOnPage(row.time, currentPage.value))
  .sort((a, b) => isoOrClockToClock(a.time).localeCompare(isoOrClockToClock(b.time))));
const visibleVitals = computed(() => pageVitals.value.filter((row) => row.status !== 'voided'));
const chartDisplayVitals = computed(() => selectDisplayVitalsForBand(
  visibleVitals.value,
  props.vitalDisplayIntervalMinutes,
));
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
const MONITOR_BAND_ONLY = new Set(['SpO2', 'SPO2', 'EtCO2', 'ETCO2', 'BIS']);
const chartVitals = computed(() => monitorRows.value.filter((item) => item.chartEnabled && !MONITOR_BAND_ONLY.has(item.shortCode)));
const chartLineVitals = computed(() => chartVitals.value.filter((item) => shouldDrawChartPolyline(item.shortCode)));
const tempScaleTicks = computed(() => buildTempScaleTicks());
const chartTicks = computed(() => [220, 200, 180, 160, 140, 120, 100, 80, 60, 40, 20].map((value) => ({
  value,
  top: (chartYWithPadding(value, PRESSURE_CHART_SCALE) / 300) * 100,
})));
const respiratoryTicks = computed(() => [26, 24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4, 2].map((value) => ({ value, top: (chartYWithPadding(value, { min: 2, max: 26, height: 300, padding: 18 }) / 300) * 100 })));
const infusionCatalog = computed(() => props.fluids.filter((item) => item.enabled && isInfusionFluidCategory(item.subCategory)));
const autologousCatalog = computed(() => props.fluids.filter((item) => item.enabled && isAutologousFluidCategory(item.subCategory, item.name)));
const bloodCatalog = computed(() => props.fluids.filter((item) => item.enabled && item.subCategory === '血液制品'));
const inhaledDrugCatalog = computed(() => props.drugs.filter((item) => item.enabled && item.defaultRoute?.includes('吸入')));
const ivCommonDrugs = computed(() => props.drugs.filter((item) => item.enabled && item.common && !item.defaultRoute?.includes('吸入')).slice(0, 8));
const ivOtherDrugs = computed(() => props.drugs.filter((item) => item.enabled && !item.common && !item.defaultRoute?.includes('吸入')));
const commonDrugs = ivCommonDrugs;
const otherDrugs = ivOtherDrugs;
const fluidCatalogForForm = computed(() => {
  if (lineForm.kind === 'transfusion') return bloodCatalog.value;
  if (isAutologousFluidCategory(lineForm.category)) return autologousCatalog.value;
  return infusionCatalog.value;
});
const hasInhaledMethodSignal = computed(() => hasInhaledMethodHint([
  props.record.anesthesiaMethod,
  ...props.methodLabels,
  ...props.appliedMethodLabels,
]));
const hasInhaledEventSignal = computed(() => hasInhaledEventHint(props.record.events.map((item) => item.type)));
const showInhaledBand = computed(() => resolveSectionVisible(
  props.sectionVisibility.inhaled,
  !isPacuRecord.value && (
    inhaledMedicationRows.value.length > 0
    || hasInhaledMethodSignal.value
    || hasInhaledEventSignal.value
  ),
));
const showAutologousBand = computed(() => resolveSectionVisible(
  props.sectionVisibility.autologous,
  !isPacuRecord.value && (Boolean(props.record.autologousBlood) || autologousRows.value.length > 0),
));
const showPostopAnalgesiaNote = computed(() => {
  const note = (summaryNotes.value.postopAnalgesia || '').trim();
  const hasContent = Boolean(props.record.postoperativeAnalgesia) || (note !== '' && note !== '未启用');
  return resolveSectionVisible(props.sectionVisibility.postopAnalgesia, !props.readOnly || hasContent);
});
const planeRowOffset = computed(() => props.showAnesthesiaPlane ? 1 : 0);
const planeRows = computed(() => (props.showAnesthesiaPlane ? (props.record.anesthesiaPlanes ?? []).filter((item) => item.status !== 'voided') : []).map((item) => {
  const time = isoOrClockToClock(item.time);
  const parts = [`麻醉平面 ${item.level}${planeDirectionText(item.direction)}`, time];
  if (item.remark?.trim()) parts.push(item.remark.trim());
  return {
    key: item.id,
    label: `${item.level}${planeDirectionText(item.direction)}`,
    time: item.time,
    markerTooltip: parts.filter(Boolean).join(' · '),
    source: item,
  };
}));
const medicationRowCount = computed(() => Math.max(5, medicationRows.value.length + planeRowOffset.value));
const inhaledRowCount = computed(() => Math.max(2, inhaledMedicationRows.value.length));
const infusionRowCount = computed(() => Math.max(3, infusionRows.value.length));
const autologousRowCount = computed(() => Math.max(1, autologousRows.value.length));
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
const eventLegendPairs = buildEventLegendPairs();
const roomLegendItems = buildRoomLegendItems();
const monitorCells = computed(() => {
  const raw = buildMonitorCells(chartDisplayVitals.value, monitorRows.value, monitorOrderCodes.value, {
    start: sheetStart.value,
    end: sheetEnd.value,
    gridMinutes: props.vitalDisplayIntervalMinutes,
  });
  const { objects } = resolveLayoutCollisions(buildMonitorLayoutObjects(raw));
  const map = new Map(objects.map((item) => [item.id, item]));
  return raw.map((cell) => {
    const placed = map.get(cell.key);
    return placed ? { ...cell, leftPercent: placed.x, topPercent: placed.y } : cell;
  });
});
const layoutWarningPayload = computed(() => {
  const raw = buildMonitorCells(chartDisplayVitals.value, monitorRows.value, monitorOrderCodes.value, {
    start: sheetStart.value,
    end: sheetEnd.value,
    gridMinutes: props.vitalDisplayIntervalMinutes,
  });
  const { warnings } = resolveLayoutCollisions(buildMonitorLayoutObjects(raw));
  return mergeLayoutWarnings(warnings);
});
const hasLineTarget = computed(() => ['plane', 'medication', 'inhaled', 'infusion', 'autologous', 'transfusion', 'vital', 'output'].includes(menu.type) && Boolean(menu.target));
const medicationTarget = computed(() => (menu.type === 'medication' || menu.type === 'inhaled' ? menu.target as MedicationRecord | null : null));
const showPlaneMenus = computed(() => props.showAnesthesiaPlane && ['grid', 'planeGrid', 'plane', 'drugGrid'].includes(menu.type));
const showDrugMenus = computed(() => ['grid', 'drugGrid', 'medication'].includes(menu.type));
const showInhaledMenus = computed(() => ['grid', 'inhaledGrid', 'inhaled'].includes(menu.type));
const showFluidMenus = computed(() => ['grid', 'infusionGrid', 'autologousGrid', 'transfusionGrid', 'infusion', 'autologous', 'transfusion'].includes(menu.type));
const showAutologousMenus = computed(() => showAutologousBand.value && ['grid', 'infusionGrid', 'autologousGrid', 'autologous'].includes(menu.type));
const showVitalMenus = computed(() => ['grid', 'monitor', 'chart', 'vital'].includes(menu.type));
const showOutputMenus = computed(() => ['grid', 'balance', 'output'].includes(menu.type));
const defaultDataList = computed(() => {
  if (['medication', 'drugGrid'].includes(menu.type)) return 'medications';
  if (['inhaled', 'inhaledGrid'].includes(menu.type)) return 'inhaled';
  if (['plane', 'planeGrid'].includes(menu.type)) return 'planes';
  if (['infusion', 'infusionGrid'].includes(menu.type)) return 'infusions';
  if (['autologous', 'autologousGrid'].includes(menu.type)) return 'autologous';
  if (['transfusion', 'transfusionGrid'].includes(menu.type)) return 'transfusions';
  if (['monitor', 'chart', 'vital'].includes(menu.type)) return 'vitals';
  return 'outputs';
});
const dataTabs = computed(() => ([
  { key: 'planes', label: '麻醉平面' },
  { key: 'medications', label: '用药' },
  { key: 'inhaled', label: '吸入麻醉' },
  { key: 'infusions', label: '输液' },
  { key: 'autologous', label: '自体血' },
  { key: 'transfusions', label: '输血' },
  { key: 'vitals', label: '生命体征' },
  { key: 'outputs', label: '出入量' },
] as const).filter((item) => {
  if (!props.showAnesthesiaPlane && item.key === 'planes') return false;
  if (item.key === 'inhaled' && !showInhaledBand.value) return false;
  if (item.key === 'autologous' && !showAutologousBand.value) return false;
  return true;
}));

watch([enabledVitalItems, () => props.monitorOrder], ([items, order]) => {
  const enabledCodes = items.map((item) => item.shortCode);
  const saved = (order as string[]).filter((code) => enabledCodes.includes(code));
  const fallback = resolveDefaultMonitorOrder(items);
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
const mapMedicationRow = (item: MedicationRecord, index: number, planeOffset: number) => {
  const display = buildMedicationDisplayModel(item, {
    fallbackSheetEnd: sheetEnd.value,
    specialNo: specialNumberByMedId.value.get(item.id),
    sheetStart: sheetStart.value,
    sheetEnd: sheetEnd.value,
  });
  return {
    key: item.id,
    label: item.drug,
    amount: item.mode === '持续泵入' ? (item.pumpRate || `${item.dose ?? ''}${item.unit ?? ''}`) : `${item.dose ?? ''}${item.unit ?? ''}`,
    time: (display.time || item.time) ?? item.startTime ?? props.record.plannedStart,
    segmentEnd: display.segmentEnd,
    renderAsLine: display.renderAsLine,
    renderAsPoint: display.renderAsPoint,
    pointLabel: display.pointLabel,
    lineLabel: display.lineLabel,
    lineLabelMode: display.lineLabelMode,
    markerTooltip: display.markerTooltip,
    isSpecial: display.showInSpecialSection,
    index: index + planeOffset,
    source: item,
    template: item.id.startsWith('template-med-'),
  };
};
const activeMedicationRecords = computed(() => [...props.record.medications, ...templateMedicationSources.value].filter((item) => item.status !== 'voided'));
const specialNumberByMedId = computed(() => assignSpecialNumbers(activeMedicationRecords.value));
const ivMedicationRecords = computed(() => activeMedicationRecords.value.filter((item) => !isInhaledMedication(item, props.drugs)));
const inhaledMedicationRecords = computed(() => activeMedicationRecords.value.filter((item) => isInhaledMedication(item, props.drugs)));
const allMedicationRecords = computed(() => [...props.record.medications, ...templateMedicationSources.value]);
const tableIvMedications = computed(() => allMedicationRecords.value.filter((item) => !isInhaledMedication(item, props.drugs)));
const tableInhaledMedications = computed(() => allMedicationRecords.value.filter((item) => isInhaledMedication(item, props.drugs)));
const medicationRows = computed(() => ivMedicationRecords.value.map((item, index) => mapMedicationRow(item, index, planeRowOffset.value)));
const inhaledMedicationRows = computed(() => inhaledMedicationRecords.value.map((item, index) => mapMedicationRow(item, index, 0)));
const infusionRows = computed(() => props.record.fluids.filter((item) => isInfusionFluidCategory(item.category) && item.status !== 'voided').map((item, index) => {
  const start = isoOrClockToClock(item.startTime ?? item.time) || props.record.plannedStart;
  const end = isoOrClockToClock(item.endTime);
  const amount = `${item.volume}${item.unit ?? 'ml'}`;
  return {
    key: item.id,
    label: item.name,
    amount,
    time: start,
    end,
    index,
    markerTooltip: buildFluidMarkerTooltip(item, '输液'),
    source: item,
  };
}));
const autologousRows = computed(() => props.record.fluids.filter((item) => isAutologousFluidCategory(item.category, item.name) && item.status !== 'voided').map((item, index) => {
  const start = isoOrClockToClock(item.startTime ?? item.time) || props.record.plannedStart;
  const end = isoOrClockToClock(item.endTime);
  const amount = `${item.volume}${item.unit ?? 'ml'}`;
  return {
    key: item.id,
    label: item.name,
    amount,
    time: start,
    end,
    index,
    markerTooltip: buildFluidMarkerTooltip(item, '自体血回输'),
    source: item,
  };
}));
const transfusionRows = computed(() => props.record.fluids.filter((item) => isBloodProductCategory(item.category) && item.status !== 'voided').map((item, index) => {
  const dict = props.fluids.find((fluid) => fluid.name === item.name);
  const start = isoOrClockToClock(item.startTime ?? item.time) || props.record.plannedStart;
  const end = isoOrClockToClock(item.endTime);
  const amount = `${item.volume}${item.unit ?? dict?.defaultUnit ?? 'U'}`;
  return {
    key: item.id,
    label: item.name,
    amount,
    time: start,
    end,
    index,
    markerTooltip: buildFluidMarkerTooltip({ ...item, unit: item.unit ?? dict?.defaultUnit }, '输血'),
    source: item,
  };
}));
const inhaledVisibilityReason = computed(() => {
  if (isPacuRecord.value) return 'PACU 页面不显示吸入麻醉带';
  if (inhaledMedicationRows.value.length > 0) return '已存在吸入麻醉药记录';
  if (hasInhaledEventSignal.value) return '已记录吸入相关事件';
  if (hasInhaledMethodSignal.value) return '麻醉方式包含吸入相关子类型';
  return '无吸入相关方法/事件/药物记录';
});

const autologousVisibilityReason = computed(() => {
  if (isPacuRecord.value) return 'PACU 页面不显示自体血带';
  if (autologousRows.value.length > 0) return '已存在自体血/回收血记录';
  if (props.record.autologousBlood) return '病例标记了自体血回输';
  return '无自体血相关标记和记录';
});

const sectionReasonSignature = ref<{ inhaled: string; autologous: string }>({ inhaled: '', autologous: '' });

watch([showInhaledBand, inhaledVisibilityReason], ([visible, reason]) => {
  const signature = `${visible ? 1 : 0}|${reason}`;
  if (sectionReasonSignature.value.inhaled === signature) return;
  sectionReasonSignature.value.inhaled = signature;
  emit('sectionVisibilityReason', { section: 'inhaled', visible, reason });
}, { immediate: true });

watch([showAutologousBand, autologousVisibilityReason], ([visible, reason]) => {
  const signature = `${visible ? 1 : 0}|${reason}`;
  if (sectionReasonSignature.value.autologous === signature) return;
  sectionReasonSignature.value.autologous = signature;
  emit('sectionVisibilityReason', { section: 'autologous', visible, reason });
}, { immediate: true });

const outputRows = computed(() => {
  const records = (props.record.outputRecords ?? [])
    .filter((row) => row.status !== 'voided' && (!currentPage.value || isTimeOnPage(row.time, currentPage.value)));
  const indexByType: Record<OutputDetailRecord['type'], number> = { 尿量: 0, 出血量: 1, 引流量: 2, 其他: 3 };
  return records.map((row) => ({
    id: row.id,
    time: row.time,
    volume: row.volume,
    index: indexByType[row.type],
    source: row,
    display: row.type === '出血量' ? `${row.volume}` : `${row.volume}ml`,
    markerClass: row.type === '出血量' ? 'output-badge blood-loss' : 'output-marker',
  }));
});
const clockToIsoTime = (clock: string) => {
  const base = props.record.plannedStart || props.record.anesthesiaStart || dayjs().toISOString();
  const [hour, minute] = clock.split(':').map(Number);
  return dayjs(base).hour(hour).minute(minute).second(0).millisecond(0).toISOString();
};
const symbolForEvent = (type: string) => resolveEventSymbol(type);
const timelineKeyForEventType = (type: string) => {
  const nodes = getMethodTimelineNodes(props.methodKeys);
  const node = nodes.find((item) => item.eventType === type || type.includes(item.eventType ?? '') || (item.eventType && item.eventType.includes(type)));
  return node?.key ?? '';
};
const statusEventTitle = (event: { type: string; time?: string }) => `${event.type} ${isoOrClockToClock(event.time) || '待记录'}`;
const registerStatusSymbol = (eventId: string, element: HTMLElement | null) => {
  if (element) statusSymbolRefs.set(eventId, element);
  else statusSymbolRefs.delete(eventId);
};
const isStatusEventActive = (event: { type: string; id: string }) => highlightedEventType.value === event.type || Boolean(highlightedEventType.value && event.type.includes(highlightedEventType.value));
const focusTimelineNode = (node: MethodTimelineNode, options?: { scrollChart?: boolean }) => {
  activeTimelineKey.value = node.key;
  highlightedEventType.value = node.eventType ?? node.label;
  const match = [...statusSymbolRefs.entries()].find(([id]) => id.includes(node.key) || props.record.events.some((event) => event.id === id && (event.type === node.eventType || event.type.includes(node.eventType ?? ''))));
  if (options?.scrollChart) {
    scrollStatusRowIntoView();
    match?.[1]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
};
const selectStatusEvent = (event: AnesthesiaEvent & { type: string }) => {
  highlightedEventType.value = event.type;
  activeTimelineKey.value = timelineKeyForEventType(event.type);
  emit('selectEvent', event);
};
const scrollStatusRowIntoView = () => {
  statusBandRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};
const flashEventType = (type: string, options?: { scrollChart?: boolean }) => {
  highlightedEventType.value = type;
  activeTimelineKey.value = timelineKeyForEventType(type);
  if (options?.scrollChart) scrollStatusRowIntoView();
  window.setTimeout(() => {
    if (highlightedEventType.value === type) highlightedEventType.value = '';
  }, 2000);
};
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
const statusEvents = computed(() => {
  const eventRows = props.record.events
    .filter((event) => event.status !== 'voided')
    .map((event) => ({
    ...event,
    symbol: symbolForEvent(event.type),
    className: `${event.severity === '危急' || event.severity === '重度' ? 'is-critical' : ''}${props.recentEventLabel.startsWith(event.type) ? ' is-recent' : ''}`.trim(),
  }));
  const eventTypes = new Set(eventRows.map((item) => item.type));
  const milestones = buildMilestoneStatusEvents(props.record)
    .filter((item) => !eventTypes.has(item.type) && !eventRows.some((row) => row.type.includes(item.type) || item.type.includes(row.type)))
    .map((item) => ({
      ...item,
      symbol: symbolForEvent(item.type),
      className: 'is-milestone',
    }));
  return [...eventRows, ...milestones, ...templateStatusEvents.value]
    .filter((item) => !currentPage.value || isTimeOnPage(item.time, currentPage.value));
});
const autoInductionMedsSummary = computed(() => (
  buildInductionMedicationSummaryText(activeMedicationsForSummary.value, props.record)
));
const inductionMedSummary = computed(() => {
  const manual = props.record.recordSummary?.notes?.inductionMeds?.trim();
  if (manual) return manual;
  return autoInductionMedsSummary.value;
});
const medSummary = computed(() => medicationRows.value.slice(0, 6).map((item) => `${item.label}${item.amount}`).join('、') || '');
const activeMedicationsForSummary = computed(() => (
  [...props.record.medications, ...templateMedicationSources.value].filter((item) => item.status !== 'voided')
));
const autoSpecialMedsSummary = computed(() => (
  mergeSpecialMedicationNotes(
    props.record.recordSummary?.notes?.specialMeds,
    activeMedicationsForSummary.value,
  )
));
const eventSummary = computed(() => {
  const hasSpecial = activeMedicationsForSummary.value.some((item) => shouldRenderInSpecialMedication(item));
  return hasSpecial ? autoSpecialMedsSummary.value : '无';
});
const operationSummary = computed(() => {
  const ops = statusEvents.value
    .filter((item) => ['手术开始', '手术结束', '插管', '拔管', '喉罩', '穿刺', '阻滞', '切皮'].some((key) => item.type.includes(key)))
    .map((item) => item.type);
  return ops.length ? ops.join('、') : '无';
});
const postopAnalgesiaSummary = computed(() => (
  props.record.postoperativeAnalgesia
    ? (props.record.recordSummary?.analgesiaMethod ?? props.record.recoveryRecord?.conclusion ?? '已启用')
    : '未启用'
));
const summaryNotes = computed(() => ({
  inductionMeds: props.record.recordSummary?.notes?.inductionMeds ?? inductionMedSummary.value,
  inductionSummary: props.record.recordSummary?.notes?.inductionSummary ?? medSummary.value,
  specialMeds: autoSpecialMedsSummary.value || eventSummary.value,
  keyOperations: props.record.recordSummary?.notes?.keyOperations ?? operationSummary.value,
  postopAnalgesia: props.record.recordSummary?.notes?.postopAnalgesia ?? postopAnalgesiaSummary.value,
}));
const keyOperationsText = computed(() => resolveKeyOperationsDisplayText(
  props.record,
  props.methodKeys,
  props.record.recordSummary?.notes?.keyOperations,
  operationSummary.value,
));
const keyOperationLines = computed(() => parseNumberedNoteLines(keyOperationsText.value));
const specialMedicationSequenceMarkers = computed(() => {
  const numbers = specialNumberByMedId.value;
  return activeMedicationRecords.value
    .filter((row) => shouldRenderInSpecialMedication(row))
    .map((row) => {
      const no = numbers.get(row.id);
      if (!no) return null;
      const clock = isoOrClockToClock(medicationStartTime(row) ?? medicationEventTime(row) ?? row.time);
      if (!clock) return null;
      return {
        id: `special-med-${row.id}`,
        number: no,
        time: clockToIsoTime(clock),
        rowIndex: 3,
        tone: 'orange' as const,
        content: formatMedicationSpecialNoteLine(row, no),
        noteKey: 'specialMeds' as const,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
});
const sequenceMarkers = computed(() => {
  const operations = keyOperationLines.value;
  return [
    ...specialMedicationSequenceMarkers.value,
    ...buildSequenceMarkersFromNotes(operations, {
      rowIndex: 4,
      tone: 'pink',
      idPrefix: 'op',
      noteKey: 'keyOperations',
      clockToIso: clockToIsoTime,
    }),
  ];
});
const specialMedHighlightIndexes = computed(() => (
  highlightedSequence.value?.noteKey === 'specialMeds' ? [highlightedSequence.value.index] : []
));
const keyOperationHighlightIndexes = computed(() => (
  highlightedSequence.value?.noteKey === 'keyOperations' ? [highlightedSequence.value.index] : []
));
const isSequenceMarkerActive = (marker: { noteKey: 'specialMeds' | 'keyOperations'; number: number }) => (
  highlightedSequence.value?.noteKey === marker.noteKey && highlightedSequence.value.index === marker.number
);
const highlightSequenceMarker = (marker: { noteKey: 'specialMeds' | 'keyOperations'; number: number }) => {
  focusSequenceMarker(marker.noteKey, marker.number);
};
const medicationBandRef = ref<HTMLElement | null>(null);
const focusSequenceMarker = (noteKey: 'specialMeds' | 'keyOperations', index: number) => {
  if (highlightedSequence.value?.noteKey === noteKey && highlightedSequence.value.index === index) {
    highlightedSequence.value = null;
    return;
  }
  highlightedSequence.value = { noteKey, index };
  if (noteKey === 'specialMeds') {
    medicationBandRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }
  if (noteKey === 'keyOperations') {
    ioBandRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
};
const updateSummaryNote = (key: keyof typeof summaryNotes.value, value: string) => {
  emit('saveSummaryNotes', { [key]: value });
};

const formatDate = (value?: string) => (value ? dayjs(value).format('YYYY-MM-DD') : '-');
const medicationTimeText = (row: MedicationRecord) => {
  const start = isoOrClockToClock(row.startTime ?? row.time);
  if (row.mode !== '持续泵入') return start || '-';
  return `${start || '-'} - ${isoOrClockToClock(row.stopTime ?? row.endTime) || '进行中'}`;
};
const medicationDoseText = (row: MedicationRecord) => {
  const dose = `${row.dose ?? ''}${row.unit ?? ''}` || '-';
  if (row.mode !== '持续泵入') return dose;
  return [row.pumpRate, row.totalAmount ? `总量${row.totalAmount}` : '', row.concentration].filter(Boolean).join(' / ') || dose;
};
const fluidTimeText = (row: FluidRecord) => `${isoOrClockToClock(row.startTime ?? row.time) || '-'} - ${isoOrClockToClock(row.endTime) || '进行中'}`;
const planeDirectionText = (direction?: AnesthesiaPlaneRecord['direction']) => direction === 'up' ? '↑' : direction === 'fixed' ? '－' : '↓';
const previewDragClockTime = (event: PointerEvent) => {
  if (!dragState.active) return '';
  const targetPercent = ((event.clientX - dragState.left) / dragState.width) * 100;
  return percentToTime(targetPercent, sheetStart.value, sheetEnd.value);
};

const previewSegmentTimes = (event: PointerEvent) => {
  if (!dragState.active || !dragState.source || dragState.isPoint || dragState.kind === 'plane') return null;
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
  if (!dragState.active || !dragState.source) return;

  if (dragState.kind === 'plane') {
    const time = previewDragClockTime(event);
    const source = dragState.source as AnesthesiaPlaneRecord;
    segmentDragPreview.active = true;
    segmentDragPreview.isPoint = true;
    segmentDragPreview.isPlane = true;
    segmentDragPreview.band = 'medication';
    segmentDragPreview.style = pointStyle(time, 0, dragState.rowTotal);
    segmentDragPreview.label = `${source.level}${planeDirectionText(source.direction)}`;
    segmentDragPreview.timeHint = `平面 ${time}`;
    segmentDragPreview.startGuideStyle = { left: leftFor(time) };
    segmentDragPreview.tooltipStyle = {
      left: leftFor(time),
      top: topFor(0, dragState.rowTotal),
      transform: 'translate(-50%, calc(100% + 12px))',
    };
    return;
  }

  if (dragState.isPoint) {
    const time = previewDragClockTime(event);
    const source = dragState.source as MedicationRecord;
    const display = buildMedicationDisplayModel(source, {
      fallbackSheetEnd: sheetEnd.value,
      specialNo: specialNumberByMedId.value.get(source.id),
      sheetStart: sheetStart.value,
      sheetEnd: sheetEnd.value,
    });
    segmentDragPreview.active = true;
    segmentDragPreview.isPoint = true;
    segmentDragPreview.isPlane = false;
    segmentDragPreview.band = dragState.band;
    segmentDragPreview.style = pointStyle(time, dragState.rowIndex, dragState.rowTotal);
    segmentDragPreview.label = display.pointLabel;
    segmentDragPreview.timeHint = display.showInSpecialSection && display.specialNoDisplay
      ? `标定 ${time} · ${display.specialNoDisplay}`
      : `标定 ${time}`;
    segmentDragPreview.startGuideStyle = { left: leftFor(time) };
    segmentDragPreview.tooltipStyle = {
      left: leftFor(time),
      top: topFor(dragState.rowIndex, dragState.rowTotal),
      transform: 'translate(-50%, calc(-100% - 8px))',
    };
    return;
  }

  const moved = previewSegmentTimes(event);
  if (!moved) return;
  const durationLabel = formatSegmentDurationLabel(moved.start, moved.end);
  segmentDragPreview.active = true;
  segmentDragPreview.isPoint = false;
  segmentDragPreview.isPlane = false;
  segmentDragPreview.band = dragState.band;
  segmentDragPreview.style = segmentStyle(moved.start, moved.end, dragState.rowIndex, dragState.rowTotal);
  segmentDragPreview.label = durationLabel || moved.start;
  segmentDragPreview.startGuideStyle = { left: leftFor(moved.start) };
  const pointerLeft = `${Math.max(0, Math.min(100, ((event.clientX - dragState.left) / dragState.width) * 100))}%`;
  segmentDragPreview.tooltipStyle = {
    left: dragState.mode === 'end' ? pointerLeft : leftFor(moved.start),
    top: topFor(dragState.rowIndex, dragState.rowTotal),
    transform: 'translate(-50%, calc(-100% - 8px))',
  };
  if (dragState.mode === 'end') {
    segmentDragPreview.timeHint = `结束 ${moved.end}${durationLabel ? ` · ${durationLabel}` : ''}`;
  } else if (dragState.mode === 'start') {
    segmentDragPreview.timeHint = `开始 ${moved.start}${durationLabel ? ` · ${durationLabel}` : ''}`;
  } else {
    segmentDragPreview.timeHint = `开始 ${moved.start} · 结束 ${moved.end}`;
  }
};
const isAbnormal = (row: VitalSign, item: VitalSignDictItem) => {
  const value = row[item.shortCode as keyof VitalSign];
  if (typeof value !== 'number') return false;
  return (typeof item.lowerLimit === 'number' && value < item.lowerLimit) || (typeof item.upperLimit === 'number' && value > item.upperLimit);
};
const { chartPoints, chartLine, symbolText, markerPath, markerFill } = useVitalChartDrawing(
  () => chartDisplayVitals.value,
  () => sheetStart.value,
  () => sheetEnd.value,
);

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
  pendingDelete.value = false;
  menu.visible = true;
  menu.x = Math.min(event.clientX, window.innerWidth - 260);
  menu.y = Math.min(event.clientY, window.innerHeight - 360);
  menu.type = type;
  menu.target = target;
  menu.at = eventClock(event);
};
const closeMenu = () => { menu.visible = false; pendingDelete.value = false; };

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
  lineForm.isSpecial = Boolean(draft.isSpecial);
  if (draft.specialCategory !== undefined) lineForm.specialCategory = draft.specialCategory ?? '';
  lineForm.specialReason = draft.specialReason ?? draft.reason ?? '';
  lineForm.reason = lineForm.specialReason;
  lineForm.bloodType = draft.bloodType ?? '';
  lineForm.rh = draft.rh ?? '';
  lineForm.reaction = draft.reaction ?? '无';
  lineForm.bagNo = draft.bagNo ?? '';
  lineForm.anesthesiaConfirmed = Boolean(draft.anesthesiaConfirm);
  lineForm.circulatingConfirmed = Boolean(draft.circulatingConfirm);
};
const lineFormDefaultClock = () => resolveRecordSheetNowClock(props.record);

const applyDrugRecommend = (drug: DrugDictItem, options: { preserveMode?: boolean; resetUserTouch?: boolean } = {}) => {
  const patch = buildMedicationLineRecommendPatch(drug, {
    currentIsSpecial: lineForm.isSpecial,
    userTouchedIsSpecial: options.resetUserTouch ? false : lineForm.isSpecialUserTouched,
    preserveMode: options.preserveMode,
    currentMode: lineForm.mode,
  });
  lineForm.drugId = patch.drugId ?? '';
  if (patch.mode) lineForm.mode = patch.mode;
  lineForm.isSpecial = patch.isSpecial;
  lineForm.recommendIsSpecial = patch.recommendIsSpecial;
  lineForm.specialCategory = patch.specialCategory ?? '';
  lineForm.specialReason = patch.specialReason;
  lineForm.reason = patch.specialReason;
  if (patch.route) lineForm.route = patch.route;
  if (patch.unit) lineForm.unit = patch.unit;
  if (patch.highAlert !== undefined) lineForm.highAlert = patch.highAlert;
  if (options.resetUserTouch) lineForm.isSpecialUserTouched = false;
};

const openMedicationEditor = (source?: DrugDictItem | MedicationRecord) => {
  closeMenu();
  if (source && 'drug' in source) {
    lineForm.isSpecialUserTouched = true;
    const editTime = isoOrClockToClock(source.time ?? source.startTime) || lineFormDefaultClock();
    let editEnd = isoOrClockToClock(source.stopTime ?? source.endTime);
    if (source.mode === '持续泵入' && editTime && !editEnd) {
      editEnd = addMinutesToClock(editTime, LIVE_DEFAULT_SEGMENT_MINUTES);
    }
    applyLineDraft({
      kind: 'medication',
      id: source.id,
      name: source.drug,
      mode: source.mode,
      time: editTime,
      endTime: editEnd,
      amount: source.dose,
      unit: source.unit,
      route: source.route,
      executor: source.executor,
      checker: source.checker,
      highAlert: source.highAlert,
      isSpecial: source.isSpecial,
      specialReason: source.specialReason ?? source.reason,
      reason: source.specialReason ?? source.reason,
    });
    lineForm.drugId = source.drugId ?? findDrugByName(props.drugs, source.drug)?.id ?? '';
    lineForm.specialCategory = source.specialCategory ?? '';
    lineForm.recommendIsSpecial = Boolean(findDrugByName(props.drugs, source.drug)?.defaultIsSpecial);
  } else if (source) {
    lineForm.isSpecialUserTouched = false;
    applyLineDraft(createMedicationLineDraft(source, { at: lineFormDefaultClock(), executor: props.record.anesthesiologist }));
    applyDrugRecommend(source, { resetUserTouch: true });
  } else {
    const fallback = commonDrugs.value[0] ?? props.drugs.find((item) => item.enabled);
    if (fallback) applyLineDraft(createMedicationLineDraft(fallback, { at: lineFormDefaultClock(), executor: props.record.anesthesiologist }));
  }
  lineVisible.value = true;
};
const openFluidEditor = (source?: FluidBloodDictItem | FluidRecord) => {
  closeMenu();
  if (source && 'startTime' in source) {
    applyLineDraft({
      kind: isBloodProductCategory(source.category) ? 'transfusion' : 'infusion',
      id: source.id,
      name: source.name,
      category: source.category,
      time: isoOrClockToClock(source.startTime ?? source.time) || lineFormDefaultClock(),
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
      at: lineFormDefaultClock(),
      executor: props.record.anesthesiaNurse,
      bloodType: props.bloodTypes[0],
      rh: props.rhTypes[0],
    }));
  } else {
    const fallback = menu.type === 'transfusionGrid'
      ? bloodCatalog.value[0]
      : menu.type === 'autologousGrid'
        ? autologousCatalog.value[0]
        : infusionCatalog.value[0];
    if (fallback) applyLineDraft(createFluidLineDraft(fallback, { at: lineFormDefaultClock(), executor: props.record.anesthesiaNurse }));
  }
  lineVisible.value = true;
};
const syncMedicationForm = () => {
  const drug = findDrugByName(props.drugs, lineForm.name);
  if (!drug) return;
  const id = lineForm.id;
  const preserveMode = Boolean(id);
  applyLineDraft(createMedicationLineDraft(drug, { at: lineForm.time, executor: lineForm.executor }));
  lineForm.id = id;
  applyDrugRecommend(drug, { preserveMode, resetUserTouch: !id });
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
      drugId: lineForm.drugId || undefined,
      highAlert: lineForm.highAlert,
      isSpecial: lineForm.isSpecial,
      specialNo: lineForm.isSpecial ? specialNumberByMedId.value.get(lineForm.id) : undefined,
      specialCategory: lineForm.specialCategory || undefined,
      specialReason: lineForm.isSpecial ? (lineForm.specialReason || undefined) : undefined,
      reason: lineForm.isSpecial ? (lineForm.specialReason || undefined) : undefined,
      eventTime: lineForm.mode === '单次用药' || lineForm.mode === '间断追加' ? lineForm.time : undefined,
    });
  } else {
    const isBlood = lineForm.kind === 'transfusion';
    const fluidMeta = props.fluids.find((item) => item.name === lineForm.name);
    const category = isBlood
      ? '血液制品'
      : (lineForm.category || fluidMeta?.subCategory || '晶体液');
    emit('saveFluid', {
      id: lineForm.id,
      category,
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
const openProfessionalFieldEditor = (group: string, label: string, value: string) => {
  if (props.readOnly) return;
  professionalEditor.visible = true;
  professionalEditor.group = group;
  professionalEditor.label = label;
  professionalEditor.value = professionalFieldEdits[professionalFieldKey(group, label)] ?? value ?? '';
};
const saveProfessionalFieldEdit = () => {
  professionalFieldEdits[professionalFieldKey(professionalEditor.group, professionalEditor.label)] = professionalEditor.value;
  emit('saveProfessionalField', professionalEditor.group, professionalEditor.label, professionalEditor.value);
  professionalEditor.visible = false;
};
const openTargetEditor = () => {
  if (menu.type === 'plane') openPlaneEditor(menu.target as AnesthesiaPlaneRecord);
  if (menu.type === 'medication' || menu.type === 'inhaled') openMedicationEditor(menu.target as MedicationRecord);
  if (menu.type === 'infusion' || menu.type === 'autologous' || menu.type === 'transfusion') openFluidEditor(menu.target as FluidRecord);
  if (menu.type === 'vital') openMonitorDialog(menu.target as VitalSign);
  if (menu.type === 'output') openOutputEditor(menu.target as OutputDetailRecord);
};
const continueTarget = () => {
  if (menu.type === 'medication' || menu.type === 'inhaled') {
    const source = menu.target as MedicationRecord;
    openMedicationEditor({ ...source, id: '', time: isoOrClockToClock(source.stopTime ?? source.endTime) || lineFormDefaultClock() });
  }
  if (menu.type === 'infusion' || menu.type === 'autologous') {
    const source = menu.target as FluidRecord;
    openFluidEditor({ ...source, id: '', startTime: isoOrClockToClock(source.endTime) || menu.at });
  }
};
const menuTargetKind = (): 'medication' | 'fluid' | 'vital' | 'output' | 'plane' | null => {
  if (menu.type === 'medication' || menu.type === 'inhaled') return 'medication';
  if (menu.type === 'plane') return 'plane';
  if (menu.type === 'infusion' || menu.type === 'autologous' || menu.type === 'transfusion') return 'fluid';
  if (menu.type === 'vital') return 'vital';
  if (menu.type === 'output') return 'output';
  return null;
};
const voidTarget = () => {
  if (!hasLineTarget.value) return;
  const target = menu.target as { id?: string };
  const kind = menuTargetKind();
  if (!target.id || !kind) return;
  emit('voidRecord', kind, target.id);
  closeMenu();
};

const openMonitorDialog = (row?: VitalSign) => {
  closeMenu();
  monitorBatch.value = false;
  monitorVisible.value = true;
  monitorForm.id = row?.id ?? '';
  monitorForm.time = isoOrClockToClock(row?.time) || lineFormDefaultClock();
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
const patchMonitorForm = (patch: Record<string, unknown>) => {
  Object.assign(monitorForm, patch);
};
const patchMonitorValues = (patch: Record<string, string>) => {
  Object.assign(monitorValues, patch);
};
const shiftMonitorTime = (field: 'time' | 'endTime', deltaSteps: number) => {
  const delta = deltaSteps * 1;
  if (field === 'time') monitorForm.time = shiftClockValue(monitorForm.time, delta);
  else monitorEndTime.value = shiftClockValue(monitorEndTime.value, delta);
};
const shiftOutputTime = (deltaSteps: number) => { outputForm.time = shiftClockValue(outputForm.time, deltaSteps); };
const shiftOutputVolume = (deltaSteps: number) => {
  const step = 10;
  const current = Number(outputForm.volume);
  const base = Number.isFinite(current) ? current : 0;
  const next = Math.max(0, base + deltaSteps * step);
  outputForm.volume = next > 0 ? next : undefined;
};
const shiftLabTime = (deltaSteps: number) => {
  labForm.resultTime = shiftClockValue(labForm.resultTime, deltaSteps);
};
const patchLabForm = (patch: Record<string, unknown>) => {
  Object.assign(labForm, patch);
};
const shiftPlaneTime = (deltaSteps: number) => { planeForm.time = shiftClockValue(planeForm.time, deltaSteps); };
const shiftLineTime = (field: 'time' | 'endTime', deltaSteps: number) => {
  if (field === 'time') lineForm.time = shiftClockValue(lineForm.time, deltaSteps);
  else lineForm.endTime = shiftClockValue(lineForm.endTime, deltaSteps);
};
const patchLineForm = (patch: Record<string, unknown>) => {
  if (patch.isSpecial !== undefined) lineForm.isSpecialUserTouched = Boolean(patch.isSpecialUserTouched ?? true);
  Object.assign(lineForm, patch);
  if (lineForm.kind === 'medication' && patch.mode === '持续泵入' && !lineForm.endTime && lineForm.time) {
    lineForm.endTime = addMinutesToClock(lineForm.time, LIVE_DEFAULT_SEGMENT_MINUTES);
  }
  if (lineForm.kind === 'medication' && (patch.mode === '单次用药' || patch.mode === '间断追加')) {
    lineForm.endTime = '';
  }
  if (patch.specialReason !== undefined) lineForm.reason = String(patch.specialReason);
};
const patchOutputForm = (patch: Record<string, unknown>) => {
  Object.assign(outputForm, patch);
};
const openOutputEditor = (row?: OutputDetailRecord) => {
  closeMenu();
  outputVisible.value = true;
  outputForm.id = row?.id ?? '';
  outputForm.time = isoOrClockToClock(row?.time) || lineFormDefaultClock();
  outputForm.type = row?.type ?? '尿量';
  outputForm.volume = row?.volume;
  outputForm.remark = row?.remark ?? '';
};
const saveOutputForm = () => {
  const volume = Number(outputForm.volume);
  if (!Number.isFinite(volume) || volume <= 0) return;
  emit('saveOutput', {
    id: outputForm.id,
    time: outputForm.time,
    type: outputForm.type,
    volume,
    remark: outputForm.remark,
  });
  outputVisible.value = false;
};
const openLabEditor = (row?: LabResultRecord) => {
  closeMenu();
  labVisible.value = true;
  labForm.id = row?.id ?? '';
  labForm.resultTime = isoOrClockToClock(row?.resultTime) || lineFormDefaultClock();
  labForm.labType = row?.labType ?? '动脉血气';
  labForm.displayMode = row?.displayMode ?? 'number';
  const findValue = (code: string) => row?.items.find((item) => item.code === code)?.value ?? '';
  labForm.ph = findValue('pH');
  labForm.pco2 = findValue('pCO2');
  labForm.po2 = findValue('pO2');
  labForm.be = findValue('BE');
  labForm.lac = findValue('Lac');
};
const saveLabForm = () => {
  const items = [
    { code: 'pH', name: 'pH', value: labForm.ph, unit: '', abnormal: Number(labForm.ph) > 0 && (Number(labForm.ph) < 7.35 || Number(labForm.ph) > 7.45) },
    { code: 'pCO2', name: 'pCO2', value: labForm.pco2, unit: 'mmHg' },
    { code: 'pO2', name: 'pO2', value: labForm.po2, unit: 'mmHg' },
    { code: 'BE', name: 'BE', value: labForm.be, unit: 'mmol/L' },
    { code: 'Lac', name: 'Lac', value: labForm.lac, unit: 'mmol/L', abnormal: Number(labForm.lac) > 2 },
  ].filter((item) => item.value);
  emit('saveLab', {
    id: labForm.id || `lab-${Date.now()}`,
    resultTime: labForm.resultTime,
    labType: labForm.labType,
    items,
    displayMode: labForm.displayMode,
    displayNumber: (props.record.labResults?.filter((item) => item.status === 'active').length ?? 0) + 1,
    source: 'manual',
    status: 'active',
  });
  labVisible.value = false;
};
const pauseMedication = () => {
  const target = medicationTarget.value;
  if (!target || props.readOnly) return;
  emit('saveMedication', { ...target, status: 'paused', pauseTime: new Date().toISOString() });
  closeMenu();
};
const stopMedicationPump = () => {
  const target = medicationTarget.value;
  if (!target || props.readOnly) return;
  emit('stopMedicationPump', target.id);
  closeMenu();
};
const resumeMedication = () => {
  const target = medicationTarget.value;
  if (!target || props.readOnly) return;
  emit('saveMedication', { ...target, status: 'active', resumeTime: new Date().toISOString() });
  closeMenu();
};
const voidMedication = () => {
  const target = medicationTarget.value;
  if (!target || props.readOnly) return;
  emit('saveMedication', { ...target, status: 'voided', voidReason: '右键作废' });
  closeMenu();
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
const startPlaneDrag = (event: PointerEvent, source: AnesthesiaPlaneRecord) => {
  if (props.readOnly || event.button !== 0) return;
  const track = (event.currentTarget as HTMLElement).closest('.band-track');
  if (!track) return;
  const rect = track.getBoundingClientRect();
  dragState.active = true;
  dragState.isPoint = true;
  dragState.kind = 'plane';
  dragState.band = 'medication';
  dragState.mode = 'move';
  dragState.source = source;
  dragState.startX = event.clientX;
  dragState.left = rect.left;
  dragState.width = Math.max(1, rect.width);
  dragState.rowIndex = 0;
  dragState.rowTotal = medicationRowCount.value;
  updateSegmentDragPreview(event);
  window.addEventListener('pointermove', updateSegmentDragPreview);
  window.addEventListener('pointerup', finishSegmentDrag, { once: true });
};

const startMedicationPointDrag = (event: PointerEvent, source: MedicationRecord, rowIndex = 0, rowTotal = 1) => {
  if (props.readOnly || event.button !== 0) return;
  const track = (event.currentTarget as HTMLElement).closest('.band-track');
  if (!track) return;
  const rect = track.getBoundingClientRect();
  dragState.active = true;
  dragState.isPoint = true;
  dragState.kind = 'medication';
  dragState.band = isInhaledMedication(source, props.drugs) ? 'inhaled' : 'medication';
  dragState.mode = 'move';
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

const startSegmentDrag = (event: PointerEvent, kind: 'medication' | 'fluid', source: MedicationRecord | FluidRecord, mode: 'move' | 'start' | 'end', rowIndex = 0, rowTotal = 1) => {
  if (props.readOnly || event.button !== 0) return;
  const handleEl = event.currentTarget as HTMLElement;
  const track = handleEl.closest('.band-track');
  if (!track) return;
  dragState.captureEl = handleEl;
  if (handleEl.setPointerCapture) {
    try {
      handleEl.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  }
  const rect = track.getBoundingClientRect();
  dragState.active = true;
  dragState.isPoint = false;
  dragState.kind = kind;
  if (kind === 'medication') {
    dragState.band = isInhaledMedication(source as MedicationRecord, props.drugs) ? 'inhaled' : 'medication';
  } else {
    const category = (source as FluidRecord).category;
    dragState.band = isBloodProductCategory(category)
      ? 'transfusion'
      : isAutologousFluidCategory(category)
        ? 'autologous'
        : 'infusion';
  }
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
  try {
  if (!dragState.active || !dragState.source) return;
  updateSegmentDragPreview(event);
  const deltaPercent = ((event.clientX - dragState.startX) / dragState.width) * 100;
  const targetPercent = ((event.clientX - dragState.left) / dragState.width) * 100;
  if (dragState.mode === 'move' && Math.abs(deltaPercent) < 0.2) {
    dragState.active = false;
    dragState.isPoint = false;
    dragState.source = null;
    segmentDragPreview.active = false;
    window.removeEventListener('pointermove', updateSegmentDragPreview);
    return;
  }
  if (dragState.isPoint && dragState.kind === 'medication') {
    const source = dragState.source as MedicationRecord;
    const time = previewDragClockTime(event);
    emit('saveMedication', {
      ...source,
      time,
      eventTime: time,
      endTime: undefined,
      stopTime: undefined,
    });
    dragState.active = false;
    dragState.isPoint = false;
    dragState.source = null;
    segmentDragPreview.active = false;
    window.removeEventListener('pointermove', updateSegmentDragPreview);
    return;
  }
  if (dragState.kind === 'plane') {
    const source = dragState.source as AnesthesiaPlaneRecord;
    const time = previewDragClockTime(event);
    emit('savePlane', { ...source, time });
    dragState.active = false;
    dragState.isPoint = false;
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
    const renderLine = shouldRenderAsLine(source);
    emit('saveMedication', {
      ...source,
      time: moved.start,
      startTime: moved.start,
      endTime: renderLine ? moved.end : undefined,
      stopTime: renderLine ? moved.end : undefined,
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
  dragState.isPoint = false;
  dragState.source = null;
  segmentDragPreview.active = false;
  window.removeEventListener('pointermove', updateSegmentDragPreview);
  } finally {
    releaseSegmentPointer(event);
  }
};
watch(layoutWarningPayload, (warnings) => {
  emit('layoutWarnings', warnings);
}, { immediate: true });

const dismissMenuOnOutside = (event: MouseEvent) => {
  if (!menu.visible) return;
  const target = event.target as HTMLElement | null;
  if (target?.closest('.live-context-menu')) return;
  closeMenu();
};

const dismissMenuOnEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') closeMenu();
};

defineExpose({
  openDataList,
  flashEventType,
  focusTimelineNode,
  scrollStatusRowIntoView,
  openMedicationEntry: () => openMedicationEditor(),
  openInfusionEntry: () => {
    const fallback = infusionCatalog.value[0];
    if (fallback) openFluidEditor(fallback);
  },
  openTransfusionEntry: () => {
    const fallback = bloodCatalog.value[0];
    if (fallback) openFluidEditor(fallback);
  },
  openAutologousEntry: () => {
    const fallback = autologousCatalog.value[0];
    if (fallback) openFluidEditor(fallback);
  },
  openVitalEntry: () => openMonitorDialog(),
  openOutputEntry: (type: import('@/types/anesthesia').OutputDetailRecord['type'] = '尿量') => {
    openOutputEditor();
    outputForm.type = type;
  },
  openLabEntry: () => openLabEditor(),
});
onMounted(() => {
  document.addEventListener('click', dismissMenuOnOutside);
  document.addEventListener('keydown', dismissMenuOnEscape);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', dismissMenuOnOutside);
  document.removeEventListener('keydown', dismissMenuOnEscape);
  window.removeEventListener('pointerup', finishSegmentDrag);
  window.removeEventListener('pointermove', updateSegmentDragPreview);
  window.removeEventListener('pointermove', updateVitalDragPreview);
  window.removeEventListener('pointerup', finishVitalPointDrag);
});
</script>

<style scoped>
.live-record-card {
  /* 布局尺寸 */
  --sheet-side-col: 24px;
  --sheet-label-col: 96px;
  --sheet-left-total: 120px;
  --chart-status-row: 24px;
  --chart-scale-gutter: 62px;
  --chart-plot-offset: var(--chart-scale-gutter);

  /*
   * 统一视觉规范（设计令牌）。麻醉记录单是正式医疗文书，配色应专业克制：
   * 以墨色线框为骨架，仅在“用药/输液/输血/吸入/监测”等业务维度使用低饱和的区分色。
   * 修改配色或线宽时只需调整此处，打印（彩色 / 黑白）与屏幕共用同一套令牌。
   */
  /* 文字与框线 */
  --sheet-ink: #111827;
  --sheet-ink-soft: #334155;
  --sheet-muted: #64748b;
  --sheet-frame: #111827;
  --sheet-grid-minor: #94a3b8;
  --sheet-grid-major: #111827;
  --sheet-row-line: #aeb8c4;
  --sheet-label-bg: #f8fafc;
  /* 线宽 */
  --sheet-segment-width: 3px;
  /* 业务维度区分色（线 / 点）*/
  --sheet-drug-ink: #111827;
  --sheet-drug-fill: #fef08a;
  --sheet-iv-fluid: #047857;
  --sheet-blood: #dc2626;
  --sheet-inhaled: #7c3aed;
  --sheet-autologous: #b45309;
  --sheet-monitor: #165dff;
  --sheet-abnormal: #dc2626;
  /* 状态色 */
  --sheet-active: #2563eb;
  --sheet-template: #165dff;
  --sheet-locked: #d97706;
  --sheet-rescue: #dc2626;
  --sheet-recent: #00b42a;

  position: relative;
  width: 100%;
  border: 2px solid var(--sheet-frame);
  background: #fff;
  color: var(--sheet-ink);
  font-family: "SimSun", "Microsoft YaHei", serif;
  letter-spacing: 0;
  overflow-x: hidden;
  overflow-y: visible;
  min-width: 0;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.12);
}

.live-record-card.is-rescue {
  border-color: var(--sheet-rescue);
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.12), 0 18px 48px rgba(15, 23, 42, 0.12);
}

.live-record-card.is-locked {
  box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.18), 0 18px 48px rgba(15, 23, 42, 0.12);
}

.live-record-card.is-print-mode {
  --sheet-side-col: 16px;
  --sheet-label-col: 70px;
  --sheet-left-total: 86px;
  --chart-status-row: 15px;
  --chart-scale-gutter: 46px;
  font-size: 8.5px;
  box-shadow: none;
}

/* 打印分页页码：每页右下角，不与末页签名区重叠 */
.print-page-mark {
  display: none;
}

/* 打印态：生命体征事件标记为纯展示，去除交互 */
.live-record-card.is-print-mode .chart-status-symbol {
  pointer-events: none;
  cursor: default;
}

.live-record-card.is-print-mode .print-page-mark {
  display: block;
  position: absolute;
  right: 8px;
  bottom: 4px;
  padding: 1px 6px;
  border: 1px solid var(--sheet-grid-minor);
  border-radius: 3px;
  background: #fff;
  color: var(--sheet-muted);
  font-size: 8px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.live-record-card.is-print-mode :deep(.record-header) {
  padding: 1px 5px 0;
}

.live-record-card.is-print-mode :deep(.record-header .print-heading) {
  margin-bottom: 0;
}

.live-record-card.is-print-mode :deep(.record-header .print-heading h2) {
  font-size: 12px;
  line-height: 1;
}

.live-record-card.is-print-mode :deep(.record-header .doc-meta),
.live-record-card.is-print-mode :deep(.paper-field-label),
.live-record-card.is-print-mode :deep(.paper-picker-label),
.live-record-card.is-print-mode :deep(.paper-field-value),
.live-record-card.is-print-mode :deep(.paper-picker-readonly) {
  font-size: 9px;
  line-height: 1.05;
}

.live-record-card.is-print-mode :deep(.paper-field-value),
.live-record-card.is-print-mode :deep(.paper-picker-readonly) {
  min-height: 10px;
  padding-bottom: 0;
}

.live-record-card.is-print-mode :deep(.patient-grid),
.live-record-card.is-print-mode :deep(.block-grid) {
  gap: 0 4px;
  padding: 0;
}

.live-record-card.is-print-mode :deep(.block-title) {
  padding: 1px 0;
  font-size: 9px;
  line-height: 1.1;
}

.live-record-card.is-print-mode :deep(.header-block:last-child) {
  padding-bottom: 2px;
}

.sheet-lock-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 9px 14px;
  border-bottom: 2px solid #d97706;
  background: linear-gradient(180deg, #fff7ed 0%, #fffbeb 100%);
  color: #92400e;
  font-size: 12px;
  line-height: 1.4;
}

.sheet-lock-banner strong {
  color: #b45309;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0;
}

.sheet-lock-icon {
  font-size: 14px;
  line-height: 1;
}

.sheet-lock-desc {
  color: #78350f;
}

.sheet-print-watermark {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  color: rgba(148, 163, 184, 0.85);
  font-size: 11px;
  letter-spacing: 0;
  pointer-events: none;
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

.sheet-professional-summary {
  display: grid;
  gap: 6px;
  padding: 6px 10px;
  margin-top: 4px;
  border-top: 1px solid #111827;
  border-bottom: 1px solid #111827;
  background: #f8fafc;
  font-size: 11px;
}

.sheet-professional-summary.is-collapsed {
  padding: 4px 10px;
  background: #f1f5f9;
}

.sheet-professional-summary.is-print {
  background: #fcfdff;
  font-size: 10px;
}

.sheet-professional-summary.has-impact {
  background: linear-gradient(90deg, #f0f7ff 0%, #f8fafc 28%, #f8fafc 100%);
}

.professional-summary-head {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.professional-summary-head strong {
  font-size: 12px;
}

.professional-summary-head span:not(.recent-event-pill):not(.professional-count) {
  padding-bottom: 1px;
  border-bottom: 1px solid #cbd5e1;
}

.professional-count {
  color: #64748b;
  font-size: 10px;
}

.professional-toggle {
  margin-left: auto;
  border: 1px solid #94a3b8;
  border-radius: 4px;
  background: #fff;
  padding: 2px 8px;
  font-size: 10px;
  cursor: pointer;
}

.professional-toggle:hover {
  border-color: #2563eb;
  color: #2563eb;
}

.professional-collapsed-hint {
  margin: 0;
  color: #64748b;
  font-size: 10px;
  line-height: 1.4;
}

.professional-paper-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  max-height: min(180px, 28vh);
  overflow: auto;
  padding-right: 2px;
}

.sheet-professional-summary.is-print .professional-paper-grid {
  max-height: none;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.professional-paper-group {
  min-width: 0;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  padding: 4px 6px;
  background: #fff;
}

.professional-paper-group b {
  display: block;
  margin-bottom: 2px;
  font-size: 10px;
  color: #334155;
}

.professional-paper-group dl {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2px 6px;
}

.professional-paper-group dl div {
  display: contents;
}

.professional-editable-field {
  display: contents;
}

.professional-paper-group dt,
.professional-paper-group dd {
  margin: 0;
  font-size: 9px;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.professional-paper-group dt {
  color: #64748b;
}

.professional-paper-group dd {
  color: #0f172a;
}

.professional-paper-group.template-events p,
.professional-paper-group.quality-tips p {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 9px;
}

.recent-event-pill {
  border: 1px solid #27c346;
  border-radius: 999px;
  padding: 2px 8px !important;
  background: #f0fff4;
  color: #15803d;
  border-bottom: none !important;
}

.professional-editable-field:not(.disabled) {
  cursor: text;
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
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.sheet-ruler,
.sheet-band {
  display: grid;
  grid-template-columns: var(--sheet-left-total) 1fr;
  border-bottom: 1px solid #111827;
}

.vital-chart {
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

.live-record-card.is-print-mode .sheet-ruler {
  margin: 2px 0 0;
}

.live-record-card.is-print-mode .sheet-band {
  min-height: calc(var(--rows, 3) * 10.5px);
}

.live-record-card.is-print-mode .band-track,
.live-record-card.is-print-mode .medication-band,
.live-record-card.is-print-mode .monitor-band {
  min-height: calc(var(--rows, 3) * 10.5px);
}

.live-record-card.is-print-mode .band-side {
  padding: 2px 1px;
  font-size: 9px;
  line-height: 1.1;
  letter-spacing: 0;
}

.live-record-card.is-print-mode .band-labels span {
  min-height: 10.5px;
  padding: 1px 2px;
  font-size: 8.5px;
  line-height: 1.05;
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
  grid-template-columns: var(--sheet-side-col) var(--sheet-label-col) 1fr;
  min-height: calc(var(--rows, 3) * 24px);
}

.band-side {
  writing-mode: vertical-rl;
  letter-spacing: 0;
  padding: 6px 2px;
  line-height: 1.35;
  font-size: 11px;
}

.band-labels {
  display: grid;
  grid-template-rows: repeat(var(--rows, 3), minmax(0, 1fr));
  border-right: 1px solid #111827;
}

.band-labels span {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 3px 4px;
  font-size: 11px;
  line-height: 1.25;
  border-bottom: 1px solid #b8c0cc;
  font-size: 12px;
  line-height: 1.35;
  text-align: center;
  overflow: hidden;
}

.band-track {
  min-height: calc(var(--rows, 3) * 26px);
}

.medication-band {
  min-height: 96px;
  margin-top: 4px;
}

.medication-band .band-labels span:first-child {
  padding-top: 4px;
}

.monitor-band {
  min-height: calc(var(--rows, 4) * 26px);
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
  border-left: 1px solid var(--sheet-grid-minor);
}

:deep(.print-grid-lines span.major) {
  border-left-color: var(--sheet-grid-major);
}

:deep(.print-row-lines span),
:deep(.print-chart-horizontal-lines span) {
  left: 0;
  right: 0;
  height: 0;
  border-top: 1px solid var(--sheet-row-line);
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
  max-width: 52px;
  padding: 0 4px;
  border: 1px solid var(--sheet-drug-ink);
  background: var(--sheet-drug-fill);
  font-weight: 700;
  cursor: grab;
}

.drug-point.is-special {
  max-width: 28px;
  border-color: #b45309;
  background: #fffbeb;
  color: #92400e;
}

.drug-point:active {
  cursor: grabbing;
}

.drug-point.drag-preview {
  z-index: 6;
  opacity: 0.72;
  pointer-events: none;
  border-style: dashed;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.2);
}

.drug-point.is-template {
  border-color: var(--sheet-template);
  background: #dbeafe;
  color: #0f3a8c;
}

.blood-point,
.output-point {
  color: var(--sheet-blood);
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
  color: var(--sheet-monitor);
  font-weight: 700;
  line-height: 1;
  pointer-events: auto;
  transform: translate(-50%, -50%);
}

.monitor-value.abnormal {
  color: var(--sheet-abnormal);
}

.medication-band .band-track,
.inhaled-band .band-track {
  overflow-x: hidden;
  overflow-y: visible;
  box-sizing: border-box;
}

.medication-band .band-track {
  padding-top: 2px;
}

.line-segment {
  position: absolute;
  z-index: 3;
  transform: translateY(-50%);
  min-width: 24px;
  max-width: 100%;
  height: 18px;
  overflow: visible;
  box-sizing: border-box;
  border-top: var(--sheet-segment-width) solid var(--sheet-monitor);
  color: var(--sheet-monitor);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.line-segment.line-label--special-no {
  color: #b45309;
}

.line-segment::before,
.line-segment::after {
  content: '';
  position: absolute;
  top: calc(-1 * var(--sheet-segment-width) - 4px);
  width: 0;
  height: 11px;
  border-left: var(--sheet-segment-width) solid currentColor;
  pointer-events: none;
}

.line-segment::before {
  left: 0;
}

.line-segment::after {
  right: 0;
}

.segment-edge {
  position: absolute;
  top: 50%;
  z-index: 6;
  width: 12px;
  height: 22px;
  opacity: 0;
  transform: translateY(-50%);
  cursor: ew-resize;
  touch-action: none;
}

.segment-edge-start {
  left: 0;
  transform: translate(-50%, -50%);
}

.segment-edge-end {
  right: 0;
  transform: translate(50%, -50%);
}

.line-segment.is-template {
  border-top-color: var(--sheet-template);
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
  cursor: grab;
}

.plane-marker:active {
  cursor: grabbing;
}

.plane-marker.drag-preview {
  z-index: 6;
  opacity: 0.72;
  pointer-events: none;
  border-style: dashed;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.2);
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

.segment-drag-start-guide {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 7;
  border-left: 2px dashed #b45309;
  pointer-events: none;
  transform: translateX(-50%);
}

.segment-drag-tooltip {
  position: absolute;
  z-index: 12;
  padding: 2px 8px;
  border: 1px solid #b45309;
  border-radius: 4px;
  background: #fffbeb;
  color: #92400e;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.3;
  pointer-events: none;
  white-space: nowrap;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.12);
}

.segment-label {
  position: absolute;
  top: 50%;
  left: 50%;
  display: inline-block;
  max-width: calc(100% - 8px);
  padding: 0 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  background: rgba(255, 255, 255, 0.92);
  line-height: 1.15;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.live-record-card.is-print-mode .segment-label {
  font-size: 9px;
  padding: 0 2px;
}

.live-record-card.is-print-mode .drug-point {
  max-width: 40px;
  font-size: 10px;
}

.inhaled-line {
  border-top-color: var(--sheet-inhaled);
  color: var(--sheet-inhaled);
}

.inhaled-point {
  color: var(--sheet-inhaled);
  border-color: var(--sheet-inhaled);
}

.autologous-line {
  border-top-color: var(--sheet-autologous);
  color: var(--sheet-autologous);
}

.fluid-line {
  border-top-color: var(--sheet-iv-fluid);
  color: var(--sheet-iv-fluid);
}

.blood-line {
  border-top-color: var(--sheet-blood);
  color: var(--sheet-blood);
}

.vital-chart {
  min-height: 280px;
}

.live-record-card.is-print-mode .vital-chart,
.live-record-card.is-print-mode .chart-layout,
.live-record-card.is-print-mode .chart-area {
  min-height: 140px;
}

.live-record-card.is-print-mode :deep(.chart-legend-panel) {
  gap: 2px;
  min-height: 140px;
  padding: 3px 4px;
  font-size: 8px;
}

.live-record-card.is-print-mode :deep(.event-legend-pairs),
.live-record-card.is-print-mode :deep(.room-entry-legend),
.live-record-card.is-print-mode :deep(.vital-symbol-legend) {
  gap: 1px;
}

.live-record-card.is-print-mode :deep(.legend-pair-row span),
.live-record-card.is-print-mode :deep(.room-entry-legend span),
.live-record-card.is-print-mode :deep(.vital-symbol-legend span) {
  min-height: 12px;
  line-height: 1.05;
}

.live-record-card.is-print-mode .chart-status-symbol {
  min-width: 16px;
  height: 16px;
  font-size: 10px;
}

.live-record-card.is-print-mode .chart-status-overlay {
  top: 1px;
  height: 16px;
}

.chart-layout {
  display: grid;
  grid-template-columns: var(--sheet-left-total) 1fr;
  min-height: 280px;
}

.chart-area {
  min-height: 280px;
}

.temp-scale-tick {
  position: absolute;
  transform: translateY(-50%);
  color: #166534;
  font-size: 11px;
  font-weight: 600;
}

.chart-area {
  position: relative;
  min-height: 300px;
  padding-top: var(--chart-status-row);
}

.chart-status-overlay {
  position: absolute;
  top: 4px;
  left: var(--chart-plot-offset);
  right: 0;
  z-index: 5;
  height: 22px;
  pointer-events: none;
}

.chart-status-symbol {
  position: absolute;
  top: 0;
  pointer-events: auto;
  display: inline-grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  transform: translateX(-50%);
  border: 1px solid #64748b;
  border-radius: 50%;
  background: #fff;
  color: #111827;
  font-size: 14px;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
}

.chart-status-symbol.is-active {
  box-shadow: 0 0 0 2px var(--sheet-active);
  background: #eff6ff;
}

.chart-status-symbol.is-critical {
  border-color: var(--sheet-rescue);
  color: var(--sheet-rescue);
}

.chart-status-symbol.is-template {
  border-color: var(--sheet-template);
  background: #e8f3ff;
  color: #0f3a8c;
  box-shadow: 0 0 0 3px rgba(22, 93, 255, 0.12);
}

.chart-status-symbol.is-recent {
  border-color: var(--sheet-recent);
  background: #f0fff4;
  color: #15803d;
  box-shadow: 0 0 0 4px rgba(0, 180, 42, 0.14);
}

.chart-area .chart-scale {
  position: absolute;
  left: 0;
  top: var(--chart-status-row);
  bottom: 0;
  width: var(--chart-scale-gutter);
  border-right: 1px solid #111827;
  background: #f8fafc;
  z-index: 2;
  pointer-events: none;
}

.chart-scale {
  position: relative;
}

.chart-scale span {
  position: absolute;
  left: 25px;
  transform: translateY(-50%);
  font-size: 11px;
}

.chart-scale .temp-scale-tick {
  left: 4px;
  color: #166534;
  font-weight: 700;
}

.chart-scale em {
  position: absolute;
  right: 3px;
  transform: translateY(-50%);
  color: #475569;
  font-size: 11px;
  font-style: normal;
}

.chart-scale small {
  position: absolute;
  left: 4px;
  bottom: 2px;
  color: #475569;
  font-size: 10px;
}

.chart-scale .kpa-label {
  right: 4px;
  left: auto;
}

.chart-area svg {
  position: absolute;
  top: var(--chart-status-row);
  right: 0;
  bottom: 0;
  left: var(--chart-plot-offset);
  z-index: 2;
  width: calc(100% - var(--chart-plot-offset));
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

.sheet-notes {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.sheet-notes div {
  min-height: 0;
  padding: 0;
  border-right: 1px solid #111827;
}

.sheet-notes p {
  margin: 6px 0 0;
  line-height: 1.5;
}

.reference-notes {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  border-top: 1px solid #111827;
  border-bottom: 1px solid #111827;
}

.chart-area :deep(.print-grid-lines),
.chart-area :deep(.print-row-lines),
.chart-area :deep(.print-chart-horizontal-lines) {
  left: var(--chart-plot-offset);
}

.live-record-card.is-print-mode .reference-notes {
  min-height: 0;
}

.live-record-card.is-print-mode :deep(.numbered-note-column) {
  padding: 3px 5px;
}

.live-record-card.is-print-mode :deep(.numbered-note-label),
.live-record-card.is-print-mode :deep(.numbered-note-list),
.live-record-card.is-print-mode :deep(.numbered-note-empty) {
  font-size: 9px;
  line-height: 1.18;
}

.live-record-card.is-print-mode :deep(.numbered-note-label) {
  margin-bottom: 2px;
}

.live-record-card.is-print-mode :deep(.numbered-note-list li + li) {
  margin-top: 1px;
}

.live-record-card.is-print-mode :deep(.record-footer-summary.is-print) {
  gap: 2px;
  padding-top: 1px;
  font-size: 8.5px;
}

.live-record-card.is-print-mode :deep(.footer-io-print-table table) {
  font-size: 8.5px;
}

.live-record-card.is-print-mode :deep(.footer-io-print-table th),
.live-record-card.is-print-mode :deep(.footer-io-print-table td) {
  padding: 0 3px;
}

.live-record-card.is-print-mode :deep(.record-footer-summary.is-print .footer-fields) {
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 2px;
}

.live-record-card.is-print-mode :deep(.record-footer-summary.is-print .footer-field) {
  gap: 1px;
  padding: 1px 3px;
}

.live-record-card.is-print-mode :deep(.footer-field label),
.live-record-card.is-print-mode :deep(.footer-value),
.live-record-card.is-print-mode :deep(.footer-signature > strong),
.live-record-card.is-print-mode :deep(.footer-completed strong) {
  font-size: 9px;
  line-height: 1.05;
}

.live-record-card.is-print-mode :deep(.footer-value) {
  min-height: 10px;
  padding: 0 2px;
}

.live-record-card.is-print-mode :deep(.record-footer-summary.is-print .footer-meta) {
  padding: 2px 4px;
  gap: 4px 8px;
}

.live-record-card.is-print-mode :deep(.footer-signature) {
  gap: 4px 8px;
}

.sequence-marker {
  position: absolute;
  z-index: 4;
  display: inline-grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  padding: 0 4px;
  border: 1.5px solid #111827;
  border-radius: 4px;
  background: #fff;
  transform: translate(-50%, -50%);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.sequence-marker.is-active {
  box-shadow: 0 0 0 2px var(--sheet-active);
}

.sequence-marker.orange {
  border-color: #ea580c;
  background: #ffedd5;
  color: #9a3412;
}

.sequence-marker.pink {
  border-color: #db2777;
  background: #fce7f3;
  color: #9d174d;
}

.output-badge.blood-loss {
  min-width: 34px;
  padding: 2px 6px;
  border: 1.5px solid #db2777;
  border-radius: 4px;
  background: #fce7f3;
  color: #9d174d;
  font-weight: 800;
  text-align: center;
}

.live-data-table button {
  border: 0;
  border-radius: 5px;
  padding: 7px 10px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.live-data-table button:hover {
  background: #e8f3ff;
}

.danger-menu {
  color: var(--sheet-blood, #dc2626);
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
.live-modal-body select,
.live-modal-body textarea {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 32px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 3px 7px;
  background: #fff;
}

.live-modal-body textarea {
  resize: vertical;
  line-height: 1.45;
}

.line-form-body,
.professional-editor-body {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 12px;
}

.line-form-body label,
.professional-editor-body label {
  margin-bottom: 0;
}

.line-form-body .field-wide,
.professional-editor-body .field-wide {
  grid-column: 1 / -1;
}

.mode-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.mode-options label {
  justify-content: center;
  min-height: 32px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #fff;
}

.mode-options label:has(input:checked) {
  border-color: #165dff;
  background: #eef5ff;
  color: #0f3a8c;
  font-weight: 700;
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
  vertical-align: middle;
  white-space: nowrap;
}

.live-data-table th {
  background: #f8fafc;
  color: #334155;
  font-weight: 700;
}

.table-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  min-height: 22px;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  padding: 0 8px;
  background: #f8fafc;
  color: #334155;
  font-size: 12px;
  font-weight: 700;
}

.table-pill.continuous {
  border-color: #165dff;
  background: #eef5ff;
  color: #0f3a8c;
}

.table-pill.fluid {
  border-color: #0f766e;
  background: #ecfdf5;
  color: #047857;
}

.table-pill.danger {
  border-color: #f87171;
  background: #fef2f2;
  color: #b91c1c;
}

.live-data-table tr.row-voided td {
  color: #94a3b8;
  text-decoration: line-through;
  background: #f8fafc;
}

.live-data-table tr.row-voided td:last-child {
  text-decoration: none;
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

.live-record-card.is-print-mode :deep(.sheet-ruler) {
  margin: 2px 0 0;
  font-size: 9px;
}

.live-record-card.is-print-mode :deep(.ruler-label) {
  min-height: 20px;
  padding: 1px 3px;
}

.live-record-card.is-print-mode :deep(.ruler-kind),
.live-record-card.is-print-mode :deep(.ruler-page),
.live-record-card.is-print-mode :deep(.ruler-track .tick-label) {
  font-size: 9px;
  line-height: 1.05;
}

.live-record-card.is-print-mode :deep(.ruler-track) {
  height: 20px;
}

.live-record-card.is-print-mode .sheet-band {
  min-height: calc(var(--rows, 3) * 10.5px);
}

.live-record-card.is-print-mode .band-side {
  padding: 2px 1px;
  font-size: 9px;
  line-height: 1.1;
  letter-spacing: 0;
}

.live-record-card.is-print-mode .band-labels span {
  min-height: 10.5px;
  padding: 1px 2px;
  font-size: 8.5px;
  line-height: 1.05;
}

.live-record-card.is-print-mode .vital-chart,
.live-record-card.is-print-mode .chart-layout,
.live-record-card.is-print-mode .chart-area {
  min-height: 140px;
}

.live-record-card.is-print-mode .chart-status-symbol {
  min-width: 16px;
  height: 16px;
  font-size: 10px;
}

.live-record-card.is-print-mode .chart-status-overlay {
  top: 1px;
  height: 16px;
}

.live-record-card.is-print-mode .chart-scale span,
.live-record-card.is-print-mode .chart-scale em,
.live-record-card.is-print-mode .chart-scale small {
  font-size: 9px;
}

@media print {
  .live-record-card {
    width: 100%;
    max-width: 100%;
    overflow: visible;
    border: 1px solid #111;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  /* 避免时间段、趋势图、底部汇总在物理分页处被拦腰截断 */
  .sheet-ruler,
  .sheet-band,
  .vital-chart,
  .reference-notes {
    break-inside: avoid;
  }

  .is-print-mode .sequence-marker {
    pointer-events: none;
    cursor: default;
  }

  .is-print-mode .drag-guide,
  .is-print-mode .drag-tooltip,
  .is-print-mode .segment-drag-start-guide,
  .is-print-mode .segment-drag-tooltip,
  .is-print-mode .line-segment.drag-preview,
  .is-print-mode .drug-point.drag-preview,
  .is-print-mode .plane-marker.drag-preview,
  .is-print-mode .sheet-lock-banner,
  .is-print-mode .sheet-print-watermark,
  .is-print-mode .live-context-menu {
    display: none !important;
  }

  .is-print-mode .chart-status-symbol {
    pointer-events: none;
    cursor: default;
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
