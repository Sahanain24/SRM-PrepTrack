import { NextRequest, NextResponse } from 'next/server';
import { generateCodingProblem } from '@/ai/flows/generate-coding-problem-flow';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, difficulty, language } = body;
    if (!topic) return NextResponse.json({ error: 'topic is required' }, { status: 400 });
    const data = await generateCodingProblem({ topic, difficulty: difficulty || 'medium', language: language || 'Python' });
    return NextResponse.json(data);
  } catch (err: any) {
    const is429 = err?.message?.includes('429');
    return NextResponse.json(
      { error: is429 ? 'AI rate limit reached. Please wait a minute and try again.' : (err.message || 'Generation failed') },
      { status: is429 ? 429 : 500 }
    );
  }
}
