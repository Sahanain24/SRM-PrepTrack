'use server';
/**
 * Aptitude AI flow — two modes:
 *   1. Single topic  : generateAptitudeFlow({ topic, count })
 *   2. Mixed topics  : generateAptitudeFlow({ topic: 'Mixed', topics: [...], count })
 *
 * Inherits gemini-2.5-flash from genkit.ts (same model as quiz and exam flows).
 * Step-by-step solutions included for every question.
 */

import { ai, withRetry } from '@/ai/genkit';
import { z } from 'genkit';

// ── Schema ────────────────────────────────────────────────────────────────────
const AptitudeQuestionSchema = z.object({
  id:           z.number(),
  question:     z.string(),
  options:      z.array(z.string()).length(4),
  correctIndex: z.number().min(0).max(3),
  explanation:  z.string().describe('Concise reason why the correct answer is right'),
  stepByStep:   z.array(z.string()).describe('Numbered solution steps, each a string'),
  topic:        z.string().describe('Exact sub-topic of this question'),
  formula:      z.string().optional().describe('Key formula used, if any'),
});

export type AptitudeQuestion = z.infer<typeof AptitudeQuestionSchema>;

const GenerateAptitudeInputSchema = z.object({
  topic:  z.string().describe('"Mixed" for multi-topic mode, otherwise a single topic name'),
  topics: z.array(z.string()).optional().describe('List of topics when mode is Mixed'),
  count:  z.number().min(5).max(20).default(10),
});

export type GenerateAptitudeInput = z.infer<typeof GenerateAptitudeInputSchema>;

const GenerateAptitudeOutputSchema = z.object({
  title:     z.string(),
  topic:     z.string(),
  questions: z.array(AptitudeQuestionSchema),
});

export type GenerateAptitudeOutput = z.infer<typeof GenerateAptitudeOutputSchema>;

// ── Prompt ────────────────────────────────────────────────────────────────────
// No model override — inherits gemini-2.5-flash from genkit.ts
const aptitudePrompt = ai.definePrompt({
  name:   'generateAptitudePrompt',
  input:  { schema: GenerateAptitudeInputSchema },
  output: { schema: GenerateAptitudeOutputSchema },
  prompt: `You are an expert aptitude trainer for Indian company placements (TCS, Infosys, Wipro, Cognizant, Accenture, Amazon, etc).

{{#if topics}}
Mode: MIXED — generate questions spread across these topics: {{topics}}
Distribute the {{count}} questions evenly across all listed topics.
Title: "Mixed Aptitude Assessment"
{{else}}
Mode: SINGLE TOPIC — generate all {{count}} questions on: {{topic}}
Title: "{{topic}} — Aptitude Assessment"
{{/if}}

Rules:
1. Exactly 4 options per question (A, B, C, D).
2. Questions must match actual company placement paper difficulty.
3. For MIXED mode, ensure every listed topic appears at least once.
4. Each question MUST include:
   - stepByStep: array of strings, each "Step N: ..." explaining the solution
   - explanation: 1-2 sentence summary of the correct answer
   - formula: key formula if the question involves one (optional)
   - topic: the exact sub-topic this question belongs to
5. Vary question styles: word problems, calculations, find-the-missing, comparisons.
6. Every question must require actual reasoning — no trivial questions.

Generate exactly {{count}} questions.`,
});

// ── Flow ──────────────────────────────────────────────────────────────────────
export const generateAptitudeFlow = ai.defineFlow(
  {
    name:         'generateAptitudeFlow',
    inputSchema:  GenerateAptitudeInputSchema,
    outputSchema: GenerateAptitudeOutputSchema,
  },
  async (input) => {
    const MAX_RETRIES = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { output } = await withRetry(() => aptitudePrompt(input));
        if (!output) throw new Error('Empty AI response');
        output.questions = output.questions.map((q, i) => ({ ...q, id: i + 1 }));
        return output;
      } catch (err: any) {
        lastError = err;
        const shouldRetry =
          err?.message?.includes('503') ||
          err?.message?.includes('Service Unavailable') ||
          err?.message?.includes('429') ||
          err?.message?.includes('Too Many Requests');

        if (shouldRetry && attempt < MAX_RETRIES) {
          const waitMs = attempt * 3000;
          console.warn(`Gemini error (attempt ${attempt}/${MAX_RETRIES}), retrying in ${waitMs / 1000}s…`);
          await new Promise(res => setTimeout(res, waitMs));
          continue;
        }
        throw err;
      }
    }
    throw lastError ?? new Error('Failed after retries');
  }
);