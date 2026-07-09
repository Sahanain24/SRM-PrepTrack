'use server';
/**
 * Coding Test AI flow — generates LeetCode-style coding problems with
 * examples and stdin/stdout test cases (incl. hidden ones for grading).
 */

import { ai, withRetry } from '@/ai/genkit';
import { z } from 'genkit';

// ── Schemas ───────────────────────────────────────────────────────────────────

const TestCaseSchema = z.object({
  input:          z.string().describe('Exact stdin to feed the program. Empty string if no input.'),
  expectedOutput: z.string().describe('Exact stdout the program must print (trimmed comparison).'),
  hidden:         z.boolean().describe('true for cases used only for grading, not shown to the student'),
});

const ExampleSchema = z.object({
  input:       z.string(),
  output:      z.string(),
  explanation: z.string(),
});

const CodingProblemSchema = z.object({
  title:       z.string(),
  description: z.string().describe('Full problem statement including input/output format and constraints, formatted with newlines'),
  difficulty:  z.enum(['easy', 'medium', 'hard']),
  topic:       z.string().describe('Specific DSA/programming topic, e.g. "Arrays", "Strings", "Recursion"'),
  examples:    z.array(ExampleSchema).min(1).max(2),
  starterCode: z.string().describe('A short starter code SKELETON in the target language: only stdin-reading/input-parsing boilerplate and a placeholder for the solution (e.g. "# TODO: write your solution here" or empty function body). MUST NOT contain any working logic that solves the problem, and MUST NOT print the expected output.'),
  testCases:   z.array(TestCaseSchema).min(3).max(6).describe('At least 2 visible (hidden:false) and at least 1 hidden (hidden:true) test case'),
  marks:       z.number().describe('Marks for this problem, proportional to difficulty (easy=10, medium=15, hard=20)'),
});

export type CodingProblem = z.infer<typeof CodingProblemSchema>;

const GenerateCodingTestInputSchema = z.object({
  topic:       z.string().describe('Overall topic/domain for the coding test, e.g. "Arrays and Strings", "Recursion", "Data Structures"'),
  difficulty:  z.enum(['easy', 'medium', 'hard']).default('medium'),
  language:    z.enum(['javascript', 'python', 'java', 'cpp', 'c']).default('python'),
  numProblems: z.number().min(1).max(10).default(3),
});

export type GenerateCodingTestInput = z.infer<typeof GenerateCodingTestInputSchema>;

const GenerateCodingTestOutputSchema = z.object({
  title:    z.string(),
  problems: z.array(CodingProblemSchema),
});

export type GenerateCodingTestOutput = z.infer<typeof GenerateCodingTestOutputSchema>;

// ── Prompt ────────────────────────────────────────────────────────────────────

const codingTestPrompt = ai.definePrompt({
  name:   'generateCodingTest',
  input:  { schema: GenerateCodingTestInputSchema },
  output: { schema: GenerateCodingTestOutputSchema },
  prompt: `You are an expert coding-interview question setter, similar to LeetCode/HackerRank problem authors.

Generate {{numProblems}} DISTINCT coding problems on the topic: "{{topic}}".
Difficulty: {{difficulty}}
Target programming language: {{language}}

For EACH problem:
1. Give a clear "title" (short, descriptive).
2. Write a complete "description": problem statement, input format, output format, and constraints. Use \\n for line breaks.
3. Provide 1-2 "examples" with input, output, and a brief explanation.
4. Provide "starterCode" in {{language}} — a minimal SKELETON that reads input from stdin (e.g. via input()/Scanner/cin/readline depending on language) and has a clearly marked placeholder (e.g. "# TODO: write your solution here") where the student writes their logic. It should compile/run as-is but must NOT contain the solution, must NOT compute the answer, and must NOT print the expected output — only read input and leave the rest blank/placeholder.
5. Provide 3-6 "testCases" — each with exact "input" (stdin, matching the input format) and exact "expectedOutput" (stdout, the program's printed output for that input). At least 2 must have hidden:false (shown to students as samples) and at least 1 must have hidden:true (used only for grading).
   IMPORTANT: testCase input/output must be plain text values a program reads via stdin and writes via stdout — NOT function call syntax.
6. Set "marks": easy=10, medium=15, hard=20 (adjust per problem if mixed).
7. Set "difficulty" and "topic" (specific sub-topic) per problem.

Set the overall "title" to something like "{{topic}} Coding Test — {{difficulty}}".

RULES:
- All {{numProblems}} problems must be different from each other.
- The "starterCode" must NEVER reveal or compute the solution/answer — it is shown directly to students before they solve the problem.
- Test case outputs must be deterministic and exactly match what correct stdout-based code would print (no trailing extra text).
- Keep problems solvable within a short coding-test timeframe.`,
});

// ── Flow ──────────────────────────────────────────────────────────────────────

export const generateCodingTestFlow = ai.defineFlow(
  {
    name:         'generateCodingTestFlow',
    inputSchema:  GenerateCodingTestInputSchema,
    outputSchema: GenerateCodingTestOutputSchema,
  },
  async (input) => {
    const MAX_RETRIES = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { output } = await withRetry(() => codingTestPrompt(input));
        if (!output) throw new Error('AI returned empty response');
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
