import { parse } from 'csv-parse/sync';

const columns = ['id', 'question', 'keywords', 'answer', 'action', 'enabled'];
export type Faq = { id: string; question: string; keywords: string; answer: string; action: 'answer' | 'handoff'; enabled: string };
let cache: { url: string; csv: string; expires: number } | undefined;

export function parseFaq(csv: string): string {
  const rows = parse(csv, { bom: true, skip_empty_lines: true, trim: true }) as string[][];
  const header = rows.shift();
  if (!header || header.length !== columns.length || columns.some(c => !header.includes(c))) throw new Error('invalid_sheet_schema');
  const ids = new Set<string>();
  const enabled: Faq[] = [];
  for (const row of rows) {
    const item = Object.fromEntries(header.map((key, i) => [key, row[i]])) as Faq;
    if (!item.id || ids.has(item.id) || !['TRUE', 'FALSE'].includes(item.enabled) || !['answer', 'handoff'].includes(item.action)) throw new Error('invalid_sheet_row');
    ids.add(item.id);
    if (item.enabled === 'TRUE') {
      if (!item.question || (item.action === 'answer' && !item.answer)) throw new Error('empty_sheet_answer');
      enabled.push(item);
    }
  }
  if (!enabled.length) throw new Error('empty_sheet');
  const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"';
  return [columns.join(','), ...enabled.map(row => columns.map(c => quote(row[c as keyof Faq])).join(','))].join('\n');
}

export async function getFaq(deadline: number): Promise<string> {
  const url = process.env.SHEET_CSV_URL;
  if (!url || new URL(url).protocol !== 'https:') throw new Error('missing_sheet_url');
  if (cache?.url === url && cache.expires > Date.now()) return cache.csv;
  const remaining = Math.min(2000, deadline - Date.now());
  if (remaining <= 0) throw new Error('sheet_timeout');
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(remaining) });
  if (!response.ok) throw new Error('sheet_http_error');
  const csv = parseFaq(await response.text());
  cache = { url, csv, expires: Date.now() + 60_000 };
  return csv;
}
