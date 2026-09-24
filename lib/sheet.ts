import { parse } from 'csv-parse/sync';

const columns = ['id', 'question', 'keywords', 'answer', 'action', 'enabled'];
const thaiColumns = ['รหัส', 'หมวดหมู่', 'ช่วงชั้น', 'คำถามตัวอย่าง', 'คำตอบสำหรับนักเรียน', 'การตอบสนองเริ่มต้น', 'เงื่อนไขและการส่งต่อ (ผู้ดูแล)'];
const extraColumns = ['category', 'grade', 'response_level', 'handoff_conditions'];
export type Faq = { id: string; question: string; keywords: string; answer: string; action: 'answer' | 'handoff'; enabled: string };
let cache: { url: string; csv: string; expires: number } | undefined;

export function parseFaq(csv: string): string {
  const rows = parse(csv, { bom: true, skip_empty_lines: true, trim: true }) as string[][];
  const header = rows.shift();
  if (!header) throw new Error('invalid_sheet_schema');
  const isThai = header.length === thaiColumns.length && thaiColumns.every(c => header.includes(c));
  if (!isThai && (header.length !== columns.length || columns.some(c => !header.includes(c)))) throw new Error('invalid_sheet_schema');
  const ids = new Set<string>();
  const enabled: (Faq & Record<string, string>)[] = [];
  for (const row of rows) {
    const raw = Object.fromEntries(header.map((key, i) => [key, row[i]]));
    let item = raw as Faq & Record<string, string>;
    if (isThai) {
      const level = raw['การตอบสนองเริ่มต้น'];
      if (!['ทั่วไป', 'ส่งต่อ', 'เร่งด่วน', 'ฉุกเฉิน'].includes(level)) throw new Error('invalid_sheet_response_level');
      item = {
        id: raw['รหัส'], question: raw['คำถามตัวอย่าง'], keywords: raw['หมวดหมู่'],
        answer: raw['คำตอบสำหรับนักเรียน'], action: level === 'ทั่วไป' ? 'answer' : 'handoff', enabled: 'TRUE',
        category: raw['หมวดหมู่'], grade: raw['ช่วงชั้น'], response_level: level,
        handoff_conditions: raw['เงื่อนไขและการส่งต่อ (ผู้ดูแล)'],
      };
    }
    if (!item.id || ids.has(item.id) || !['TRUE', 'FALSE'].includes(item.enabled) || !['answer', 'handoff'].includes(item.action)) throw new Error('invalid_sheet_row');
    ids.add(item.id);
    if (item.enabled === 'TRUE') {
      if (!item.question || (item.action === 'answer' && !item.answer)) throw new Error('empty_sheet_answer');
      enabled.push(item);
    }
  }
  if (!enabled.length) throw new Error('empty_sheet');
  const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"';
  const outputColumns = isThai ? [...columns, ...extraColumns] : columns;
  return [outputColumns.join(','), ...enabled.map(row => outputColumns.map(c => quote(row[c])).join(','))].join('\n');
}

export async function getFaq(deadline: number): Promise<string> {
  const url = process.env.SHEET_CSV_URL;
  if (!url || new URL(url).protocol !== 'https:') throw new Error('missing_sheet_url');
  if (cache?.url === url && cache.expires > Date.now()) return cache.csv;
  const remaining = Math.min(2000, deadline - Date.now());
  if (remaining <= 0) throw new Error('sheet_timeout');
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(remaining) });
  if (!response.ok) {
  console.error('sheet_fetch_failed', {
    status: response.status,
    statusText: response.statusText,
    hostname: new URL(url).hostname,
  });

  throw new Error('sheet_http_error');
}
  const csv = parseFaq(await response.text());
  cache = { url, csv, expires: Date.now() + 60_000 };
  return csv;
}
