import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { User } from '@/lib/models/User';

const STAFF_ROLES    = ['teacher', 'hod', 'dean', 'deputy_dean', 'pro_vc', 'admin'];
const FSH_ROLES      = ['hod', 'dean', 'deputy_dean', 'pro_vc', 'admin'];
const EMAIL_RE       = /^[a-zA-Z0-9._%+-]+@srmist\.edu\.in$/i;

function withFSH(name: string) {
  const trimmed = name.trim();
  return /\bFSH\b/i.test(trimmed) ? trimmed : `${trimmed} FSH`;
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');

    const query: any = { role: { $in: STAFF_ROLES } };
    if (role && STAFF_ROLES.includes(role)) query.role = role;

    const staff = await User.find(query).select('-password').sort({ role: 1, name: 1 });
    return NextResponse.json(staff);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();

    if (!body.name?.trim() || !body.email?.trim() || !body.role) {
      return NextResponse.json({ error: 'Name, email and role are required' }, { status: 400 });
    }
    if (!STAFF_ROLES.includes(body.role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Email must be a valid @srmist.edu.in address' }, { status: 400 });
    }

    const name = FSH_ROLES.includes(body.role) ? withFSH(body.name) : body.name.trim();

    const existing = await User.findOne({ email });
    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
    }

    const defaultPassword = email.split('@')[0];
    const staff = await User.create({
      name,
      email,
      password:   defaultPassword,
      role:       body.role,
      department: body.department?.trim() || '',
      assignedPrograms:    Array.isArray(body.assignedPrograms)    ? body.assignedPrograms    : [],
      assignedDepartments: Array.isArray(body.assignedDepartments) ? body.assignedDepartments : [],
      isFirstLogin: true,
      isActive:     true,
    });

    const { password: _pw, ...safe } = staff.toObject();
    return NextResponse.json(safe, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
