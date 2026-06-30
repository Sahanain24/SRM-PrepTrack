import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Exam } from '@/lib/models/Exam';
import { ExamResult } from '@/lib/models/ExamResult';
import { User } from '@/lib/models/User';

// GET — returns per-student comparison: first AI test result vs most recent AI test result
// This covers ALL scheduled AI exams regardless of teacher.
export async function GET(_request: NextRequest) {
  try {
    await connectDB();

    // Get all scheduled exam IDs
    const exams = await (Exam as any).find({}).select('_id title subject').lean() as any[];
    const examMap = new Map<string, { title: string; subject: string }>();
    for (const e of exams) {
      examMap.set(e._id.toString(), { title: e.title, subject: e.subject || '' });
    }
    const examIds = Array.from(examMap.keys());

    if (examIds.length === 0) {
      return NextResponse.json([]);
    }

    // Get all ExamResults for these exams
    const results = await (ExamResult as any)
      .find({ courseId: { $in: examIds } })
      .select('userId userName courseId courseName percentage score total timeTaken createdAt date')
      .sort({ createdAt: 1 })
      .lean() as any[];

    // Group by userId
    const byUser = new Map<string, any[]>();
    for (const r of results) {
      const uid = r.userId?.toString() || r.userId;
      if (!byUser.has(uid)) byUser.set(uid, []);
      byUser.get(uid)!.push(r);
    }

    // Fetch roll numbers for all users in one query
    const userIds = Array.from(byUser.keys());
    const users = await User.find({ _id: { $in: userIds } }).select('_id rollNumber').lean() as any[];
    const rollMap = new Map<string, string>();
    for (const u of users) rollMap.set(u._id.toString(), u.rollNumber || '');

    // Build comparison rows
    const rows: any[] = [];
    for (const [userId, userResults] of byUser) {
      if (userResults.length === 0) continue;

      // Already sorted by createdAt asc
      const first  = userResults[0];
      const latest = userResults[userResults.length - 1];
      const isSame = userResults.length === 1;

      const firstExam  = examMap.get(first.courseId?.toString())  || { title: first.courseName  || 'Unknown', subject: '' };
      const latestExam = examMap.get(latest.courseId?.toString()) || { title: latest.courseName || 'Unknown', subject: '' };

      const improvement = isSame ? 0 : Math.round(latest.percentage - first.percentage);

      rows.push({
        userId,
        userName:   first.userName,
        rollNumber: rollMap.get(userId) || '',
        totalAttempts: userResults.length,
        first: {
          examId:     first.courseId,
          examTitle:  firstExam.title,
          subject:    firstExam.subject,
          score:      first.score,
          total:      first.total,
          percentage: Math.round(first.percentage),
          date:       first.date || first.createdAt,
        },
        latest: isSame ? null : {
          examId:     latest.courseId,
          examTitle:  latestExam.title,
          subject:    latestExam.subject,
          score:      latest.score,
          total:      latest.total,
          percentage: Math.round(latest.percentage),
          date:       latest.date || latest.createdAt,
        },
        improvement,
      });
    }

    // Sort: improved most → declined most
    rows.sort((a, b) => b.improvement - a.improvement);

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('[ai-test comparison]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
