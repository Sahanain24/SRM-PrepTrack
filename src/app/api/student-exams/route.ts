import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Exam } from '@/lib/models/Exam';
import { ExamResult } from '@/lib/models/ExamResult';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const program = searchParams.get('program') || '';
    const year    = parseInt(searchParams.get('year') || '0');
    const batch   = searchParams.get('batch')   || '';
    const section = searchParams.get('section') || '';
    const userId  = searchParams.get('userId')  || '';

    const exams = await Exam.find({ status: 'published' })
      .sort({ examDate: 1, startTime: 1 })
      .lean();

    // Filter by target audience.
    // If teacher left a dimension empty → show to everyone.
    // If student profile doesn't have the field → give benefit of the doubt and show.
    const visible = exams.filter((exam: any) => {
      const progMatch  = !exam.targetPrograms?.length  || !program || exam.targetPrograms.includes(program);
      const yearMatch  = !exam.targetYears?.length     || !year    || exam.targetYears.includes(year);
      // targetBatches may hold section letters (AI schedule) or batch-year strings (QB schedule)
      const batchMatch = !exam.targetBatches?.length   ||
        (!section && !batch) ||
        (section && exam.targetBatches.includes(section)) ||
        (batch   && exam.targetBatches.includes(batch));
      return progMatch && yearMatch && batchMatch;
    });

    // If userId provided, annotate each exam with attempt status + result
    if (userId) {
      const examIds = visible.map((e: any) => e._id.toString());

      const attempted = await ExamResult.find({
        userId,
        courseId: { $in: examIds },
      }).select('courseId score total percentage timeTaken createdAt').lean() as any[];

      // Keep best result per exam (in case of re-attempts)
      const resultMap = new Map<string, { score: number; total: number; percentage: number; timeTaken: number }>();
      for (const r of attempted) {
        const key = r.courseId.toString();
        const existing = resultMap.get(key);
        if (!existing || r.percentage > existing.percentage) {
          resultMap.set(key, { score: r.score, total: r.total, percentage: r.percentage, timeTaken: r.timeTaken });
        }
      }

      const safe = visible.map((exam: any) => {
        const examId = exam._id.toString();
        const alreadyAttempted = resultMap.has(examId);

        return {
          ...exam,
          questions: (exam.questions || []).map((q: any) => ({
            ...q,
            options: (q.options || []).map(({ isCorrect: _omit, ...opt }: any) => opt),
          })),
          alreadyAttempted,
          attemptResult: alreadyAttempted ? resultMap.get(examId) : null,
        };
      });

      return NextResponse.json(safe);
    }

    // No userId — strip answers and return
    const safe = visible.map((exam: any) => ({
      ...exam,
      questions: (exam.questions || []).map((q: any) => ({
        ...q,
        options: (q.options || []).map(({ isCorrect: _omit, ...opt }: any) => opt),
      })),
    }));

    return NextResponse.json(safe);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
