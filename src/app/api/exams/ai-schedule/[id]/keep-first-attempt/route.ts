import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { ExamAttempt } from '@/lib/models/ExamAttempt';

// DELETE — for each student who has multiple attempts on this exam,
// keep only their first (earliest createdAt) and delete the rest.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id: examId } = await params;

    // Fetch all attempts for this exam, sorted oldest first
    const all = await ExamAttempt.find({ examId })
      .sort({ createdAt: 1 })
      .select('_id userId createdAt')
      .lean();

    // Group by userId, collect IDs to delete (everything after the first per student)
    const firstSeen = new Map<string, true>();
    const toDelete: string[] = [];

    for (const attempt of all) {
      const uid = attempt.userId.toString();
      if (firstSeen.has(uid)) {
        toDelete.push((attempt._id as any).toString());
      } else {
        firstSeen.set(uid, true);
      }
    }

    if (toDelete.length === 0) {
      return NextResponse.json({ deleted: 0, message: 'No extra attempts to remove.' });
    }

    const result = await ExamAttempt.deleteMany({ _id: { $in: toDelete } });
    return NextResponse.json({ deleted: result.deletedCount });
  } catch (error: any) {
    console.error('keep-first-attempt error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
