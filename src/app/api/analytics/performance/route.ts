import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { AptitudeResult } from '@/lib/models/AptitudeResult';
import { ExamResult } from '@/lib/models/ExamResult';
import { CodingTestSubmission } from '@/lib/models/CodingTestSubmission';
import { User } from '@/lib/models/User';

// Resolves userId (string or ObjectId) → user document
const APT_USER_LOOKUP = [
  { $addFields: { _uid: { $toObjectId: '$userId' } } },
  { $lookup: { from: 'users', localField: '_uid', foreignField: '_id', as: 'user' } },
  { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
];

// ExamResult.userId is already ObjectId
const EXAM_USER_LOOKUP = [
  { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
  { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
];

const CODING_USER_LOOKUP = [
  { $addFields: { _sid: { $toObjectId: '$studentId' } } },
  { $lookup: { from: 'users', localField: '_sid', foreignField: '_id', as: 'user' } },
  { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
];

// Merges two {key → {examAvg, examAttempts, students, codingAvg, codingSubmissions}} maps
function mergePerfMap(
  base: Record<string, any>,
  extra: any[],
  keyField: string,
  type: 'exam' | 'coding',
  makeEntry: (r: any) => any,
) {
  extra.forEach((r: any) => {
    const key = r._id?.[keyField] ?? r._id ?? '—';
    if (!key || key === 'Unknown' || key === '') return;
    if (!base[key]) base[key] = makeEntry(r);
    if (type === 'exam') {
      // weighted average with existing examAvg
      const existAttempts = base[key].examAttempts || 0;
      const newAttempts   = r.attempts || 0;
      const total = existAttempts + newAttempts;
      base[key].examAvg      = total ? Math.round((base[key].examAvg * existAttempts + (r.examAvg || 0) * newAttempts) / total) : 0;
      base[key].examAttempts = total;
      base[key].students     = Math.max(base[key].students, r.students?.length ?? 0);
    } else {
      base[key].codingAvg        = Math.round(r.codingAvg || 0);
      base[key].codingSubmissions = r.submissions || 0;
      base[key].students         = Math.max(base[key].students, r.students?.length ?? 0);
    }
  });
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const teacherId = request.nextUrl.searchParams.get('teacherId');
    let studentIds: any[] | null = null;

    if (teacherId) {
      const teacher = await User.findById(teacherId).lean() as any;
      const programs    = teacher?.assignedPrograms    || [];
      const departments = teacher?.assignedDepartments || [];
      if (programs.length || departments.length) {
        const students = await User.find({
          role: 'student',
          $or: [
            ...(programs.length    ? [{ program: { $in: programs } }]       : []),
            ...(departments.length ? [{ department: { $in: departments } }] : []),
          ],
        }).select('_id').lean();
        if (students.length > 0) studentIds = students.map((s: any) => s._id);
      }
    }

    const aptMatch    = studentIds ? [{ $match: { userId:    { $in: studentIds.map(id => id.toString()) } } }] : [];
    const examMatch   = studentIds ? [{ $match: { userId:    { $in: studentIds } } }] : [];
    const codingMatch = studentIds ? [{ $match: { studentId: { $in: studentIds.map(id => id.toString()) } } }] : [];

    // ── Overview ──────────────────────────────────────────────────────────────
    // Combine AptitudeResult + ExamResult for overview averages
    const [aptAgg, examAgg] = await Promise.all([
      AptitudeResult.aggregate([
        ...aptMatch,
        { $group: { _id: null, avg: { $avg: '$percentage' }, count: { $sum: 1 }, pass: { $sum: { $cond: [{ $gte: ['$percentage', 50] }, 1, 0] } } } },
      ]),
      ExamResult.aggregate([
        ...examMatch,
        { $group: { _id: null, avg: { $avg: '$percentage' }, count: { $sum: 1 }, pass: { $sum: { $cond: [{ $gte: ['$percentage', 50] }, 1, 0] } } } },
      ]),
    ]);

    const a  = aptAgg[0]  || {};
    const ex = examAgg[0] || {};
    const totalAttempts = (a.count || 0) + (ex.count || 0);
    const examAvgAll    = totalAttempts
      ? Math.round(((a.avg || 0) * (a.count || 0) + (ex.avg || 0) * (ex.count || 0)) / totalAttempts)
      : 0;

    const firstAttemptAgg = await ExamResult.aggregate([
      ...examMatch,
      { $sort: { date: 1, createdAt: 1 } },
      { $group: { _id: { userId: '$userId', courseId: '$courseId' }, firstPct: { $first: '$percentage' } } },
      { $group: { _id: null, avgFirstAttempt: { $avg: '$firstPct' } } },
    ]);

    const codingAgg = await CodingTestSubmission.aggregate([
      ...codingMatch,
      { $group: { _id: null, avgPct: { $avg: { $cond: [{ $gt: ['$totalMarks', 0] }, { $multiply: [{ $divide: ['$obtainedMarks', '$totalMarks'] }, 100] }, 0] } }, totalSubmissions: { $sum: 1 } } },
    ]);

    const studentPassAgg = await ExamResult.aggregate([
      ...examMatch,
      { $group: { _id: '$userId', bestPct: { $max: '$percentage' } } },
      { $facet: {
        all:    [{ $count: 'n' }],
        passed: [{ $match: { bestPct: { $gte: 50 } } }, { $count: 'n' }],
      }},
    ]);

    const fe = firstAttemptAgg[0] || {};
    const c  = codingAgg[0]       || {};
    const sp = studentPassAgg[0]  || {};

    const overview = {
      examAvgAll,
      examAvgFirstAttempt:    Math.round(fe.avgFirstAttempt || 0),
      examTotalAttempts:      totalAttempts,
      examPassRate:           totalAttempts ? Math.round(((a.pass || 0) + (ex.pass || 0)) / totalAttempts * 100) : 0,
      studentsAttempted:      sp.all?.[0]?.n    || 0,
      studentsPassed:         sp.passed?.[0]?.n || 0,
      codingAvg:              Math.round(c.avgPct || 0),
      codingTotalSubmissions: c.totalSubmissions || 0,
    };

    // ── Program-wise ──────────────────────────────────────────────────────────
    const [aptByProg, examByProg, codingByProg] = await Promise.all([
      AptitudeResult.aggregate([
        ...APT_USER_LOOKUP,
        { $group: { _id: { $ifNull: ['$user.program', ''] }, examAvg: { $avg: '$percentage' }, attempts: { $sum: 1 }, students: { $addToSet: '$user._id' } } },
      ]),
      ExamResult.aggregate([
        ...EXAM_USER_LOOKUP,
        { $group: { _id: { $ifNull: ['$user.program', ''] }, examAvg: { $avg: '$percentage' }, attempts: { $sum: 1 }, students: { $addToSet: '$user._id' } } },
      ]),
      CodingTestSubmission.aggregate([
        { $match: { totalMarks: { $gt: 0 } } },
        ...CODING_USER_LOOKUP,
        { $group: { _id: { $ifNull: ['$user.program', '$program', ''] }, codingAvg: { $avg: { $multiply: [{ $divide: ['$obtainedMarks', '$totalMarks'] }, 100] } }, submissions: { $sum: 1 }, students: { $addToSet: '$user._id' } } },
      ]),
    ]);

    const programMap: Record<string, any> = {};
    const makeProgEntry = (r: any) => ({ program: r._id, examAvg: 0, examAttempts: 0, students: 0, codingAvg: 0, codingSubmissions: 0 });
    mergePerfMap(programMap, aptByProg,    '_id', 'exam',   makeProgEntry);
    mergePerfMap(programMap, examByProg,   '_id', 'exam',   makeProgEntry);
    mergePerfMap(programMap, codingByProg, '_id', 'coding', makeProgEntry);
    const byProgram = Object.values(programMap).sort((a: any, b: any) => String(a.program).localeCompare(String(b.program)));

    // ── Batch-wise ────────────────────────────────────────────────────────────
    const batchFilter = { 'user.batch': { $exists: true, $ne: '' } };
    const [aptByBatch, examByBatch, codingByBatch] = await Promise.all([
      AptitudeResult.aggregate([
        ...APT_USER_LOOKUP, { $match: batchFilter },
        { $group: { _id: '$user.batch', examAvg: { $avg: '$percentage' }, attempts: { $sum: 1 }, students: { $addToSet: '$user._id' } } },
      ]),
      ExamResult.aggregate([
        ...EXAM_USER_LOOKUP, { $match: batchFilter },
        { $group: { _id: '$user.batch', examAvg: { $avg: '$percentage' }, attempts: { $sum: 1 }, students: { $addToSet: '$user._id' } } },
      ]),
      CodingTestSubmission.aggregate([
        { $match: { totalMarks: { $gt: 0 } } },
        ...CODING_USER_LOOKUP, { $match: batchFilter },
        { $group: { _id: '$user.batch', codingAvg: { $avg: { $multiply: [{ $divide: ['$obtainedMarks', '$totalMarks'] }, 100] } }, submissions: { $sum: 1 }, students: { $addToSet: '$user._id' } } },
      ]),
    ]);

    const batchMap: Record<string, any> = {};
    const makeBatchEntry = (r: any) => ({ batch: r._id, examAvg: 0, examAttempts: 0, students: 0, codingAvg: 0, codingSubmissions: 0 });
    mergePerfMap(batchMap, aptByBatch,    '_id', 'exam',   makeBatchEntry);
    mergePerfMap(batchMap, examByBatch,   '_id', 'exam',   makeBatchEntry);
    mergePerfMap(batchMap, codingByBatch, '_id', 'coding', makeBatchEntry);
    const byBatch = Object.values(batchMap).sort((a: any, b: any) => String(a.batch).localeCompare(String(b.batch)));

    // ── Section-wise ──────────────────────────────────────────────────────────
    const secFilter = { 'user.section': { $exists: true, $ne: '' } };
    const secGroup  = { program: { $ifNull: ['$user.program', '—'] }, year: { $ifNull: ['$user.year', 0] }, section: '$user.section' };
    const [aptBySec, examBySec, codingBySec] = await Promise.all([
      AptitudeResult.aggregate([
        ...APT_USER_LOOKUP, { $match: secFilter },
        { $group: { _id: secGroup, examAvg: { $avg: '$percentage' }, attempts: { $sum: 1 }, students: { $addToSet: '$user._id' } } },
      ]),
      ExamResult.aggregate([
        ...EXAM_USER_LOOKUP, { $match: secFilter },
        { $group: { _id: secGroup, examAvg: { $avg: '$percentage' }, attempts: { $sum: 1 }, students: { $addToSet: '$user._id' } } },
      ]),
      CodingTestSubmission.aggregate([
        { $match: { section: { $exists: true, $ne: '' }, totalMarks: { $gt: 0 } } },
        ...CODING_USER_LOOKUP,
        { $group: { _id: { program: { $ifNull: ['$user.program', '$program', '—'] }, year: { $ifNull: ['$user.year', '$year', 0] }, section: { $ifNull: ['$user.section', '$section', '—'] } }, codingAvg: { $avg: { $multiply: [{ $divide: ['$obtainedMarks', '$totalMarks'] }, 100] } }, submissions: { $sum: 1 }, students: { $addToSet: '$user._id' } } },
      ]),
    ]);

    const secKey = (k: any) => `${k.program}|${k.year}|${k.section}`;
    const sectionMap: Record<string, any> = {};
    const makeSecEntry = (r: any) => ({ program: r._id?.program || '—', year: r._id?.year || '—', section: r._id?.section || '—', examAvg: 0, examAttempts: 0, students: 0, codingAvg: 0, codingSubmissions: 0 });
    [...aptBySec, ...examBySec].forEach((r: any) => {
      const key = secKey(r._id);
      if (!sectionMap[key]) sectionMap[key] = makeSecEntry(r);
      const existAtt = sectionMap[key].examAttempts || 0;
      const newAtt   = r.attempts || 0;
      const total    = existAtt + newAtt;
      sectionMap[key].examAvg      = total ? Math.round((sectionMap[key].examAvg * existAtt + (r.examAvg || 0) * newAtt) / total) : 0;
      sectionMap[key].examAttempts = total;
      sectionMap[key].students     = Math.max(sectionMap[key].students, r.students?.length ?? 0);
    });
    codingBySec.forEach((r: any) => {
      const key = secKey(r._id);
      if (!sectionMap[key]) sectionMap[key] = makeSecEntry(r);
      sectionMap[key].codingAvg        = Math.round(r.codingAvg || 0);
      sectionMap[key].codingSubmissions = r.submissions || 0;
      sectionMap[key].students         = Math.max(sectionMap[key].students, r.students?.length ?? 0);
    });
    const bySection = Object.values(sectionMap).sort((a: any, b: any) =>
      String(a.program).localeCompare(String(b.program)) || (Number(a.year) - Number(b.year)) || String(a.section).localeCompare(String(b.section))
    );

    // ── Attempt-wise (from ExamResult — AI scheduled tests) ──────────────────
    const attemptSeries = await ExamResult.aggregate([
      { $sort: { date: 1, createdAt: 1 } },
      { $group: { _id: { userId: '$userId', courseId: '$courseId' }, percentages: { $push: '$percentage' } } },
      { $unwind: { path: '$percentages', includeArrayIndex: 'attemptIdx' } },
      { $group: { _id: '$attemptIdx', avgPercentage: { $avg: '$percentages' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $limit: 5 },
    ]);
    const attemptComparison = attemptSeries.map((r: any) => ({
      attempt:       Number(r._id) + 1,
      avgPercentage: Math.round(r.avgPercentage || 0),
      count:         r.count,
    }));

    return NextResponse.json({ overview, byProgram, byBatch, bySection, attemptComparison });
  } catch (error) {
    console.error('Analytics performance GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch performance analytics' }, { status: 500 });
  }
}
