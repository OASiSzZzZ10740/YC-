import { default_reply, handoffSuccess, handoffUnavailable } from './messages';
import { beforeDeadline } from './deadline';
export type HandoffRequest = { eventId: string; userId?: string; message: string; deadline: number };
export type HandoffAdapter = (request: HandoffRequest) => Promise<boolean>;
// Connect an authenticated, durable teacher intake service here. Return true only
// after it acknowledges storage, using eventId as its idempotency key.
export const sendToTeacher: HandoffAdapter = async () => false;
export async function resolveHandoff(request: HandoffRequest, adapter: HandoffAdapter = sendToTeacher): Promise<string> {
  try {
    if (Date.now() < request.deadline && await beforeDeadline(adapter(request), request.deadline)) return handoffSuccess;
  } catch { /* Do not log the student's message or provider response. */ }
  return `${default_reply}\n${handoffUnavailable}`;
}
