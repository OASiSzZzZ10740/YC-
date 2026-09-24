import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import { default_reply } from './messages';
import { buildContents, systemInstruction } from './prompt';

export function extractReply(response: GenerateContentResponse): string {
  const candidate = response.candidates?.[0];
  if (response.promptFeedback?.blockReason || candidate?.finishReason !== 'STOP') return default_reply;
  const text = candidate.content?.parts?.filter(p => !p.thought).map(p => p.text ?? '').join('').trim();
  return text && text.length <= 4500 ? text : default_reply;
}

export async function askGemini(faq: string, question: string, deadline: number, eventId: string): Promise<string> {
  let result: GenerateContentResponse | undefined;
  let errorType: string | null = null;
  try {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('deadline');
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('configuration');
    const ai = new GoogleGenAI({ apiKey });
    result = await ai.models.generateContent({
      model: 'gemini-3.5-flash', contents: buildContents(faq, question),
  config: {
  systemInstruction,
  maxOutputTokens: 1024,
},    
    });
    return extractReply(result);
  } catch (error) {
  const details =
    typeof error === 'object' && error !== null
      ? (error as { status?: unknown })
      : undefined;

  const httpStatus =
    typeof details?.status === 'number' ? details.status : null;

  errorType = error instanceof Error ? error.name : 'UnknownError';

  console.error('gemini_request_failed', {
    eventId,
    httpStatus,
    errorType,
  });

  return default_reply;
} finally {
    console.info('gemini_request', { eventId, finishReason: result?.candidates?.[0]?.finishReason ?? null, thoughtsTokenCount: result?.usageMetadata?.thoughtsTokenCount ?? null, candidatesTokenCount: result?.usageMetadata?.candidatesTokenCount ?? null, errorType });
  }
}
