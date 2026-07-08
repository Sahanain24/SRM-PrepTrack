import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { User } from '@/lib/models/User';

const STAFF_ROLES = ['teacher', 'hod', 'dean', 'deputy_dean', 'pro_vc', 'admin'];

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    const body = await request.json();

    if (body.action === 'reset-password') {
      const user = await User.findById(params.id);
      if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const defaultPassword = (user.email || '').split('@')[0] || 'changeme';
      await User.findByIdAndUpdate(params.id, { password: defaultPassword });
      return NextResponse.json({ success: true, message: `Password reset to "${defaultPassword}"` });
    }

    if (body.action === 'activate' || body.action === 'deactivate') {
      await User.findByIdAndUpdate(params.id, { isActive: body.action === 'activate' });
      return NextResponse.json({ success: true });
    }

    // General field update — strip protected fields, validate role if present
    const { password, _id, ...updates } = body;
    if (updates.role && !STAFF_ROLES.includes(updates.role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }
    const updated = await User.findByIdAndUpdate(params.id, updates, { new: true }).select('-password');
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    const user = await User.findById(params.id);
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (user.role === 'admin') return NextResponse.json({ error: 'Cannot delete an admin account' }, { status: 403 });
    await User.findByIdAndDelete(params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
