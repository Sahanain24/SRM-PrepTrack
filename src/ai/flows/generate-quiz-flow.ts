
'use server';
/**
 * @fileOverview A Genkit flow for generating educational quizzes from topics or study log content.
 */

import { ai, withRetry } from '@/ai/genkit';
import { z } from 'genkit';

const QuizQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctIndex: z.number().min(0).max(3),
});

const GenerateQuizInputSchema = z.object({
  topic: z.string().optional().describe('The subject or topic for the quiz.'),
  content: z.string().optional().describe('The specific study log content to generate questions from.'),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  count: z.number().default(10),
});
export type GenerateQuizInput = z.infer<typeof GenerateQuizInputSchema>;

const GenerateQuizOutputSchema = z.object({
  title: z.string(),
  questions: z.array(QuizQuestionSchema),
});
export type GenerateQuizOutput = z.infer<typeof GenerateQuizOutputSchema>;

const generateQuizPrompt = ai.definePrompt({
  name: 'generateQuizPrompt',
  input: { schema: GenerateQuizInputSchema },
  output: { schema: GenerateQuizOutputSchema },
  prompt: `You are an expert educator at SRM PrepTrack. Generate a quiz with {{count}} multiple-choice questions.
  
  {{#if content}}
  Base the questions strictly on the following study material:
  """
  {{{content}}}
  """
  {{else}}
  Generate questions about the topic: "{{topic}}".
  {{/if}}

  Difficulty level: {{difficulty}}.
  Ensure questions are accurate, challenging, and provide four distinct options.`,
});

export const generateQuizFlow = ai.defineFlow(
  {
    name: 'generateQuizFlow',
    inputSchema: GenerateQuizInputSchema,
    outputSchema: GenerateQuizOutputSchema,
  },
  async (input) => {
    const { output } = await withRetry(() => generateQuizPrompt(input));
    if (!output) throw new Error('Failed to generate quiz');
    return output;
  }
);

export async function generateQuiz(input: GenerateQuizInput): Promise<GenerateQuizOutput> {
  return generateQuizFlow(input);
}
