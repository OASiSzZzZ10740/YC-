import { LineBotClient, validateSignature, type webhook } from '@line/bot-sdk';
import { processEvent } from '../../../lib/webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: Request) {
  // Leave room for generated advice, while keeping a bounded LINE reply budget.
  const deadline = Date.now() + 25000;
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return Response.json({ error: 'Server configuration missing' }, { status: 503 });
  const raw = await request.text();
  const signature = request.headers.get('x-line-signature');
  if (!signature || !validateSignature(raw, secret, signature)) return Response.json({ error: 'Invalid signature' }, { status: 401 });
  let body: { events: webhook.Event[] };
  try {
    body = JSON.parse(raw);
    if (!body || !Array.isArray(body.events) || body.events.some(event => !event || typeof event.type !== 'string' || (event.type === 'message' && (!event.message || !event.source)))) throw new Error('invalid_events');
  } catch { return Response.json({ error: 'Invalid payload' }, { status: 400 }); }
  if (!body.events.length) return Response.json({ ok: true });
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return Response.json({ error: 'Server configuration missing' }, { status: 503 });
  const client = LineBotClient.fromChannelAccessToken({ channelAccessToken: token });
  const results = await Promise.allSettled(body.events.map(event => processEvent(event, deadline, (replyToken, text) => client.replyMessage({ replyToken, messages: [{ type: 'text', text }] }))));
  if (results.some(result => result.status === 'rejected')) {
    console.error('webhook_processing_failed');
    return Response.json({ error: 'Processing unavailable' }, { status: 503 });
  }
  return Response.json({ ok: true });
}
