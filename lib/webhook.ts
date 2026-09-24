import type { webhook } from '@line/bot-sdk';
import { claimEvent } from './dedupe';
import { beforeDeadline } from './deadline';
import { askGemini } from './gemini';
import { resolveHandoff } from './handoff';
import { default_reply } from './messages';
import { getFaq } from './sheet';

export const services = { claimEvent, getFaq, askGemini, resolveHandoff };
export async function processEvent(event: webhook.Event, deadline: number, reply: (token: string, text: string) => Promise<unknown>, deps = services) {
  if (event.type !== 'message' || event.message.type !== 'text' || event.mode === 'standby' || !event.replyToken) return;
  const eventId = event.webhookEventId;
  if (!eventId || !deps.claimEvent(eventId)) return;
  const start = Date.now();
  let text = default_reply;
  try {
    const faq = await deps.getFaq(deadline - 2500);
    text = await deps.askGemini(faq, event.message.text, deadline - 2500, eventId);
  } catch (error) {
    const knownReasons = ['invalid_sheet_schema', 'invalid_sheet_row', 'invalid_sheet_response_level', 'empty_sheet_answer', 'empty_sheet', 'missing_sheet_url', 'sheet_timeout', 'sheet_http_error'];
    const reason = error instanceof Error && knownReasons.includes(error.message) ? error.message : 'sheet_fetch_or_parse_error';
    console.warn('faq_or_ai_unavailable', { eventId, reason });
  }
  if (text === default_reply) {
    text = await deps.resolveHandoff({ eventId, userId: event.source?.userId, message: event.message.text, deadline: deadline - 1500 });
  }
  try {
    if (Date.now() >= deadline) throw new Error('deadline_exceeded');
    // The LINE SDK does not expose AbortSignal. Stop waiting at the deadline,
    // but never retry a reply whose delivery outcome may be unknown.
    await beforeDeadline(reply(event.replyToken, text), deadline);
  } catch (error) {
    const status = typeof error === 'object' && error && 'status' in error ? error.status : null;
    console.error('line_reply_failed', { eventId, status, errorType: error instanceof Error ? error.name : 'UnknownError' });
  } finally { console.info('webhook_event', { eventId, durationMs: Date.now() - start }); }
}
