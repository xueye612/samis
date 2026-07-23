import { test } from '@playwright/test';
const mm=(px:number)=>+(px/96*25.4).toFixed(0);
test('measure preview print', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5175/surgery/record/case-or05', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.location.pathname.replace(/\/+$/,'').endsWith('/login') || Boolean(document.querySelector('.anesthesia-record-workstation')), undefined, { timeout: 15000 }).catch(()=>undefined);
  if (page.url().includes('/login')) { await page.getByRole('button', { name: '登录', exact: true }).click(); }
  await page.waitForSelector('.live-record-card', { timeout: 30000 });
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: '打印' }).click();
  await page.waitForSelector('.print-preview-page', { timeout: 20000 });
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(500);
  const m = await page.evaluate(() => {
    const card = document.querySelector('.print-preview-page') as HTMLElement;
    const sec=(s:string)=>{const e=card?.querySelector(s) as HTMLElement;return e?e.offsetHeight:-1;};
    const bands=(Array.from(card?.querySelectorAll('.sheet-band')||[]) as HTMLElement[]).reduce((a,b)=>a+b.offsetHeight,0);
    return { card: card?.offsetHeight||-1, header: sec('.record-header'), ruler: sec('.sheet-ruler'), chart: sec('.vital-chart'), footer: sec('.record-footer'), bands };
  });
  console.log('CARD_MM=', mm(m.card), 'header=', mm(m.header), 'ruler=', mm(m.ruler), 'bands=', mm(m.bands), 'chart=', mm(m.chart), 'footer=', mm(m.footer));
  console.log('NO_CHART_MM=', mm(m.header+m.ruler+m.bands+m.footer), 'CHART_MAX_FOR_282=', 282-mm(m.header+m.ruler+m.bands+m.footer));
});
