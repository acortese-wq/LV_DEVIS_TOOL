// Lädt die vom Skill erzeugten JSON-Dateien ins HTML-Tool und vergleicht die Summen mit der Skill-Ausgabe.
import fs from 'fs'; import path from 'path'; import { execSync } from 'child_process'; import { fileURLToPath } from 'url';
const H = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), dir = process.argv[2];
const { chromium } = await import(execSync('npm root -g').toString().trim() + '/playwright/index.mjs');
const br = await chromium.launch(), pg = await br.newPage(); let bad = 0;
await pg.goto('file://' + path.join(H, 'index.html')); await pg.waitForFunction(() => window.__LVD);
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
  await pg.setInputFiles('#fileIn', path.join(dir, f)); await pg.waitForTimeout(400);
  const html = await pg.evaluate(() => KVE.calc(window.__LVD.S(), LV).sum.netto);
  const md = fs.readdirSync(dir).filter(x => x.endsWith('.md')).map(x => fs.readFileSync(path.join(dir, x), 'utf8')).find(t => t.includes(f));
  const m = md && md.match(/\| \*\*(?:Netto exkl\. MWST|Net hors TVA|Netto IVA escl\.|Net excl\. VAT)\*\* \| \*\*([\d'.]+)/), skill = m ? +m[1].replace(/'/g, '') : NaN;
  const ok = Math.abs(skill - html) < 0.005; if (!ok) bad++;
  console.log((ok ? 'OK  ' : 'FEHLER ') + f + '  Skill ' + skill + '  HTML ' + html);
}
await br.close(); process.exit(bad ? 1 : 0);
