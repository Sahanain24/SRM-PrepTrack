import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import connectDB from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { PasswordReset } from '@/lib/models/PasswordReset';
import { sendPasswordResetEmail } from '@/lib/mailer';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalised = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalised, isActive: true });

    // Always return success to avoid email enumeration
    if (!user) {
      return NextResponse.json({ success: true });
    }

    // Delete any existing tokens for this email
    await PasswordReset.deleteMany({ email: normalised });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await PasswordReset.create({ email: normalised, token, expiresAt });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
    const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;

    await sendPasswordResetEmail(normalised, resetUrl, user.name);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Failed to send reset email' }, { status: 500 });
  }
}
