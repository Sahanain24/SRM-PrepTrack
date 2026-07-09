import { NextRequest, NextResponse } from 'next/server';
import { generateExamFlow } from '@/ai/flows/generate-exam-flow';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { courseName, subjectName, syllabus, difficulty, count } = body;
    if (!courseName || !subjectName) return NextResponse.json({ error: 'courseName and subjectName are required' }, { status: 400 });
    const data = await generateExamFlow({ courseName, subjectName, syllabus: syllabus || `General topics in ${subjectName}`, difficulty: difficulty || 'medium', count: count || 10 });
    return NextResponse.json(data);
  } catch (err: any) {
    const is429 = err?.message?.includes('429');
    return NextResponse.json(
      { error: is429 ? 'AI rate limit reached. Please wait a minute and try again.' : (err.message || 'Generation failed') },
      { status: is429 ? 429 : 500 }
    );
  }
}
