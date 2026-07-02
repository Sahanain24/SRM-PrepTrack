import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import { ExamResult } from '@/lib/models/ExamResult';
import { Exam } from '@/lib/models/Exam';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const userId      = searchParams.get('userId');
    const courseId    = searchParams.get('courseId');
    const leaderboard = searchParams.get('leaderboard');
    const firstOnly   = searchParams.get('firstOnly'); // for teacher first-attempt view

    if (leaderboard) {
      // Best score per user per exam — joined with user profile for roll no / program / year / section
      const results = await ExamResult.aggregate([
        { $sort: { percentage: -1, timeTaken: 1 } },
        {
          $group: {
            _id:        { userId: '$userId', courseId: '$courseId' },
            userId:     { $first: '$userId' },
            userName:   { $first: '$userName' },
            courseId:   { $first: '$courseId' },
            courseName: { $first: '$courseName' },
            bestScore:  { $max: '$percentage' },
            bestRaw:    { $first: { score: '$score', total: '$total' } },
            attempts:   { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'userDoc',
          },
        },
        { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id:        0,
            userId:     1,
            userName:   1,
            courseId:   1,
            courseName: 1,
            bestScore:  1,
            attempts:   1,
            rollNumber: { $ifNull: ['$userDoc.rollNumber', '—'] },
            program:    { $ifNull: ['$userDoc.program',    '—'] },
            year:       { $ifNull: ['$userDoc.year',       '—'] },
            section:    { $ifNull: ['$userDoc.section',    '—'] },
          },
        },
        { $sort: { bestScore: -1 } },
      ]);

      // Attach examDate from the Exam collection
      const examIds   = [...new Set(results.map((r: any) => r.courseId).filter(Boolean))];
      const examDocs  = await Exam.find({ _id: { $in: examIds } }).select('_id examDate').lean() as any[];
      const dateMap   = new Map(examDocs.map(e => [e._id.toString(), e.examDate || '']));
      const withDates = results.map((r: any) => ({ ...r, examDate: dateMap.get(r.courseId) || '' }));

      return NextResponse.json(withDates);
    }

    let query: any = {};
    if (userId)    query.userId  = userId;
    if (courseId)  query.courseId = courseId;
    if (firstOnly === '1') query.isFirstAttempt = true;

    const results = await ExamResult.find(query).sort({ createdAt: -1 });
    return NextResponse.json(results);
  } catch (error) {
    console.error('GET exam-results:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();

    // Check if this is the student's first attempt for this course+subject
    const existing = await ExamResult.findOne({
      userId:      body.userId,
      courseId:    body.courseId,
      subjectName: body.subjectName,
    });
    body.isFirstAttempt = !existing;

    const result = new ExamResult(body);
    await result.save();
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('POST exam-result:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}