/**
 * Placement Exam AI flow — generates a mixed MCQ paper suitable for campus
 * placement drives targeting BCA, BCA(DS), BCom, MSc(ADS), MCom, MCA, MCA GenAI graduates.
 *
 * Unlike the syllabus-constrained exam flow, this flow draws from industry-
 * standard knowledge for each section type. Syllabus is optional context only.
 *
 * Sections:
 *   - technical    : Subject-specific questions at the appropriate program level
 *   - aptitude     : Quantitative, numerical, data interpretation
 *   - reasoning    : Logical, verbal reasoning, series, puzzles
 *   - verbal       : Reading comprehension, grammar, synonyms/antonyms, sentence correction
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// ── Schemas ───────────────────────────────────────────────────────────────────

const PlacementQuestionSchema = z.object({
  id:           z.number(),
  question:     z.string(),
  options:      z.array(z.string()).length(4),
  correctIndex: z.number().min(0).max(3),
  explanation:  z.string().describe('Why the correct answer is right and why each wrong option is incorrect'),
  section:      z.enum(['technical', 'aptitude', 'reasoning', 'verbal']),
  topic:        z.string().describe('Specific sub-topic (e.g. "Binary Trees", "Time & Work", "Blood Relations")'),
});

export type PlacementQuestion = z.infer<typeof PlacementQuestionSchema>;

const SectionCountsSchema = z.object({
  technical: z.number().min(0).default(0),
  aptitude:  z.number().min(0).default(0),
  reasoning: z.number().min(0).default(0),
  verbal:    z.number().min(0).default(0),
});

export type SectionCounts = z.infer<typeof SectionCountsSchema>;

const GeneratePlacementExamInputSchema = z.object({
  subject:      z.string().describe('Primary technical subject (e.g. "Data Structures", "Java", "DBMS")'),
  difficulty:   z.enum(['easy', 'medium', 'hard']).default('medium'),
  sections:     SectionCountsSchema,
  companyType:  z.enum(['service', 'product', 'core', 'any']).default('any'),
  syllabus:     z.string().optional().describe('Optional supplementary syllabus context — not the sole source'),
});

export type GeneratePlacementExamInput = z.infer<typeof GeneratePlacementExamInputSchema>;

const GeneratePlacementExamOutputSchema = z.object({
  title:     z.string(),
  questions: z.array(PlacementQuestionSchema),
});

export type GeneratePlacementExamOutput = z.infer<typeof GeneratePlacementExamOutputSchema>;

// ── Prompt ────────────────────────────────────────────────────────────────────

const placementPrompt = ai.definePrompt({
  name:   'generatePlacementExam',
  input:  { schema: GeneratePlacementExamInputSchema },
  output: { schema: GeneratePlacementExamOutputSchema },
  prompt: `You are an expert placement exam paper setter for a science and humanities college.
Students are from programs like BCA, BCA(DS), BCom, MSc(ADS), MCom, MCA, and MCA GenAI.
Your goal is to create a realistic campus placement mock test that mirrors actual company hiring papers for these graduates.

Subject / Prompt from Teacher: {{subject}}
Difficulty Level: {{difficulty}}
Target Company Type: {{companyType}}

{{#if syllabus}}
Supplementary Context (teacher-provided syllabus — use as additional reference, NOT the only source):
"""
{{{syllabus}}}
"""
{{/if}}

SECTION BREAKDOWN — Generate EXACTLY this many questions per section:
- Technical ({{sections.technical}} questions): Questions based on the teacher's subject/prompt above — appropriate for BCA/MCA/MSc/BCom/MCom level
- Aptitude  ({{sections.aptitude}} questions): Quantitative aptitude, numerical reasoning, data interpretation, percentage, profit & loss, time & work
- Reasoning ({{sections.reasoning}} questions): Logical reasoning, blood relations, series, puzzles, seating arrangement, coding-decoding
- Verbal    ({{sections.verbal}} questions): Grammar, synonyms/antonyms, sentence correction, reading comprehension, fill in the blanks

COMPANY TYPE GUIDELINES (companies that typically hire BCA/MCA/BCom/MSc graduates):
- service  (TCS, Infosys, Wipro, Cognizant, Accenture, Capgemini): Aptitude-heavy, reasoning, basic IT concepts, fundamentals of programming
- product  (Amazon, Zoho, Freshworks, Flipkart, Paytm): DSA basics, problem solving, web/software development concepts, analytical thinking
- core     (banks, insurance, fintech, e-commerce, data firms): Domain-specific — accounting principles, data analysis, commerce, business analytics
- any      : Balanced mix suitable for any company recruiting from this college

TECHNICAL SECTION EXAMPLES by program:
- BCA / MCA: Programming (C, Java, Python), DBMS, OS, Networking, Web Technologies, DSA
- BCA(DS) / MCA GenAI: Python, ML basics, Data Analysis, AI concepts, Statistics
- BCom / MCom: Accounting, Financial Management, Taxation, Business Law, Economics
- MSc(ADS): Statistics, Data Science, R/Python, Machine Learning, Analytics

DIFFICULTY GUIDELINES:
- easy   : Direct recall, standard formula application, common patterns
- medium : Multi-step problems, application of concepts — matches actual company paper difficulty for these programs
- hard   : Tricky edge cases, complex multi-step reasoning, competitive-level difficulty

RULES:
1. Every question must have exactly 4 options.
2. The "section" field must be one of: technical, aptitude, reasoning, verbal.
3. The "topic" field must be a specific sub-topic (NOT just "technical" or "aptitude").
4. For aptitude: include actual numbers, calculations, word problems.
5. For reasoning: include pattern-based, logical deduction, or puzzle questions.
6. For verbal: use standard placement exam English questions.
7. For technical: draw from the knowledge domain described in the teacher's subject/prompt — appropriate for the program level.
8. Each explanation must say why the correct answer is right AND why each wrong option is wrong.
9. Title: generate a short, professional exam title (max 60 characters) that captures the subject and purpose — do NOT copy the teacher's prompt verbatim.
10. No trivial questions. Every question must require genuine thought.
11. CRITICAL — correctIndex: This is the 0-based index of the correct answer in the "options" array.
    - correctIndex 0 → first option (A) is correct
    - correctIndex 1 → second option (B) is correct
    - correctIndex 2 → third option (C) is correct
    - correctIndex 3 → fourth option (D) is correct
    You MUST verify this matches the option you intend to be correct. Vary correctIndex across questions — do NOT always use 0.
12. Double-check every question: the explanation's stated correct answer must match the option at correctIndex in the options array.

Generate the total number of questions as specified in each section ({{sections.technical}} + {{sections.aptitude}} + {{sections.reasoning}} + {{sections.verbal}} questions in total).`,
});

// ── Flow ──────────────────────────────────────────────────────────────────────

export const generatePlacementExamFlow = ai.defineFlow(
  {
    name:         'generatePlacementExamFlow',
    inputSchema:  GeneratePlacementExamInputSchema,
    outputSchema: GeneratePlacementExamOutputSchema,
  },
  async (input) => {
    const MAX_RETRIES = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { output } = await placementPrompt(input);
        if (!output) throw new Error('AI returned empty response');
        output.questions = output.questions.map((q, i) => ({
          ...q,
          id: i + 1,
          // clamp correctIndex to valid range in case AI goes out of bounds
          correctIndex: Math.max(0, Math.min(3, q.correctIndex ?? 0)),
        }));
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
