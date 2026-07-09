'use server';

import { ai, withRetry } from '@/ai/genkit';
import { z } from 'genkit';
import type { Language } from '@/lib/coding-constants';

const GenerateCodingProblemInputSchema = z.object({
  topic:      z.string().describe('Programming topic or algorithm name'),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  language:   z.enum(['JavaScript', 'Python', 'Java', 'C++']).default('JavaScript'),
});
export type GenerateCodingProblemInput = z.infer<typeof GenerateCodingProblemInputSchema>;

const ExampleSchema = z.object({
  input:       z.string(),
  output:      z.string(),
  explanation: z.string().optional(),
});

const GenerateCodingProblemOutputSchema = z.object({
  title:           z.string(),
  category:        z.string().describe('e.g. Arrays, Strings, Trees, Dynamic Programming'),
  difficulty:      z.enum(['easy', 'medium', 'hard']),
  description:     z.string().describe('Full problem statement'),
  constraints:     z.array(z.string()).describe('Input constraints like "1 ≤ n ≤ 10^5"'),
  examples:        z.array(ExampleSchema).min(2).max(3),
  template:        z.string().describe('Starter code in the requested language with function signature and comments'),
  hints:           z.array(z.string()).min(2).max(4).describe('Progressive hints, each a bit more revealing than the last'),
  solution:        z.string().describe('A clean, commented reference solution in the requested language'),
  timeComplexity:  z.string().describe('e.g. O(n log n)'),
  spaceComplexity: z.string().describe('e.g. O(n)'),
  testCaseDescription: z.string().describe('Plain-English summary of test cases'),
});
export type GenerateCodingProblemOutput = z.infer<typeof GenerateCodingProblemOutputSchema>;

const prompt = ai.definePrompt({
  name:   'generateCodingProblemV2',
  input:  { schema: GenerateCodingProblemInputSchema },
  output: { schema: GenerateCodingProblemOutputSchema },
  prompt: `You are a senior software engineer creating a coding challenge for a college placement prep platform.

Topic: {{topic}}
Difficulty: {{difficulty}}
Primary Language: {{language}}

Generate a realistic, well-structured coding problem. Follow these rules strictly:

1. Title: concise and descriptive (5–8 words)
2. Category: one of Arrays, Strings, Trees, Graphs, Dynamic Programming, Recursion, Sorting, Hashing, Linked Lists, Math, Bit Manipulation, Two Pointers, Stack/Queue, Greedy, Binary Search
3. Description: clear problem statement with all necessary context. Do NOT include the solution or hints in the description.
4. Constraints: 2–4 constraints on input size/range. Use standard notation (1 ≤ n ≤ 10^5).
5. Examples: 2–3 examples with input, expected output, and a brief explanation. Use realistic values.
6. Template: starter code in {{language}} with the function signature, parameter names, and a helpful comment. No solution logic.
7. Hints: 3–4 progressive hints. Hint 1 = a gentle nudge (data structure to consider). Hint 2 = slightly more specific. Hint 3 = near-explicit approach. Hint 4 (if included) = the key algorithmic insight.
8. Solution: a clean, working, commented solution in {{language}}. Include time/space complexity comments.
9. timeComplexity / spaceComplexity: just the Big-O notation string.
10. testCaseDescription: 1–2 sentences describing what edge cases are tested.

Difficulty guidelines:
- easy: single loop or simple recursion, O(n) or O(n²)
- medium: common interview problem, one non-obvious insight (e.g. two-pointer, sliding window, BFS)
- hard: multi-step, requires combining techniques (e.g. DP + binary search, segment trees)`,
});

export const generateCodingProblemFlow = ai.defineFlow(
  {
    name:         'generateCodingProblemFlow',
    inputSchema:  GenerateCodingProblemInputSchema,
    outputSchema: GenerateCodingProblemOutputSchema,
  },
  async (input) => {
    const { output } = await withRetry(() => prompt(input));
    if (!output) throw new Error('Failed to generate coding problem');
    return output;
  }
);

export async function generateCodingProblem(input: GenerateCodingProblemInput): Promise<GenerateCodingProblemOutput> {
  return generateCodingProblemFlow(input);
}
