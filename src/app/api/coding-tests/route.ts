import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { CodingTest } from '@/lib/models/CodingTest';
import { User } from '@/lib/models/User';

// GET /api/coding-tests?teacherId=  OR  ?program=&year=  (for students)
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('teacherId');
    const studentId = searchParams.get('studentId');

    const query: any = { status: 'published' };

    if (teacherId) {
      // Teacher's own tests — show all statuses
      delete query.status;
      query.teacherId = teacherId;
    } else if (studentId) {
      // Student view — look up the student's actual profile from DB for accurate filtering
      let program: string | undefined;
      let year: number | undefined;
      let section: string | undefined;

      try {
        const student = await User.findById(studentId).select('program year section').lean() as any;
        if (student) {
          program = student.program || undefined;
          year    = student.year    || undefined;
          section = student.section || undefined;
        }
      } catch {
        // If lookup fails, fall back to URL params
        program = searchParams.get('program') || undefined;
        year    = Number(searchParams.get('year')) || undefined;
        section = searchParams.get('section') || undefined;
      }

      const and: any[] = [];
      if (program) {
        and.push({ $or: [{ targetPrograms: { $in: [program] } }, { targetPrograms: { $size: 0 } }] });
      } else {
        and.push({ targetPrograms: { $size: 0 } });
      }
      if (year) {
        and.push({ $or: [{ targetYears: { $in: [year] } }, { targetYears: { $size: 0 } }] });
      } else {
        and.push({ targetYears: { $size: 0 } });
      }
      if (section) {
        and.push({ $or: [{ targetSections: { $in: [section] } }, { targetSections: { $size: 0 } }] });
      } else {
        and.push({ targetSections: { $size: 0 } });
      }
      query.$and = and;
    }
    // else: no params → return all published tests (admin / results list view)

    const tests = await CodingTest.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json(tests);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/coding-tests — teacher creates a new coding test
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const {
      teacherId, teacherName, title, description,
      examDate, startTime, deadlineDate, deadlineTime, durationMins,
      targetPrograms, targetYears, targetSections, problems,
    } = body;

    if (!teacherId || !title || !durationMins || !Array.isArray(problems) || problems.length === 0) {
      return NextResponse.json(
        { error: 'teacherId, title, durationMins, and at least one problem are required' },
        { status: 400 }
      );
    }

    const test = await CodingTest.create({
      teacherId, teacherName,
      title, description: description || '',
      examDate:     examDate     || '',
      startTime:    startTime    || '',
      deadlineDate: deadlineDate || '',
      deadlineTime: deadlineTime || '',
      durationMins: Number(durationMins),
      targetPrograms: targetPrograms || [],
      targetYears:    targetYears    || [],
      targetSections: targetSections || [],
      problems,
      status: 'published',
    });

    return NextResponse.json(test, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
