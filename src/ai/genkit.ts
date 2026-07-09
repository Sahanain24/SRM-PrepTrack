import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-flash',
});

// Retry helper — retries up to 3 times on 429 rate limit errors with exponential backoff
export async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 10000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      const is429 = err?.message?.includes('429') || err?.status === 429 || err?.code === 429;
      if (is429 && i < retries - 1) {
        await new Promise(r => setTimeout(r, delayMs * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}
