import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { PasswordReset } from '@/lib/models/PasswordReset';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { token, password } = await request.json();

    if (!token || !password || password.length < 6) {
      return NextResponse.json({ error: 'Token and password (min 6 chars) are required' }, { status: 400 });
    }

    const record = await PasswordReset.findOne({ token });
    if (!record) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
    }
    if (record.expiresAt < new Date()) {
      await PasswordReset.deleteOne({ token });
      return NextResponse.json({ error: 'Reset link has expired. Please request a new one.' }, { status: 400 });
    }

    await User.findOneAndUpdate({ email: record.email }, { password });
    await PasswordReset.deleteOne({ token });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
