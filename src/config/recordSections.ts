/**
 * 麻醉记录单「可选区块」显示配置。
 *
 * 记录单上的部分区块并非每台手术都需要（如吸入麻醉带、自体血回输带、麻醉平面、
 * 术后镇痛栏、专业附页）。过去这些区块的显隐要么写死、要么依据“药品/液体字典里
 * 是否存在该类条目”来判断——后者会导致明明本台手术没用到，却因为字典里有该项而
 * 始终显示。此处把显隐收敛为可配置模型：
 *
 * - `auto`：按“本台病例是否真的有数据/适应症”自动显隐（推荐默认）。
 * - `show`：强制显示（例如想预留空带以便术中补录）。
 * - `hide`：强制隐藏（例如 TIVA 全凭静脉不需要吸入麻醉带）。
 *
 * 配置存储在记录草稿中（按病例维度），后续可平滑接入后端/科室级默认配置。
 */

export type SectionVisibilityMode = 'auto' | 'show' | 'hide';

export type RecordSectionKey =
  | 'inhaled'
  | 'autologous'
  | 'plane'
  | 'postopAnalgesia'
  | 'professionalAppendix';

export interface RecordSectionDef {
  key: RecordSectionKey;
  label: string;
  hint: string;
}

/** 可由用户配置显隐的可选区块（顺序即设置面板展示顺序）。 */
export const OPTIONAL_RECORD_SECTIONS: RecordSectionDef[] = [
  { key: 'inhaled', label: '吸入麻醉带', hint: '自动：仅全麻或已录入吸入药时显示' },
  { key: 'autologous', label: '自体血回输带', hint: '自动：仅标记回收式自体血或已录入时显示' },
  { key: 'plane', label: '麻醉平面', hint: '自动：椎管内麻醉时显示' },
  { key: 'postopAnalgesia', label: '术后镇痛栏', hint: '自动：已启用术后镇痛时显示' },
  { key: 'professionalAppendix', label: '专业麻醉记录附页（打印）', hint: '打印时附在末页' },
];

export type RecordSectionVisibility = Partial<Record<RecordSectionKey, SectionVisibilityMode>>;

/**
 * 计算某区块的最终显隐：show/hide 为显式覆盖，auto 回退到“是否有数据/适应症”。
 */
export function resolveSectionVisible(mode: SectionVisibilityMode | undefined, autoVisible: boolean): boolean {
  if (mode === 'show') return true;
  if (mode === 'hide') return false;
  return autoVisible;
}
