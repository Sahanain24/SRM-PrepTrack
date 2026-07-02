import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { SelfAssessment } from '@/lib/models/SelfAssessment';
import { User } from '@/lib/models/User';
import { AuditLog } from '@/lib/models/AuditLog';
import { computeEmployabilityScore, getReadinessLevel } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { userId, ...formData } = body;

    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await User.findById(userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Prevent resubmission
    const existing = await SelfAssessment.findOne({ userId });
    if (existing && !existing.adminResetAllowed) {
      return NextResponse.json(
        { error: 'Assessment already submitted. Contact your administrator to reset.' },
        { status: 409 }
      );
    }

    // Compute employability score
    const employabilityScore = computeEmployabilityScore(formData.sectionB || {});
    const readinessLevel     = getReadinessLevel(employabilityScore);

    // Upsert (handles admin reset case)
    const assessment = await SelfAssessment.findOneAndUpdate(
      { userId },
      {
        userId,
        rollNumber:  user.rollNumber,
        studentName: user.name,
        submittedAt: new Date(),
        adminResetAllowed: false,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        ...formData,
        employabilityScore,
        readinessLevel,
      },
      { upsert: true, new: true }
    );

    // Mark user as completed
    await User.findByIdAndUpdate(userId, {
      isFirstLogin: false,
      selfAssessmentCompleted: true,
      selfAssessmentId: assessment._id,
      // Update program/year from form if student hadn't set it
      program: formData.sectionA?.program || user.program,
      year:    formData.sectionA?.yearOfStudy || user.year,
    });

    await AuditLog.create({
      userId: user._id, userName: user.name, userRole: 'student',
      action: 'SELF_ASSESSMENT_SUBMIT',
      details: { assessmentId: assessment._id, employabilityScore },
      timestamp: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Self-assessment error:', error);
    return NextResponse.json({ error: 'Failed to save assessment' }, { status: 500 });
  }
}

// Dean / analytics dashboard
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    // ── summary ───────────────────────────────────────────────────────────────
    if (type === 'summary') {
      // Get active student IDs, then scope everything to those IDs
      const activeStudents = await User.find({ role: 'student', isActive: true }).select('_id').lean();
      const activeIds      = activeStudents.map((s: any) => s._id);
      const totalStudents  = activeIds.length;

      const [totalAssessed, agg] = await Promise.all([
        SelfAssessment.countDocuments({ userId: { $in: activeIds } }),
        SelfAssessment.aggregate([
          { $match: { userId: { $in: activeIds } } },
          {
            $group: {
              _id: null,
              avgScore:  { $avg: '$employabilityScore' },
              avgCGPA:   { $avg: '$sectionA.cgpa' },
              highCount: { $sum: { $cond: [{ $gte: ['$employabilityScore', 70] }, 1, 0] } },
              lowCount:  { $sum: { $cond: [{ $lt:  ['$employabilityScore', 50] }, 1, 0] } },
            },
          },
        ]),
      ]);

      const s = agg[0] || {};

      return NextResponse.json({
        totalAssessments: totalAssessed,
        totalAssessed,
        totalStudents,
        completionRate:   totalStudents ? Math.round((totalAssessed / totalStudents) * 100) : 0,
        avgScore:         Math.round(s.avgScore || 0),
        avgCGPA:          +(s.avgCGPA  || 0).toFixed(2),
        highReadiness:    s.highCount  || 0,
        lowReadiness:     s.lowCount   || 0,
      });
    }

    // ── program-wise ──────────────────────────────────────────────────────────
    if (type === 'program-wise') {
      const data = await SelfAssessment.aggregate([
        { $match: { 'sectionA.program': { $exists: true, $ne: '' } } },
        {
          $group: {
            _id:      '$sectionA.program',
            avgScore: { $avg: '$employabilityScore' },
            avgCGPA:  { $avg: '$sectionA.cgpa' },
            count:    { $sum: 1 },
            avgComm:  { $avg: '$sectionB.communicationSkills' },
            avgTech:  { $avg: '$sectionB.technicalKnowledge' },
            avgLead:  { $avg: '$sectionB.leadershipSkills' },
          },
        },
        { $sort: { avgScore: -1 } },
      ]);
      return NextResponse.json(data);
    }

    // ── skill-heatmap ─────────────────────────────────────────────────────────
    if (type === 'skill-heatmap') {
      const data = await SelfAssessment.aggregate([
        { $match: { 'sectionA.program': { $exists: true, $ne: '' } } },
        {
          $group: {
            _id:            '$sectionA.program',
            communication:  { $avg: '$sectionB.communicationSkills' },
            problemSolving: { $avg: '$sectionB.problemSolving' },
            technical:      { $avg: '$sectionB.technicalKnowledge' },
            teamwork:       { $avg: '$sectionB.teamworkCollaboration' },
            timeManagement: { $avg: '$sectionB.timeManagement' },
            leadership:     { $avg: '$sectionB.leadershipSkills' },
            criticalThinking:      { $avg: '$sectionB.criticalThinking' },
            emotionalIntelligence: { $avg: '$sectionB.emotionalIntelligence' },
            industryReadiness:     { $avg: '$sectionB.industryReadiness' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);
      return NextResponse.json(data);
    }

    // ── career-aspirations ────────────────────────────────────────────────────
    if (type === 'career-aspirations') {
      const data = await SelfAssessment.aggregate([
        { $match: { 'sectionA.careerAspiration': { $exists: true, $ne: '' } } },
        {
          $group: {
            _id:   '$sectionA.careerAspiration',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]);
      return NextResponse.json(data);
    }

    // ── training-demand ───────────────────────────────────────────────────────
    if (type === 'training-demand') {
      const data = await SelfAssessment.aggregate([
        { $unwind: '$sectionE.trainingNeeds' },
        { $match: { 'sectionE.trainingNeeds': { $ne: '' } } },
        {
          $group: {
            _id:   '$sectionE.trainingNeeds',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]);
      return NextResponse.json(data);
    }

    // ── readiness (legacy / fallback) ─────────────────────────────────────────
    if (type === 'readiness') {
      const data = await SelfAssessment.aggregate([
        {
          $group: {
            _id:   '$readinessLevel',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]);
      return NextResponse.json(data);
    }

    // ── default: return all assessments (for teacher view) ────────────────────
    const assessments = await SelfAssessment.find().sort({ submittedAt: -1 });
    return NextResponse.json(assessments);

  } catch (error) {
    console.error('Analytics GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}