import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Exam } from '@/lib/models/Exam';
import { ExamAttempt } from '@/lib/models/ExamAttempt';

// POST — finds exams whose title matches the given search term (case-insensitive)
// and keeps only each student's first attempt, deleting the rest.
// Body: { titleSearch: string }
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { titleSearch } = await request.json();
    if (!titleSearch?.trim()) {
      return NextResponse.json({ error: 'titleSearch is required' }, { status: 400 });
    }

    // Find matching exams
    const exams = await Exam.find({
      title: { $regex: titleSearch.trim(), $options: 'i' },
    }).select('_id title').lean();

    if (exams.length === 0) {
      return NextResponse.json({ error: `No exams found matching "${titleSearch}"` }, { status: 404 });
    }

    const summary: { examId: string; title: string; deleted: number }[] = [];

    for (const exam of exams) {
      const examId = (exam._id as any).toString();

      // All attempts for this exam, oldest first
      const attempts = await ExamAttempt.find({ examId })
        .sort({ createdAt: 1 })
        .select('_id userId')
        .lean();

      const firstSeen = new Map<string, true>();
      const toDelete: string[] = [];

      for (const a of attempts) {
        const uid = a.userId.toString();
        if (firstSeen.has(uid)) {
          toDelete.push((a._id as any).toString());
        } else {
          firstSeen.set(uid, true);
        }
      }

      let deleted = 0;
      if (toDelete.length > 0) {
        const result = await ExamAttempt.deleteMany({ _id: { $in: toDelete } });
        deleted = result.deletedCount;
      }

      summary.push({ examId, title: exam.title as string, deleted });
    }

    const totalDeleted = summary.reduce((s, r) => s + r.deleted, 0);
    return NextResponse.json({ examsProcessed: exams.length, totalDeleted, summary });
  } catch (error: any) {
    console.error('maintenance/keep-first-attempts error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
