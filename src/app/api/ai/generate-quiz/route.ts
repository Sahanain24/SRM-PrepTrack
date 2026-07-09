import { NextRequest, NextResponse } from 'next/server';
import { generateQuiz } from '@/ai/flows/generate-quiz-flow';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await generateQuiz(body);
    return NextResponse.json(data);
  } catch (err: any) {
    const is429 = err?.message?.includes('429');
    return NextResponse.json(
      { error: is429 ? 'AI rate limit reached. Please wait a minute and try again.' : (err.message || 'Generation failed') },
      { status: is429 ? 429 : 500 }
    );
  }
}
