import { NextRequest, NextResponse } from 'next/server';
import { evaluateCodeFlow } from '@/ai/flows/evaluate-code-flow';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await evaluateCodeFlow(body);
    return NextResponse.json(data);
  } catch (err: any) {
    const is429 = err?.message?.includes('429');
    return NextResponse.json(
      { error: is429 ? 'AI rate limit reached. Please wait a minute and try again.' : (err.message || 'Evaluation failed') },
      { status: is429 ? 429 : 500 }
    );
  }
}
