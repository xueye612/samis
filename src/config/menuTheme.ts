import type { AppIconName } from '@/icons/registry';

/** 一级菜单图标映射（统一视觉，不再按模块分色） */
export const primaryMenuTheme: Record<string, { icon: AppIconName }> = {
  workbench: { icon: 'IconDashboard' },
  preoperative: { icon: 'IconCompass' },
  surgery: { icon: 'IconExperiment' },
  pacu: { icon: 'IconHeart' },
  postoperative: { icon: 'IconBookmark' },
  quality: { icon: 'IconBarChart' },
  reports: { icon: 'IconArrowRise' },
  config: { icon: 'IconSettings' },
  system: { icon: 'IconStorage' },
};

export function menuIconFor(key: string): AppIconName {
  return primaryMenuTheme[key]?.icon ?? 'IconApps';
}
