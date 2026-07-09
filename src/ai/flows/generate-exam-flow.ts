'use server';
/**
 * Genkit AI flow — generates exam MCQs strictly from a subject's syllabus.
 * The syllabus text is written by the teacher; AI uses it as the sole source.
 */

import { ai, withRetry } from '@/ai/genkit';
import { z } from 'genkit';

const ExamQuestionSchema = z.object({
  id: z.number(),
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctIndex: z.number().min(0).max(3),
  explanation: z.string().describe('Why the correct answer is right + why the others are wrong'),
  topic: z.string().describe('Specific sub-topic from the syllabus'),
});

export type ExamQuestion = z.infer<typeof ExamQuestionSchema>;

const GenerateExamInputSchema = z.object({
  courseName: z.string(),
  subjectName: z.string(),
  syllabus: z.string().describe('Full syllabus text written by the teacher'),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  count: z.number().min(5).max(30).default(10),
});

export type GenerateExamInput = z.infer<typeof GenerateExamInputSchema>;

const GenerateExamOutputSchema = z.object({
  title: z.string(),
  questions: z.array(ExamQuestionSchema),
});

export type GenerateExamOutput = z.infer<typeof GenerateExamOutputSchema>;

const examPrompt = ai.definePrompt({
  name: 'generateExamFromSyllabus',
  input: { schema: GenerateExamInputSchema },
  output: { schema: GenerateExamOutputSchema },
  prompt: `You are a strict exam paper setter for SRM University.

Course: {{courseName}}
Subject: {{subjectName}}
Difficulty: {{difficulty}}
Number of Questions: {{count}}

SYLLABUS (your ONLY source — do NOT go beyond this):
"""
{{{syllabus}}}
"""

Rules:
1. ALL questions must come DIRECTLY from the syllabus above. Do not add outside knowledge.
2. Exactly 4 options per question labeled implicitly as A, B, C, D.
3. Easy = recall/definition. Medium = application/analysis. Hard = edge cases/multi-step.
4. Each question needs a topic tag matching a section in the syllabus.
5. Each question needs a full explanation: why the correct answer is right, and why each wrong option is incorrect.
6. Vary question styles: MCQ definitions, scenario-based, fill-in-concept, "which of the following", find-the-error.
7. Title format: "{{subjectName}} — {{difficulty}} Exam" (e.g. "Data Structures — hard Exam")
8. If a question contains a code snippet, format it for maximum readability:
   - Use actual newline characters (\n) to separate each line — never write code as a single run-on string.
   - Indent with 4 spaces per level (not tabs).
   - Place the code block on its own line(s), clearly separated from the question text.
   - Example format: "What is the output of the following code?\n\ndef foo(x):\n    if x > 0:\n        return x * 2\n    return 0\n\nprint(foo(3))"
   - Keep snippets short (≤15 lines) and focused on exactly one concept being tested.

Generate exactly {{count}} questions.`,
});

export const generateExamFlow = ai.defineFlow(
  {
    name: 'generateExamFlow',
    inputSchema: GenerateExamInputSchema,
    outputSchema: GenerateExamOutputSchema,
  },
  async (input) => {
    const safeInput = {
      ...input,
      syllabus: input.syllabus?.trim() || `General topics in ${input.subjectName}`,
    };
    const { output } = await withRetry(() => examPrompt(safeInput));
    if (!output) throw new Error('AI failed to generate exam questions');
    output.questions = output.questions.map((q, i) => ({ ...q, id: i + 1 }));
    return output;
  }
);