import { NextRequest, NextResponse } from 'next/server';
import { generatePlacementExamFlow } from '@/ai/flows/generate-placement-exam-flow';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subject, difficulty, sections, companyType, syllabus } = body;

    if (!subject) {
      return NextResponse.json({ error: 'subject is required' }, { status: 400 });
    }

    const output = await generatePlacementExamFlow({ subject, difficulty, sections, companyType, syllabus: syllabus || undefined });
    return NextResponse.json(output);
  } catch (e: any) {
    const msg = e?.message || e?.toString() || 'AI generation failed';
    console.error('AI generate-placement-exam error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
