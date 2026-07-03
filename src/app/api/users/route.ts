import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { User } from '@/lib/models/User';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');

    const query: any = { isActive: true };
    if (role === 'teacher') {
      query.role = 'teacher';
    } else if (role === 'student') {
      query.role = 'student';
    } else if (role) {
      query.role = role;
    }

    const users = await User.find(query)
      .select('_id name email role program year section rollNumber assignedPrograms')
      .lean();
    return NextResponse.json(users);
  } catch (error: any) {
    console.error('GET /api/users error:', error?.message || error);
    return NextResponse.json({ error: 'Failed to fetch users', detail: error?.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const user = new User(body);
    await user.save();
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
