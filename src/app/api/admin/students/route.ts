import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { User } from '@/lib/models/User';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const program    = searchParams.get('program');
    const year       = searchParams.get('year');
    const batch      = searchParams.get('batch');
    const department = searchParams.get('department');

    const query: any = { role: 'student', isActive: true };
    if (program)    query.program    = program;
    if (year)       query.year       = parseInt(year);
    if (batch)      query.batch      = batch;
    if (department) query.department = department;

    const students = await User.find(query)
      .select('-password')
      .sort({ rollNumber: 1 });

    return NextResponse.json(students);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

const ROLL_RE  = /^\d{4}-\d{4}$/;
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@srmist\.edu\.in$/i;

function validateStudent(name: string, roll: string, email: string): string | null {
  if (!name || !roll) return 'Name and roll number are required';
  if (!ROLL_RE.test(roll)) return `Registration number must be in XXXX-XXXX format (e.g. 1234-5678)`;
  if (email && !EMAIL_RE.test(email)) return `Email "${email}" must be a valid @srmist.edu.in address`;
  return null;
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();

    // Bulk import — array of students
    if (Array.isArray(body)) {
      const results = { created: 0, skipped: 0, errors: [] as string[] };

      for (const s of body) {
        const roll  = s.rollNumber?.toString().toUpperCase().trim();
        const email = s.email?.toString().trim().toLowerCase() || '';
        const name  = s.name?.toString().trim()  || '';

        const err = validateStudent(name, roll, email);
        if (err) { results.errors.push(err); continue; }

        try {
          const existing = await User.findOne({ rollNumber: roll });
          if (existing) {
            if (existing.isActive === false) {
              await User.findByIdAndUpdate(existing._id, {
                isActive:   true,
                name:       name                           || existing.name,
                email:      email                          || existing.email,
                program:    s.program?.toString().trim()    || existing.program    || '',
                department: s.department?.toString().trim() || existing.department || '',
                year:       parseInt(s.year)               || existing.year       || 1,
                batch:      s.batch?.toString().trim()      || existing.batch      || '',
                section:    s.section?.toString().trim()    || existing.section    || '',
              });
              results.created++;
            } else {
              results.skipped++;
            }
            continue;
          }

          await User.create({
            name, rollNumber: roll, password: roll, email,
            role:       'student',
            program:    s.program?.toString().trim()    || '',
            department: s.department?.toString().trim() || '',
            year:       parseInt(s.year)               || 1,
            batch:      s.batch?.toString().trim()      || '',
            section:    s.section?.toString().trim()    || '',
            isFirstLogin:            true,
            selfAssessmentCompleted: false,
            isActive:                true,
          });
          results.created++;
        } catch (err: any) {
          results.errors.push(`${roll}: ${err.message}`);
        }
      }
      return NextResponse.json(results, { status: 201 });
    }

    // Single student
    const roll  = body.rollNumber?.toString().toUpperCase().trim();
    const email = body.email?.trim().toLowerCase() || '';
    const name  = body.name?.trim()  || '';

    const validErr = validateStudent(name, roll, email);
    if (validErr) return NextResponse.json({ error: validErr }, { status: 400 });

    const existing = await User.findOne({ rollNumber: roll });
    if (existing) {
      // If the student was previously deactivated, reactivate with all new data
      if (existing.isActive === false) {
        const reactivated = await User.findByIdAndUpdate(
          existing._id,
          {
            isActive:   true,
            name:       name       || existing.name,
            email:      email      || existing.email,
            program:    body.program?.trim()    || existing.program    || '',
            department: body.department?.trim() || existing.department || '',
            year:       parseInt(body.year)     || existing.year       || 1,
            batch:      body.batch?.trim()      || existing.batch      || '',
            section:    body.section?.trim()    || existing.section    || '',
          },
          { new: true }
        ).select('-password');
        return NextResponse.json(reactivated, { status: 200 });
      }
      return NextResponse.json({ error: 'Roll number already exists' }, { status: 409 });
    }

    const student = await User.create({
      name, rollNumber: roll, password: roll, email,
      role:       'student',
      program:    body.program?.trim()    || '',
      department: body.department?.trim() || '',
      year:       parseInt(body.year)     || 1,
      batch:      body.batch?.trim()      || '',
      section:    body.section?.trim()    || '',
      isFirstLogin:            true,
      selfAssessmentCompleted: false,
      isActive:                true,
    });

    const { password: _pw, ...safe } = student.toObject();
    return NextResponse.json(safe, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
