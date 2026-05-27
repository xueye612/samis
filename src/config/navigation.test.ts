import { primaryMenus, secondaryMenus } from '@/config/navigation';

describe('navigation menu structure', () => {
  it('uses the approved nine primary menus for a complete anesthesia system', () => {
    expect(primaryMenus.map((item) => item.key)).toEqual([
      'workbench',
      'preoperative',
      'surgery',
      'pacu',
      'postoperative',
      'quality',
      'reports',
      'config',
      'system',
    ]);
    expect(primaryMenus).toHaveLength(9);
  });

  it('moves intraoperative monitoring and special anesthesia under surgery', () => {
    expect(primaryMenus.map((item) => item.key)).not.toContain('monitor');
    expect(primaryMenus.map((item) => item.key)).not.toContain('special');

    expect(secondaryMenus.surgery.map((item) => item.path)).toEqual(
      expect.arrayContaining(['/monitor/dashboard', '/special/non-or', '/special/obstetric']),
    );
  });

  it('exposes audit logs clearly under system management', () => {
    expect(secondaryMenus.system).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'audit',
          label: '审计日志/操作日志',
          path: '/system/audit',
        }),
      ]),
    );
  });
});
