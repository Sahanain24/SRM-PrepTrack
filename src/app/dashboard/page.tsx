'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen, Code, UserCircle, Bell, MessageSquare,
  Trophy, Brain, CheckCircle2,
} from 'lucide-react';
import { getCurrentUser, User, TeacherFeedback } from '@/lib/mock-db';
import Link from 'next/link';

// Local types for API responses — avoids implicit any
interface ExamAttempt     { percentage: number }
interface AptitudeAttempt { percentage: number }

export default function DashboardOverview() {
  const router = useRouter();
  const [user, setUser]           = useState<User | null>(null);
  const [feedbacks, setFeedbacks] = useState<TeacherFeedback[]>([]);
  const [stats, setStats]         = useState({
    quizzesTaken: 0, codingDone: 0, logsCount: 0,
    examsTaken: 0, aptitudeTaken: 0, examAvg: 0, aptitudeAvg: 0,
  });

  useEffect(() => {
    (async () => {
      try {
        const { db } = await import('@/lib/mock-db');
        const u = getCurrentUser();
        if (u?.role === 'teacher') { router.push('/dashboard/teacher'); return; }
        setUser(u);
        if (!u) return;
        const uid = u.id || u._id;

        const [sessions, quizzes, coding, logs, feedback] = await Promise.all([
          db.getStudySessions(uid), db.getQuizResults(uid),
          db.getCodingSubmissions(uid), db.getStudyLogs(uid),
          db.getTeacherFeedback(uid),
        ]);
        setFeedbacks(feedback);

        // Exam + aptitude results from MongoDB API
        const [examRes, aptRes] = await Promise.all([
          fetch(`/api/exam-results?userId=${uid}`).then(r => r.json()),
          fetch(`/api/aptitude-results?userId=${uid}`).then(r => r.json()),
        ]);

        const exams:    ExamAttempt[]     = Array.isArray(examRes) ? examRes : [];
        const aptitude: AptitudeAttempt[] = Array.isArray(aptRes)  ? aptRes  : [];

        const examAvg = exams.length
          ? Math.round(exams.reduce((a: number, e: ExamAttempt) => a + e.percentage, 0) / exams.length)
          : 0;
        const aptAvg = aptitude.length
          ? Math.round(aptitude.reduce((a: number, e: AptitudeAttempt) => a + e.percentage, 0) / aptitude.length)
          : 0;

        setStats({
          quizzesTaken: quizzes.length, codingDone: coding.length, logsCount: logs.length,
          examsTaken: exams.length, aptitudeTaken: aptitude.length,
          examAvg, aptitudeAvg: aptAvg,
        });
      } catch (e) { console.error(e); }
    })();
  }, [router]);

  if (!user || user.role === 'teacher') return null;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-headline font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Academic Overview
          </h1>
          <p className="text-slate-600 mt-1">Welcome back, {user.name}! 🎓</p>
        </div>
        <Button asChild className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg">
          <Link href="/dashboard/study"><BookOpen className="mr-2 h-4 w-4" />Manage Study Logs</Link>
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        {[
          { label: 'Study Logs',       value: stats.logsCount,     sub: 'Ready for quizzes',              icon: BookOpen,    bg: 'from-white to-blue-50',   iconBg: 'bg-blue-100 text-blue-600' },
          { label: 'Quizzes Taken',    value: stats.quizzesTaken,  sub: 'Goal: 5 per week',               icon: CheckCircle2, bg: 'from-white to-indigo-50', iconBg: 'bg-indigo-100 text-indigo-600' },
          { label: 'Coding Exercises', value: stats.codingDone,    sub: 'Building history',               icon: Code,        bg: 'from-white to-emerald-50', iconBg: 'bg-emerald-100 text-emerald-600' },
          { label: 'Exams Taken',      value: stats.examsTaken,    sub: `Avg score ${stats.examAvg}%`,    icon: Trophy,      bg: 'from-white to-violet-50',  iconBg: 'bg-violet-100 text-violet-600' },
          { label: 'Aptitude Tests',   value: stats.aptitudeTaken, sub: `Avg score ${stats.aptitudeAvg}%`,icon: Brain,       bg: 'from-white to-orange-50',  iconBg: 'bg-orange-100 text-orange-600' },
          { label: 'User Role',        value: user.role,           sub: 'SRM PrepTrack',                icon: UserCircle,  bg: 'from-white to-purple-50',  iconBg: 'bg-purple-100 text-purple-600' },
        ].map(s => (
          <Card key={s.label} className={`border-none shadow-lg bg-gradient-to-br ${s.bg} hover:shadow-xl transition-all duration-300`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">{s.label}</CardTitle>
              <div className={`p-2 rounded-lg ${s.iconBg}`}><s.icon className="h-4 w-4" /></div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-headline font-bold text-slate-900 capitalize">{s.value}</div>
              <p className="text-xs text-slate-500 mt-1">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Exam Arena summary */}
      {stats.examsTaken > 0 && (
        <Card className="border-none shadow-lg bg-gradient-to-br from-white to-violet-50">
          <CardHeader className="pb-3">
            <CardTitle className="font-headline flex items-center gap-3 text-xl">
              <div className="p-2 rounded-lg bg-violet-100 text-violet-600"><Trophy className="h-5 w-5" /></div>
              Exam Arena Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-violet-50 rounded-xl p-3 text-center border border-violet-100">
                <p className="text-2xl font-bold text-violet-700">{stats.examsTaken}</p>
                <p className="text-xs text-slate-500 mt-1">Exams Taken</p>
              </div>
              <div className="bg-violet-50 rounded-xl p-3 text-center border border-violet-100">
                <p className={`text-2xl font-bold ${stats.examAvg >= 80 ? 'text-green-600' : stats.examAvg >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>
                  {stats.examAvg}%
                </p>
                <p className="text-xs text-slate-500 mt-1">Average Score</p>
              </div>
              <div className="bg-violet-50 rounded-xl p-3 text-center border border-violet-100 col-span-2 sm:col-span-1">
                <Button asChild size="sm" className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl w-full">
                  <Link href="/dashboard/exam">Take Exam</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aptitude Arena summary */}
      {stats.aptitudeTaken > 0 && (
        <Card className="border-none shadow-lg bg-gradient-to-br from-white to-orange-50">
          <CardHeader className="pb-3">
            <CardTitle className="font-headline flex items-center gap-3 text-xl">
              <div className="p-2 rounded-lg bg-orange-100 text-orange-600"><Brain className="h-5 w-5" /></div>
              Aptitude Arena Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-orange-50 rounded-xl p-3 text-center border border-orange-100">
                <p className="text-2xl font-bold text-orange-600">{stats.aptitudeTaken}</p>
                <p className="text-xs text-slate-500 mt-1">Tests Taken</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-3 text-center border border-orange-100">
                <p className={`text-2xl font-bold ${stats.aptitudeAvg >= 80 ? 'text-green-600' : stats.aptitudeAvg >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>
                  {stats.aptitudeAvg}%
                </p>
                <p className="text-xs text-slate-500 mt-1">Average Score</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-3 text-center border border-orange-100 col-span-2 sm:col-span-1">
                <Button asChild size="sm" className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl w-full">
                  <Link href="/dashboard/aptitude">Practice Now</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Feedback with notification dot */}
        <Card className="border-none shadow-xl bg-gradient-to-br from-white to-blue-50">
          <CardHeader className="pb-4">
            <CardTitle className="font-headline flex items-center gap-3 text-xl">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-600 relative">
                <Bell className="h-5 w-5" />
                {feedbacks.some(f => !f.read) && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
                )}
              </div>
              Teacher Feedback
              {feedbacks.filter(f => !f.read).length > 0 && (
                <Badge className="bg-red-500 text-white text-xs ml-1">
                  {feedbacks.filter(f => !f.read).length} new
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Targeted advice from your educators.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {feedbacks.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p>No feedback yet. Keep studying!</p>
                </div>
              ) : feedbacks.slice(0, 5).map(f => (
                <div key={f._id || f.id} className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                  <p className="text-sm mb-2 text-slate-700">{f.message}</p>
                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span>Teacher · {new Intl.DateTimeFormat('en-GB').format(new Date(f.date))}</span>
                    {!f.read && <Badge variant="secondary" className="bg-red-100 text-red-700 text-[10px]">New</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recommended next steps */}
        <Card className="border-none shadow-lg bg-gradient-to-br from-white to-slate-50">
          <CardHeader><CardTitle className="font-headline text-xl">Recommended Next Steps</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {stats.logsCount === 0 ? (
                <li className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-sm text-slate-900">Create your first Study Log</h5>
                    <p className="text-xs text-slate-600 mt-1">Add notes to generate personalized quizzes.</p>
                  </div>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700" asChild>
                    <Link href="/dashboard/study">Start</Link>
                  </Button>
                </li>
              ) : (
                <li className="p-4 bg-gradient-to-r from-indigo-50 to-indigo-100 border border-indigo-200 rounded-xl flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-sm text-slate-900">Test your knowledge</h5>
                    <p className="text-xs text-slate-600 mt-1">Take a quiz based on your latest study log.</p>
                  </div>
                  <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" asChild>
                    <Link href="/dashboard/quiz">Quiz Me</Link>
                  </Button>
                </li>
              )}
              <li className="p-4 bg-gradient-to-r from-violet-50 to-violet-100 border border-violet-200 rounded-xl flex items-center justify-between">
                <div>
                  <h5 className="font-bold text-sm text-slate-900">Take a Subject Exam</h5>
                  <p className="text-xs text-slate-600 mt-1">AI-generated exam from your course syllabus.</p>
                </div>
                <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white" asChild>
                  <Link href="/dashboard/exam">Exam</Link>
                </Button>
              </li>
              <li className="p-4 bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-xl flex items-center justify-between">
                <div>
                  <h5 className="font-bold text-sm text-slate-900">Practice Aptitude</h5>
                  <p className="text-xs text-slate-600 mt-1">Placement-level aptitude with step-by-step solutions.</p>
                </div>
                <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" asChild>
                  <Link href="/dashboard/aptitude">Practice</Link>
                </Button>
              </li>
              <li className="p-4 bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div>
                  <h5 className="font-bold text-sm text-slate-900">Coding Lab</h5>
                  <p className="text-xs text-slate-600 mt-1">Generate a challenge to improve logic.</p>
                </div>
                <Button size="sm" variant="outline" className="border-emerald-300 text-emerald-700" asChild>
                  <Link href="/dashboard/coding">Practice</Link>
                </Button>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}