'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { GraduationCap, Loader2, Eye, EyeOff, KeyRound, Users, UserCog, CheckCircle2 } from 'lucide-react';
import { setCurrentUser, UserRole } from '@/lib/mock-db';

// Demo users for offline/fallback mode
const DEMO_USERS: Record<string, any> = {
  // Students: roll number as both key and password
  'DEMO001': { _id: 'demo-student-1', id: 'demo-student-1', name: 'Demo Student', role: 'student', rollNumber: 'DEMO001', program: 'BCA', year: 2, batch: '2023-2026', section: 'A', selfAssessmentCompleted: true },
  'RA2211003010001': { _id: 'demo-s2', id: 'demo-s2', name: 'Alex Student', role: 'student', rollNumber: 'RA2211003010001', program: 'BCA', year: 1, batch: '2022-2025', section: 'B', selfAssessmentCompleted: true },
  // Staff: email as key, email as password
  'admin@srmist.edu.in': { _id: 'demo-admin', id: 'demo-admin', name: 'Admin User', role: 'admin', email: 'admin@srmist.edu.in' },
  'teacher@srmist.edu.in': { _id: 'demo-teacher', id: 'demo-teacher', name: 'Dr. Demo Teacher', role: 'teacher', email: 'teacher@srmist.edu.in', assignedPrograms: ['BCA'] },
  'smith@srmist.edu.in': { _id: 'demo-smith', id: 'demo-smith', name: 'Dr. Smith', role: 'teacher', email: 'smith@srmist.edu.in', assignedPrograms: ['BCA'] },
  'dean@srmist.edu.in': { _id: 'demo-dean', id: 'demo-dean', name: 'Demo Dean', role: 'dean', email: 'dean@srmist.edu.in' },
};

const PROGRAMS = ['BCA', 'BCA(DS)', 'BCom', 'MSc(ADS)', 'MCom', 'MCA', 'MCA GenAI'];
const SECTIONS = ['A','B','C','D','E','F','G','H','I','J'];

// ── Password strength helper ───────────────────────────────────────────────────
function getStrength(pw: string) {
  if (!pw) return null;
  if (pw.length < 6)  return { label: 'Too short', color: 'bg-red-400',    textColor: 'text-red-600',    width: 'w-1/4' };
  if (pw.length < 8)  return { label: 'Weak',      color: 'bg-orange-400', textColor: 'text-orange-600', width: 'w-2/4' };
  if (pw.length < 12) return { label: 'Good',      color: 'bg-yellow-400', textColor: 'text-yellow-600', width: 'w-3/4' };
  return               { label: 'Strong',    color: 'bg-green-500',  textColor: 'text-green-600',  width: 'w-full' };
}

export default function AuthPage() {
  const router = useRouter();

  // ── Portal selector: 'student' | 'staff' ──────────────────────────────────
  const [portal, setPortal] = useState<'student' | 'staff'>('student');

  // ── Student tab (login / register) ───────────────────────────────────────
  const [studentTab, setStudentTab] = useState('login');

  // ── Student register state ────────────────────────────────────────────────
  const [studentReg, setStudentReg] = useState({
    name: '', rollNumber: '', program: '', email: '',
    department: 'Science & Humanities', year: '', batch: '', section: '',
  });
  const [studentRegError, setStudentRegError]     = useState('');
  const [studentRegSuccess, setStudentRegSuccess] = useState(false);

  // ── Loading + errors ──────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // ── Staff tab (login / register) ──────────────────────────────────────────
  const [staffTab, setStaffTab] = useState('login');

  // ── Student login state ───────────────────────────────────────────────────
  const [rollNumber, setRollNumber]   = useState('');
  const [studentPw, setStudentPw]     = useState('');
  const [showStudentPw, setShowStudentPw] = useState(false);

  // ── Staff login state ─────────────────────────────────────────────────────
  const [staffEmail, setStaffEmail]   = useState('');
  const [staffPw, setStaffPw]         = useState('');
  const [showStaffPw, setShowStaffPw] = useState(false);

  // ── Staff register state ──────────────────────────────────────────────────
  const [regData, setRegData] = useState({
    name: '', email: '', password: '', confirmPassword: '', role: 'teacher' as UserRole,
  });
  const [showRegPw, setShowRegPw]         = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwError, setPwError]             = useState('');

  // ── Forgot password dialog ────────────────────────────────────────────────
  const [forgotOpen, setForgotOpen] = useState(false);

  const strength = getStrength(regData.password);

  // ── Logout confirmation (reuse from sidebar — not needed here) ────────────

  // ─────────────────────────────────────────────────────────────────────────
  // STUDENT LOGIN — roll number + password (default = roll number)
  // ─────────────────────────────────────────────────────────────────────────
  const handleStudentLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);
  setLoginError('');
  try {
    const roll = rollNumber.trim().toUpperCase();

    // 1. Try new bcrypt-based student login API
    const res = await fetch('/api/auth/student-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rollNumber: roll, password: studentPw }),
    });

    if (res.ok) {
      const data = await res.json();
      setCurrentUser(data.user);
      router.push(data.redirect || '/dashboard');
      return;
    }

    // 2. Fallback — try legacy login using roll number as email
    const { db } = await import('@/lib/mock-db');
    const userByRoll = await db.loginUser(roll);
    if (userByRoll) {
      setCurrentUser(userByRoll);
      const u = userByRoll as any;
      router.push(u.selfAssessmentCompleted === false ? '/onboarding' : '/dashboard');
      return;
    }

    // 3. Fallback — try roll number as lowercase email
    const userByEmail = await db.loginUser(roll.toLowerCase());
    if (userByEmail) {
      setCurrentUser(userByEmail);
      const u = userByEmail as any;
      router.push(u.selfAssessmentCompleted === false ? '/onboarding' : '/dashboard');
      return;
    }

    // 4. Fallback — try password as email (for accounts registered with email = roll number)
    const userByPw = await db.loginUser(studentPw.trim());
    if (userByPw) {
      setCurrentUser(userByPw);
      const u = userByPw as any;
      router.push(u.selfAssessmentCompleted === false ? '/onboarding' : '/dashboard');
      return;
    }

    // 5. Demo fallback — works without database
    const demoUser = DEMO_USERS[roll];
    if (demoUser && demoUser.role === 'student' && (studentPw.trim().toUpperCase() === roll || studentPw.trim() === roll)) {
      setCurrentUser(demoUser);
      router.push(demoUser.selfAssessmentCompleted ? '/dashboard' : '/onboarding');
      return;
    }

    setLoginError('Invalid roll number or password. If you registered with an email, use the Staff portal instead.');
  } catch (err: any) {
    // Final fallback — demo mode when server is unreachable
    const roll = rollNumber.trim().toUpperCase();
    const demoUser = DEMO_USERS[roll];
    if (demoUser && demoUser.role === 'student' && (studentPw.trim().toUpperCase() === roll || studentPw.trim() === roll)) {
      setCurrentUser(demoUser);
      router.push(demoUser.selfAssessmentCompleted ? '/dashboard' : '/onboarding');
      setIsLoading(false);
      return;
    }
    setLoginError('Login failed. Please check your connection and try again.');
    console.error(err);
  } finally {
    setIsLoading(false);
  }
};

  // ─────────────────────────────────────────────────────────────────────────
  // STUDENT REGISTRATION — self sign-up, then redirect to login
  // ─────────────────────────────────────────────────────────────────────────
  const handleStudentRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentRegError('');
    if (!/^[A-Z0-9]{15}$/.test(studentReg.rollNumber)) {
      setStudentRegError('Roll number must be exactly 15 alphanumeric characters (e.g. RA2531212010001).');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:       studentReg.name,
          rollNumber: studentReg.rollNumber,
          program:    studentReg.program,
          email:      studentReg.email,
          department: studentReg.department,
          year:       studentReg.year,
          batch:      studentReg.batch,
          section:    studentReg.section,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStudentRegError(data.error || 'Registration failed. Please try again.');
        return;
      }
      setStudentRegSuccess(true);
      setStudentReg({ name: '', rollNumber: '', program: '', email: '', department: 'Science & Humanities', year: '', batch: '', section: '' });
      setTimeout(() => {
        setStudentRegSuccess(false);
        setStudentTab('login');
      }, 2000);
    } catch {
      setStudentRegError('Registration failed. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STAFF LOGIN — email + password
  // ─────────────────────────────────────────────────────────────────────────
  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/auth/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: staffEmail.trim(), password: staffPw }),
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        router.push(data.redirect || '/dashboard');
        return;
      }

      // Demo fallback
      const demoUser = DEMO_USERS[staffEmail.trim().toLowerCase()];
      if (demoUser && demoUser.role !== 'student' && staffPw === demoUser.email) {
        setCurrentUser(demoUser);
        const role = demoUser.role;
        router.push(['dean','deputy_dean','pro_vc','hod'].includes(role) ? '/dashboard/dean' : '/dashboard');
        return;
      }
      const err = await res.json().catch(() => ({}));
      setLoginError(err.error || 'Invalid email or password. Please check your credentials.');
    } catch {
      // Demo fallback when server unreachable
      const demoUser = DEMO_USERS[staffEmail.trim().toLowerCase()];
      if (demoUser && demoUser.role !== 'student' && staffPw === demoUser.email) {
        setCurrentUser(demoUser);
        const role = demoUser.role;
        router.push(['dean','deputy_dean','pro_vc','hod'].includes(role) ? '/dashboard/dean' : '/dashboard');
        setIsLoading(false);
        return;
      }
      setLoginError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STAFF REGISTER (teacher self-registration)
  // ─────────────────────────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (regData.password !== regData.confirmPassword) { setPwError('Passwords do not match.'); return; }
    if (regData.password.length < 6) { setPwError('Password must be at least 6 characters.'); return; }
    setIsLoading(true);
    try {
      const { db } = await import('@/lib/mock-db');
      const newUser = await db.createUser({ name: regData.name, email: regData.email, role: regData.role });
      setCurrentUser(newUser);
      router.push('/dashboard');
    } catch {
      setPwError('Registration failed. Email may already be in use.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-md space-y-6">

        {/* Logo */}
        <div className="flex flex-col items-center">
          <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white mb-4 shadow-lg">
            <GraduationCap className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-headline font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            SRM PrepTrack
          </h1>
          <p className="text-sm text-slate-500 mt-1">Academic Excellence Platform</p>
        </div>

        {/* Portal selector */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => { setPortal('student'); setLoginError(''); }}
            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all font-medium text-sm
              ${portal === 'student'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-800 shadow-md'
                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'}`}>
            <Users className="h-6 w-6" />
            Student Login
            <span className="text-[10px] font-normal text-slate-400">Use your Roll Number</span>
          </button>
          <button
            onClick={() => { setPortal('staff'); setLoginError(''); }}
            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all font-medium text-sm
              ${portal === 'staff'
                ? 'border-violet-500 bg-violet-50 text-violet-800 shadow-md'
                : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'}`}>
            <UserCog className="h-6 w-6" />
            Staff / Management
            <span className="text-[10px] font-normal text-slate-400">Teacher · Dean · Admin</span>
          </button>
        </div>

        {/* ── STUDENT PORTAL ── */}
        {portal === 'student' && (
          <Tabs value={studentTab} onValueChange={setStudentTab}>
            <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-xl mb-4">
              <TabsTrigger value="login"    className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Login</TabsTrigger>
              <TabsTrigger value="register" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
          <Card className="border-none shadow-2xl bg-white/90 backdrop-blur-sm">
            <CardHeader className="space-y-1">
              <CardTitle className="font-headline text-2xl text-slate-900">Student Login</CardTitle>
              <CardDescription>
                Enter your Roll Number. Your default password is your Roll Number.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleStudentLogin}>
              <CardContent className="space-y-4">
                {/* Roll Number */}
                <div className="space-y-2">
                  <Label htmlFor="rollNumber">Roll Number</Label>
                  <Input
                    id="rollNumber"
                    placeholder="e.g. RA2531212010001"
                    required
                    maxLength={15}
                    value={rollNumber}
                    onChange={e => setRollNumber(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15).toUpperCase())}
                    className="uppercase font-mono"
                  />
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="studentPw">Password</Label>
                  <div className="relative">
                    <Input
                      id="studentPw"
                      type={showStudentPw ? 'text' : 'password'}
                      required
                      placeholder="Default: your Roll Number"
                      className="pr-10"
                      value={studentPw}
                      onChange={e => setStudentPw(e.target.value)}
                    />
                    <button type="button" tabIndex={-1}
                      onClick={() => setShowStudentPw(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showStudentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Forgot password */}
                <div className="flex justify-end">
                  <button type="button"
                    onClick={() => setForgotOpen(true)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline">
                    Forgot password?
                  </button>
                </div>

                {/* Error */}
                {loginError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    {loginError}
                  </p>
                )}

                {/* Info note */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs text-blue-700">
                  💡 First-time login? Your default password is your Roll Number. You will be asked to complete a self-assessment before accessing the dashboard.
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isLoading}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg text-white rounded-xl">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {isLoading ? 'Signing in…' : 'Sign In as Student'}
                </Button>
              </CardFooter>
            </form>
          </Card>
            </TabsContent>

            {/* Student Register */}
            <TabsContent value="register">
              <Card className="border-none shadow-2xl bg-white/90 backdrop-blur-sm">
                <CardHeader className="space-y-1">
                  <CardTitle className="font-headline text-2xl text-slate-900">Student Registration</CardTitle>
                  <CardDescription>
                    Create your account. Your default password will be your Roll Number.
                  </CardDescription>
                </CardHeader>
                {studentRegSuccess ? (
                  <CardContent className="py-8 text-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="h-8 w-8 text-green-600" />
                    </div>
                    <p className="text-sm text-slate-700 font-medium">Registration successful!</p>
                    <p className="text-xs text-slate-500">Redirecting you to the login page…</p>
                  </CardContent>
                ) : (
                <form onSubmit={handleStudentRegister}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="sregName">Full Name</Label>
                      <Input id="sregName" placeholder="John Doe" required
                        value={studentReg.name} onChange={e => setStudentReg(p => ({ ...p, name: e.target.value }))} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sregRoll">Roll Number</Label>
                      <Input id="sregRoll" placeholder="e.g. RA2531212010001" required maxLength={15}
                        value={studentReg.rollNumber}
                        className="uppercase font-mono"
                        onChange={e => {
                          const v = e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15).toUpperCase();
                          setStudentReg(p => ({ ...p, rollNumber: v }));
                        }} />
                      <p className="text-xs text-slate-400">Alphanumeric, exactly 15 characters (e.g. RA2531212010001){studentReg.rollNumber ? ` — ${studentReg.rollNumber.length}/15` : ''}</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sregEmail">Email Address</Label>
                      <Input id="sregEmail" type="email" placeholder="yourid@srmist.edu.in" required
                        value={studentReg.email} onChange={e => setStudentReg(p => ({ ...p, email: e.target.value }))} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="sregProgram">Program</Label>
                        <select id="sregProgram" required
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={studentReg.program} onChange={e => setStudentReg(p => ({ ...p, program: e.target.value }))}>
                          <option value="">Select program</option>
                          {PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sregDept">Department</Label>
                        <Input id="sregDept" value={studentReg.department} readOnly disabled className="bg-slate-50" />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="sregYear">Year</Label>
                        <select id="sregYear" required
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={studentReg.year} onChange={e => setStudentReg(p => ({ ...p, year: e.target.value }))}>
                          <option value="">Year</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sregBatch">Batch</Label>
                        <Input id="sregBatch" placeholder="2024-2027" required
                          value={studentReg.batch} onChange={e => setStudentReg(p => ({ ...p, batch: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sregSection">Section</Label>
                        <select id="sregSection" required
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={studentReg.section} onChange={e => setStudentReg(p => ({ ...p, section: e.target.value }))}>
                          <option value="">Sec</option>
                          {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>

                    {studentRegError && (
                      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                        {studentRegError}
                      </p>
                    )}

                    <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs text-blue-700">
                      💡 Your default password will be your Roll Number. You can log in right after registering.
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" disabled={isLoading}
                      className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg text-white rounded-xl">
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      {isLoading ? 'Creating account…' : 'Create Account'}
                    </Button>
                  </CardFooter>
                </form>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* ── STAFF PORTAL ── */}
        {portal === 'staff' && (
          <Tabs value={staffTab} onValueChange={setStaffTab}>
            <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-xl mb-4">
              <TabsTrigger value="login"    className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Login</TabsTrigger>
              <TabsTrigger value="register" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Register</TabsTrigger>
            </TabsList>

            {/* Staff Login */}
            <TabsContent value="login">
              <Card className="border-none shadow-2xl bg-white/90 backdrop-blur-sm">
                <CardHeader className="space-y-1">
                  <CardTitle className="font-headline text-2xl text-slate-900">Staff Login</CardTitle>
                  <CardDescription>For Teachers, HOD, Dean, Deputy Dean, Pro-VC, and Admin</CardDescription>
                </CardHeader>
                <form onSubmit={handleStaffLogin}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="staffEmail">Email Address</Label>
                      <Input
                        id="staffEmail" type="email" required
                        placeholder="yourid@srmist.edu.in"
                        value={staffEmail}
                        onChange={e => setStaffEmail(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="staffPw">Password</Label>
                      <div className="relative">
                        <Input
                          id="staffPw"
                          type={showStaffPw ? 'text' : 'password'}
                          required className="pr-10"
                          value={staffPw}
                          onChange={e => setStaffPw(e.target.value)}
                        />
                        <button type="button" tabIndex={-1}
                          onClick={() => setShowStaffPw(p => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {showStaffPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button type="button"
                        onClick={() => setForgotOpen(true)}
                        className="text-xs text-violet-600 hover:text-violet-800 hover:underline">
                        Forgot password?
                      </button>
                    </div>

                    {loginError && (
                      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                        {loginError}
                      </p>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" disabled={isLoading}
                      className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg text-white rounded-xl">
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      {isLoading ? 'Signing in…' : 'Sign In as Staff'}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>

            {/* Staff Register */}
            <TabsContent value="register">
              <Card className="border-none shadow-2xl bg-white/90 backdrop-blur-sm">
                <CardHeader className="space-y-1">
                  <CardTitle className="font-headline text-2xl text-slate-900">Create Staff Account</CardTitle>
                  <CardDescription>Register as a Teacher. Dean/Admin accounts are created by the Administrator.</CardDescription>
                </CardHeader>
                <form onSubmit={handleRegister}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="regName">Full Name</Label>
                      <Input id="regName" placeholder="Dr. John Smith" required
                        value={regData.name} onChange={e => setRegData(p => ({ ...p, name: e.target.value }))} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="regEmail">Email Address</Label>
                      <Input id="regEmail" type="email" placeholder="yourname@srmist.edu.in.in" required
                        value={regData.email} onChange={e => setRegData(p => ({ ...p, email: e.target.value }))} />
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                      <Label htmlFor="regPw">Password</Label>
                      <div className="relative">
                        <Input id="regPw" type={showRegPw ? 'text' : 'password'} required
                          placeholder="Min. 6 characters" className="pr-10"
                          value={regData.password}
                          onChange={e => { setRegData(p => ({ ...p, password: e.target.value })); setPwError(''); }} />
                        <button type="button" tabIndex={-1} onClick={() => setShowRegPw(p => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {showRegPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {strength && (
                        <div className="space-y-1">
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${strength.color} ${strength.width}`} />
                          </div>
                          <p className={`text-xs ${strength.textColor}`}>{strength.label}</p>
                        </div>
                      )}
                    </div>

                    {/* Confirm password */}
                    <div className="space-y-2">
                      <Label htmlFor="confirmPw">Confirm Password</Label>
                      <div className="relative">
                        <Input id="confirmPw" type={showConfirmPw ? 'text' : 'password'} required
                          placeholder="Re-enter your password"
                          className={`pr-10 ${pwError ? 'border-red-400' : ''}`}
                          value={regData.confirmPassword}
                          onChange={e => { setRegData(p => ({ ...p, confirmPassword: e.target.value })); setPwError(''); }} />
                        <button type="button" tabIndex={-1} onClick={() => setShowConfirmPw(p => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {regData.confirmPassword && (
                        <p className={`text-xs ${regData.password === regData.confirmPassword ? 'text-green-600' : 'text-red-500'}`}>
                          {regData.password === regData.confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                        </p>
                      )}
                      {pwError && <p className="text-xs text-red-500">{pwError}</p>}
                    </div>

                    {/* Role */}
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <RadioGroup defaultValue="teacher"
                        onValueChange={val => setRegData(p => ({ ...p, role: val as UserRole }))}
                        className="flex gap-4">
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="teacher" id="r-teacher" />
                          <Label htmlFor="r-teacher">Teacher</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="student" id="r-student" />
                          <Label htmlFor="r-student">Student</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" disabled={isLoading}
                      className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg text-white rounded-xl">
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      {isLoading ? 'Creating account…' : 'Create Account'}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* ── Forgot Password Dialog ── */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-indigo-600" /> Forgot Password?
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-4">
            {portal === 'student' ? (
              <div className="space-y-3">
                <div className="flex gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <KeyRound className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800">Default password is your Roll Number</p>
                    <p className="text-xs text-blue-600 mt-0.5">
                      Your password is set to your Roll Number by default (e.g. <span className="font-mono">RA2531212010001</span>). Try logging in with it.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <Users className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Changed your password and forgot it?</p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Contact your <strong>class teacher or admin</strong>. They can reset your password back to your Roll Number from the admin panel.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <KeyRound className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800">Default password</p>
                    <p className="text-xs text-blue-600 mt-0.5">
                      Your default password is the part of your email before "@" (e.g. email <span className="font-mono">john@srmist.edu.in</span> → password <span className="font-mono">john</span>).
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <Users className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Still can't log in?</p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Contact the <strong>system administrator</strong>. They can reset your password from the Staff Management panel.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setForgotOpen(false)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
              Back to Login
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}