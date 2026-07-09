'use client';
/**
 * Exam Arena — Fixed bugs:
 * 1. Single overall countdown timer (not per-question)
 * 2. Red pulse warning at ≤ 60 seconds remaining
 * 3. Sidebar hidden during exam (layout.tsx handles this)
 * 4. No difficulty selector
 * 5. Copy/paste/right-click blocked
 * 6. No XP
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getCurrentUser } from '@/lib/mock-db';
import { generateExamFlow, GenerateExamOutput } from '@/ai/flows/generate-exam-flow';
import {
  Trophy, Timer, Target, BookOpen, Brain,
  CheckCircle2, XCircle, ChevronRight, ChevronLeft,
  RotateCcw, Loader2, Lightbulb, Flag, AlertTriangle, TrendingUp, GraduationCap, ArrowLeft,
} from 'lucide-react';

// Renders question text: prose lines as normal text, code-looking lines in a monospace block
function QuestionText({ text, className }: { text: string; className?: string }) {
  const lines = text.split('\n');
  const codeStart = lines.findIndex(l => /^\s{2,}|^(def |class |int |void |public |#include|import |from |const |let |var |function |print\(|System\.|cout)/.test(l));
  if (codeStart === -1) {
    return <span className={className} style={{ whiteSpace: 'pre-wrap' }}>{text}</span>;
  }
  const prose = lines.slice(0, codeStart).join('\n').trim();
  const code  = lines.slice(codeStart).join('\n').trim();
  return (
    <span className={className}>
      {prose && <span style={{ whiteSpace: 'pre-wrap' }}>{prose}{'\n'}</span>}
      <code className="block mt-2 p-3 rounded-xl bg-slate-900 text-slate-100 text-sm font-mono leading-relaxed overflow-x-auto whitespace-pre">
        {code}
      </code>
    </span>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────
// Total exam time = 90 seconds × number of questions
const SECONDS_PER_QUESTION = 90;
const QUESTION_COUNTS      = [5, 10, 15, 20];

type Phase = 'setup' | 'generating' | 'exam' | 'results';

interface Subject { _id?: string; name: string; syllabus: string; topics: string[] }
interface Course  { _id: string; name: string; description: string; subjects: Subject[] }
interface LeaderboardEntry {
  userId: string; userName: string;
  courseId: string; courseName: string;
  bestScore: number; attempts: number;
  rollNumber: string; program: string; year: string | number; section: string;
  examDate: string;
}

function fmt(s: number) {
  const safe = Math.max(0, Math.floor(s));
  return `${Math.floor(safe / 60).toString().padStart(2, '0')}:${(safe % 60).toString().padStart(2, '0')}`;
}

// ── Setup ─────────────────────────────────────────────────────────────────────
function SetupScreen({ onStart, onStartScheduled }: {
  onStart: (c: Course, s: Subject, count: number) => void;
  onStartScheduled: (exam: any) => void;
}) {
  const [courses, setCourses]                 = useState<Course[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [selectedCourse, setSelectedCourse]   = useState<Course | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [count, setCount]                     = useState(10);
  const [leaderboard, setLeaderboard]         = useState<LeaderboardEntry[]>([]);
  const [lbExam,      setLbExam]              = useState<string>('');
  const [tab, setTab]                         = useState<'setup' | 'pending' | 'scheduled' | 'leaderboard'>('pending');
  const [scheduledExams, setScheduledExams]   = useState<any[]>([]);
  const [schedLoading, setSchedLoading]       = useState(false);
  const [starting, setStarting]               = useState<string | null>(null);
  const [reviewingResult, setReviewingResult] = useState<{ examData: ExamData; answers: number[]; score: number; timeTaken: number; tabViolations: number } | null>(null);
  const [reviewLoading, setReviewLoading]     = useState<string | null>(null);
  const { toast } = useToast();

  const loadScheduledExams = () => {
    const user = getCurrentUser() as any;
    if (!user) return;
    setSchedLoading(true);
    const params = new URLSearchParams();
    if (user.program) params.set('program', user.program);
    if (user.year)    params.set('year',    String(user.year));
    if (user.batch)   params.set('batch',   user.batch   || '');
    if (user.section) params.set('section', user.section || '');
    const userId = user._id || user.id;
    if (userId) params.set('userId', userId);
    fetch(`/api/student-exams?${params}`)
      .then(r => r.json())
      .then(d => setScheduledExams(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setSchedLoading(false));
  };

  useEffect(() => {
    Promise.all([
      fetch('/api/courses').then(r => r.json()),
      fetch('/api/exam-results?leaderboard=1').then(r => r.json()),
    ]).then(([c, l]) => {
      setCourses(Array.isArray(c) ? c : []);
      const lb = Array.isArray(l) ? l : [];
      setLeaderboard(lb);
      if (lb.length > 0) setLbExam(lb[0].courseId);
      setLoading(false);
    }).catch(() => setLoading(false));

    loadScheduledExams();
  }, []);

  const handleStartScheduled = async (exam: any) => {
    setStarting(exam._id);
    try {
      const user   = getCurrentUser() as any;
      const userId = user?._id || user?.id || '';
      const res    = await fetch(`/api/student-exams/${exam._id}/start?userId=${userId}`);
      const full   = await res.json();
      if (!res.ok) throw new Error(full.error);
      onStartScheduled(full);
    } catch (e: any) {
      alert(e.message || 'Failed to start exam');
    } finally {
      setStarting(null);
      loadScheduledExams(); // refresh status after attempt
    }
  };

  const handleReview = async (exam: any) => {
    setReviewLoading(exam._id);
    try {
      const user   = getCurrentUser() as any;
      const userId = user?._id || user?.id || '';
      const res    = await fetch(`/api/exam-results?courseId=${exam._id}&userId=${userId}`);
      const data   = await res.json();
      const result = Array.isArray(data) ? data[0] : null;
      if (!result) { alert('No result found for this exam.'); return; }

      const questions: ExamQuestion[] = (result.questions || []).map((q: any) => ({
        question:     q.question     || q.questionText || '',
        options:      Array.isArray(q.options)
                        ? q.options.map((o: any) => typeof o === 'string' ? o : o.text)
                        : [],
        correctIndex: q.correctIndex ?? result.correctAnswers?.[result.questions.indexOf(q)] ?? 0,
        explanation:  q.explanation  || '',
        topic:        q.topic        || '',
        section:      q.section      || '',
      }));

      setReviewingResult({
        examData:      { title: exam.title, questions },
        answers:       result.answers || [],
        score:         result.score,
        timeTaken:     result.timeTaken,
        tabViolations: result.tabViolations ?? 0,
      });
    } catch (e: any) {
      alert(e.message || 'Failed to load result');
    } finally {
      setReviewLoading(null);
    }
  };

  if (reviewingResult) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setReviewingResult(null)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Scheduled Tests
        </button>
        <ResultsScreen
          examData={reviewingResult.examData}
          answers={reviewingResult.answers}
          score={reviewingResult.score}
          timeTaken={reviewingResult.timeTaken}
          tabViolations={reviewingResult.tabViolations}
        />
      </div>
    );
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const canStart  = selectedCourse && selectedSubject;
  const totalMins = Math.ceil((count * SECONDS_PER_QUESTION) / 60);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pt-4 pb-12">
      <div className="text-center space-y-2">
        <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg">
          <Trophy className="h-10 w-10" />
        </div>
        <h1 className="text-4xl font-headline font-bold text-slate-900">Exam Arena</h1>
        {tab === 'setup' && (
          <p className="text-slate-500">Pick your course and subject. <strong>Total exam time = 90s × questions.</strong></p>
        )}
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as any)}>
        <TabsList className="bg-slate-100 rounded-xl w-full">
          <TabsTrigger value="setup" className="flex-1 rounded-lg">🧠 Self Assessment</TabsTrigger>
          <TabsTrigger value="pending" className="flex-1 rounded-lg">
            📋 Scheduled Tests
            {scheduledExams.filter(e => !e.alreadyAttempted).length > 0 && (
              <span className="ml-1.5 bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {scheduledExams.filter(e => !e.alreadyAttempted).length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="flex-1 rounded-lg">
            ✅ Test Results
            {scheduledExams.filter(e => e.alreadyAttempted).length > 0 && (
              <span className="ml-1.5 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {scheduledExams.filter(e => e.alreadyAttempted).length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="flex-1 rounded-lg">🏆 Leaderboard</TabsTrigger>
        </TabsList>

        {/* ── Self Assessment ───────────────────────────────────────────── */}
        <TabsContent value="setup" className="mt-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-indigo-500" /></div>
          ) : courses.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200 shadow-none">
              <CardContent className="flex flex-col items-center justify-center py-14 text-center gap-2">
                <BookOpen className="h-12 w-12 text-slate-300" />
                <p className="text-sm text-slate-400">No courses available yet. Ask your teacher to add courses.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="pt-6 pb-6 space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Select Course</Label>
                  <select
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                    value={selectedCourse?._id || ''}
                    onChange={e => {
                      const c = courses.find(c => c._id === e.target.value) || null;
                      setSelectedCourse(c);
                      setSelectedSubject(null);
                    }}
                  >
                    <option value="">-- Choose a course --</option>
                    {courses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>

                {selectedCourse && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Select Subject</Label>
                    <select
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                      value={selectedSubject?.name || ''}
                      onChange={e => {
                        const s = selectedCourse.subjects.find(s => s.name === e.target.value) || null;
                        setSelectedSubject(s);
                      }}
                    >
                      <option value="">-- Choose a subject --</option>
                      {selectedCourse.subjects.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                )}

                {selectedCourse && selectedSubject && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Number of Questions</Label>
                    <select
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                      value={count}
                      onChange={e => setCount(Number(e.target.value))}
                    >
                      {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n} questions (~{Math.ceil(n * SECONDS_PER_QUESTION / 60)} min)</option>)}
                    </select>
                  </div>
                )}

                <Button
                  disabled={!canStart}
                  onClick={() => canStart && onStart(selectedCourse!, selectedSubject!, count)}
                  className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                >
                  <Brain className="h-4 w-4" /> Generate Exam
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Scheduled Tests (pending) ─────────────────────────────────── */}
        <TabsContent value="pending" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <button onClick={loadScheduledExams} disabled={schedLoading}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 transition-colors disabled:opacity-50">
              {schedLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Refresh
            </button>
          </div>
          {schedLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
          ) : scheduledExams.filter(e => !e.alreadyAttempted).length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200 shadow-none">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <Trophy className="h-12 w-12 text-slate-300" />
                <p className="font-semibold text-slate-600">No scheduled tests</p>
                <p className="text-sm text-slate-400">Tests assigned by your teacher will appear here.</p>
                <button onClick={loadScheduledExams} className="mt-2 text-xs text-indigo-600 hover:underline flex items-center gap-1">
                  <RotateCcw className="h-3 w-3" /> Refresh
                </button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {scheduledExams.filter(e => !e.alreadyAttempted).map((exam: any) => {
                const isPast = exam.deadlineDate
                  ? new Date(`${exam.deadlineDate}T${exam.deadlineTime || '23:59'}:00`) < new Date()
                  : false;
                return (
                <Card key={exam._id} className={`shadow-sm transition-shadow ${isPast ? 'border-red-200 opacity-75' : 'border-indigo-200 hover:shadow-md'}`}>
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-slate-900">{exam.title}</h3>
                          {isPast
                            ? <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">Deadline Passed</Badge>
                            : <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-[10px]">Pending</Badge>}
                        </div>
                        {exam.subject && exam.subject !== exam.title && <p className="text-sm text-slate-500">{exam.subject}</p>}
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                          {exam.examDate && <span>📅 {new Intl.DateTimeFormat('en-GB').format(new Date(exam.examDate))}</span>}
                          {exam.startTime && <span>🕐 {exam.startTime}</span>}
                          {exam.deadlineDate && <span className="text-red-500">⏰ Deadline: {new Intl.DateTimeFormat('en-GB').format(new Date(exam.deadlineDate))} {exam.deadlineTime || ''}</span>}
                          <span>⏱ {exam.durationMins} min</span>
                          <span>📝 {exam.totalQuestions} questions</span>
                          <span>⭐ {exam.totalMarks} marks</span>
                        </div>
                        {isPast && <p className="text-xs text-red-500">The deadline for this test has passed.</p>}
                      </div>
                      {isPast
                        ? <Button disabled variant="outline" className="rounded-xl gap-2 flex-shrink-0">🔒 Locked</Button>
                        : <Button
                            onClick={() => handleStartScheduled(exam)}
                            disabled={starting === exam._id}
                            className="rounded-xl gap-2 flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white"
                          >
                            {starting === exam._id
                              ? <><Loader2 className="h-4 w-4 animate-spin" /> Starting…</>
                              : <><ChevronRight className="h-4 w-4" /> Start Test</>}
                          </Button>}
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Test Results (attempted) ──────────────────────────────────── */}
        <TabsContent value="scheduled" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <button
              onClick={loadScheduledExams}
              disabled={schedLoading}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 transition-colors disabled:opacity-50"
            >
              {schedLoading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RotateCcw className="h-3.5 w-3.5" />}
              Refresh
            </button>
          </div>
          {schedLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
          ) : scheduledExams.filter(e => e.alreadyAttempted || e.hasReAttemptPermission).length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200 shadow-none">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <Trophy className="h-12 w-12 text-slate-300" />
                <p className="font-semibold text-slate-600">No completed tests yet</p>
                <p className="text-sm text-slate-400">Your attempted tests will appear here once you submit them.</p>
                <button onClick={loadScheduledExams} className="mt-2 text-xs text-indigo-600 hover:underline flex items-center gap-1">
                  <RotateCcw className="h-3 w-3" /> Refresh
                </button>
              </CardContent>
            </Card>
          ) : (() => {
            const byRecent = (a: any, b: any) =>
              new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
            const now = new Date();
            const isPastDeadline = (e: any) => {
              if (!e.deadlineDate) return false;
              const dl = new Date(`${e.deadlineDate}T${e.deadlineTime || '23:59'}:00`);
              return dl < now;
            };
            const locked    = scheduledExams.filter(e => !e.alreadyAttempted && isPastDeadline(e) && !e.hasReAttemptPermission).sort(byRecent);
            const reattempt = scheduledExams.filter(e => !e.alreadyAttempted && isPastDeadline(e) &&  e.hasReAttemptPermission).sort(byRecent);
            const completed = scheduledExams.filter(e =>  e.alreadyAttempted).sort(byRecent);
            return (
              <>
                {reattempt.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mt-2">🔓 Reattempt Granted</p>
                    {reattempt.map((exam: any) => (
                      <Card key={exam._id} className="border-blue-300 shadow-sm">
                        <CardContent className="pt-5 pb-5">
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-slate-900">{exam.title}</h3>
                                <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">Reattempt Allowed</Badge>
                              </div>
                              {exam.subject && <p className="text-sm text-slate-500">{exam.subject}</p>}
                              <p className="text-xs text-blue-600">Your teacher has granted you a reattempt for this test.</p>
                              <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                                <span>⏱ {exam.durationMins} min</span>
                                <span>📝 {exam.totalQuestions} questions</span>
                              </div>
                            </div>
                            <Button onClick={() => handleStartScheduled(exam)} disabled={starting === exam._id}
                              className="rounded-xl gap-2 flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white">
                              {starting === exam._id ? <><Loader2 className="h-4 w-4 animate-spin" /> Starting…</> : <><ChevronRight className="h-4 w-4" /> Start Test</>}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {completed.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-2">Completed Tests</p>
                    {completed.map((exam: any) => {
                      const r = exam.attemptResult;
                      const pct = r?.percentage ?? 0;
                      const scoreColor = pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-amber-600' : 'text-red-500';
                      const scoreBg    = pct >= 80 ? 'bg-green-50 border-green-200' : pct >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
                      return (
                        <Card key={exam._id} className="border-green-200 shadow-sm">
                          <CardContent className="pt-5 pb-5">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                              <div className="space-y-1.5 flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold text-slate-900">{exam.title}</h3>
                                  <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">Completed</Badge>
                                </div>
                                {exam.subject && <p className="text-sm text-slate-500">{exam.subject}</p>}
                                <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                                  {exam.examDate && <span>📅 {new Intl.DateTimeFormat('en-GB').format(new Date(exam.examDate))}</span>}
                                  <span>📝 {exam.totalQuestions} questions</span>
                                  <span>⭐ {exam.totalMarks} marks</span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                {r ? (
                                  <div className={`flex flex-col items-center gap-0.5 px-4 py-3 rounded-2xl border ${scoreBg}`}>
                                    <span className={`text-2xl font-black ${scoreColor}`}>{Math.round(pct)}%</span>
                                    <span className="text-xs text-slate-500 font-medium">{r.score}/{r.total} correct</span>
                                    <span className={`text-[10px] font-semibold mt-0.5 ${scoreColor}`}>
                                      {pct >= 80 ? 'Excellent' : pct >= 60 ? 'Pass' : 'Needs Work'}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center gap-1">
                                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                                    <span className="text-[10px] text-green-600 font-semibold">Done</span>
                                  </div>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleReview(exam)}
                                  disabled={reviewLoading === exam._id}
                                  className="rounded-xl border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-xs"
                                >
                                  {reviewLoading === exam._id
                                    ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Loading…</>
                                    : <><BookOpen className="h-3 w-3 mr-1" />Review</>}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-4 space-y-4">
          {leaderboard.length === 0 ? (
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="py-12 text-center text-slate-400 text-sm">No attempts yet. Be the first!</CardContent>
            </Card>
          ) : (() => {
            // Group by exam
            const examMap = new Map<string, { name: string; entries: LeaderboardEntry[] }>();
            leaderboard.forEach(e => {
              if (!examMap.has(e.courseId)) examMap.set(e.courseId, { name: e.courseName || 'Unknown Test', entries: [] });
              examMap.get(e.courseId)!.entries.push(e);
            });
            const exams = Array.from(examMap.entries());

            const active     = examMap.get(lbExam) || exams[0]?.[1];
            const activeId   = lbExam || exams[0]?.[0];
            const rows       = (active?.entries || []).sort((a, b) => b.bestScore - a.bestScore);

            return (
              <>
                {/* Exam dropdown selector */}
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">Filter by Test:</label>
                  <select
                    value={activeId}
                    onChange={e => setLbExam(e.target.value)}
                    className="flex-1 min-w-[220px] px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    {exams.map(([id, { name, entries }]) => {
                      const date = entries[0]?.examDate;
                      const label = date
                        ? `${name} — ${new Intl.DateTimeFormat('en-GB').format(new Date(date))}`
                        : name;
                      return <option key={id} value={id}>{label}</option>;
                    })}
                  </select>
                </div>

                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      🏆 {active?.name || 'Leaderboard'}
                      {rows[0]?.examDate && (
                        <span className="text-xs font-normal text-slate-400">
                          📅 {new Intl.DateTimeFormat('en-GB').format(new Date(rows[0].examDate))}
                        </span>
                      )}
                      <span className="text-xs font-normal text-slate-400">· {rows.length} students</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50">
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 w-10">Rank</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Student</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Roll No.</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Program</th>
                            <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500">Year</th>
                            <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500">Section</th>
                            <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500">Best Score</th>
                            <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500">Attempts</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {rows.map((entry, idx) => {
                            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                            const scoreColor = entry.bestScore >= 80 ? 'text-green-600' : entry.bestScore >= 60 ? 'text-amber-600' : 'text-red-500';
                            return (
                              <tr key={entry.userId + entry.courseId}
                                className={`transition-colors hover:bg-slate-50 ${idx < 3 ? 'bg-amber-50/40' : ''}`}>
                                <td className="px-4 py-3 text-center">
                                  {medal ? <span className="text-lg">{medal}</span>
                                         : <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>}
                                </td>
                                <td className="px-4 py-3 font-semibold text-slate-900">{entry.userName}</td>
                                <td className="px-4 py-3 font-mono text-xs text-slate-600">{entry.rollNumber || '—'}</td>
                                <td className="px-4 py-3 text-xs text-slate-600">{entry.program || '—'}</td>
                                <td className="px-4 py-3 text-center text-xs text-slate-600">{entry.year ? `Y${entry.year}` : '—'}</td>
                                <td className="px-4 py-3 text-center text-xs text-slate-600">{entry.section || '—'}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`font-bold ${scoreColor}`}>{Math.round(entry.bestScore)}%</span>
                                </td>
                                <td className="px-4 py-3 text-center text-xs text-slate-500">{entry.attempts}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Section metadata ─────────────────────────────────────────────────────────
const SECTION_META = {
  technical: { label: 'Technical',   color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-300',   ring: 'ring-blue-400',   dot: 'bg-blue-500'   },
  aptitude:  { label: 'Aptitude',    color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-300',  ring: 'ring-amber-400',  dot: 'bg-amber-500'  },
  reasoning: { label: 'Reasoning',   color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-300', ring: 'ring-purple-400', dot: 'bg-purple-500' },
  verbal:    { label: 'Verbal',      color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-300',  ring: 'ring-green-400',  dot: 'bg-green-500'  },
} as const;
type SectionKey = keyof typeof SECTION_META;

type ExamQuestion = GenerateExamOutput['questions'][number] & { section?: string };
type ExamData = Omit<GenerateExamOutput, 'questions'> & { questions: ExamQuestion[] };

// ── Question Card ─────────────────────────────────────────────────────────────
function QuestionCard({ q, idx, total, answers, flagged, onAnswer, onFlag }: {
  q: ExamQuestion;
  idx: number;
  total: number;
  answers: (number | null)[];
  flagged: boolean[];
  onAnswer: (oidx: number) => void;
  onFlag: () => void;
}) {
  const qSection = q.section as SectionKey | undefined;
  const sm = qSection ? SECTION_META[qSection] ?? null : null;

  return (
    <Card className={`shadow-sm ${sm ? `border-l-4 ${sm.border}` : 'border-slate-200'}`}>
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-500">
                Q{idx + 1} / {total}
              </span>
              {sm && (
                <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${sm.bg} ${sm.color} border ${sm.border}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />{sm.label}
                </span>
              )}
              <Badge variant="outline" className="text-xs font-normal text-slate-500">{q.topic}</Badge>
              {flagged[idx] && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                  <Flag className="h-3 w-3" />Flagged for review
                </span>
              )}
            </div>
            <CardTitle className="text-lg font-semibold text-slate-900 leading-snug"><QuestionText text={q.question} /></CardTitle>
          </div>
          <button
            onClick={onFlag}
            title="Flag this question to review it later before submitting"
            className={`p-2 rounded-xl transition-all flex-shrink-0
              ${flagged[idx] ? 'bg-amber-100 text-amber-600' : 'bg-slate-50 text-slate-400 hover:bg-amber-50 hover:text-amber-500'}`}>
            <Flag className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-5 space-y-3">
        {q.options.map((opt, oidx) => {
          const sel = answers[idx] === oidx;
          return (
            <button key={oidx}
              onClick={() => onAnswer(oidx)}
              className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all
                ${sel ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50'}`}>
              <span className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold
                ${sel ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {['A', 'B', 'C', 'D'][oidx]}
              </span>
              <span className={`text-sm font-medium leading-relaxed ${sel ? 'text-indigo-900' : 'text-slate-700'}`}>{opt}</span>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ── Exam Screen ───────────────────────────────────────────────────────────────
function ExamScreen({ examData, totalSeconds, onComplete }: {
  examData: ExamData;
  totalSeconds: number;
  onComplete: (answers: number[], timeTaken: number, tabViolations: number) => void;
}) {
  const [idx, setIdx]         = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(examData.questions.length).fill(null));
  const [flagged, setFlagged] = useState<boolean[]>(Array(examData.questions.length).fill(false));

  // Single overall countdown
  const [timeLeft, setTimeLeft] = useState(totalSeconds);
  const startedAt               = useRef(Date.now());
  const timerRef                = useRef<NodeJS.Timeout | null>(null);
  // Mirror of answers kept in a ref so auto-submit callbacks can read latest
  // value without calling setState inside another setState updater.
  const answersRef = useRef<(number | null)[]>(Array(examData.questions.length).fill(null));

  // Section grouping — only active when questions carry a section field
  const hasSections = examData.questions.some(q => q.section);
  const [activeSection, setActiveSection] = useState<SectionKey | 'all'>('all');

  const presentSections = hasSections
    ? (Object.keys(SECTION_META) as SectionKey[]).filter(s =>
        examData.questions.some(q => q.section === s)
      )
    : [];

  // Indices of questions in the active section filter
  const sectionIndices = activeSection === 'all'
    ? examData.questions.map((_, i) => i)
    : examData.questions.reduce<number[]>((acc, q, i) => {
        if (q.section === activeSection) acc.push(i);
        return acc;
      }, []);

  const q        = examData.questions[idx];
  const answered = answers.filter(a => a !== null).length;

  // Section progress helper
  const sectionProgress = (s: SectionKey) => {
    const qs = examData.questions.map((q, i) => ({ q, i })).filter(({ q }) => q.section === s);
    const done = qs.filter(({ i }) => answers[i] !== null).length;
    return { total: qs.length, done };
  };

  const tabSwitchesRef = useRef(0);

  const submitExam = useCallback(() => {
    clearInterval(timerRef.current!);
    const elapsed = Math.round((Date.now() - startedAt.current) / 1000);
    onComplete(answersRef.current.map(a => a ?? -1), elapsed, tabSwitchesRef.current);
  }, [onComplete]);

  // Overall countdown — auto-submits when time runs out
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          submitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [submitExam]);

  // Block copy/paste/right-click
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    document.addEventListener('copy', block);
    document.addEventListener('cut', block);
    document.addEventListener('contextmenu', block);
    return () => {
      document.removeEventListener('copy', block);
      document.removeEventListener('cut', block);
      document.removeEventListener('contextmenu', block);
    };
  }, []);

  // Block browser back button — push a sentinel history entry so pressing back
  // triggers popstate instead of leaving the page; auto-submit on popstate.
  useEffect(() => {
    window.history.pushState({ examInProgress: true }, '');
    const handlePopState = () => {
      // Re-push so repeated back presses also hit this handler
      window.history.pushState({ examInProgress: true }, '');
      submitExam();
    };
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      submitExam();
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [submitExam]);

  // ── Tab-switch / focus-loss detection ──────────────────────────────────────
  const [tabSwitches, setTabSwitches] = useState(0);
  const MAX_TAB_SWITCHES = 3;

  useEffect(() => { tabSwitchesRef.current = tabSwitches; }, [tabSwitches]);

  useEffect(() => {
    const handleViolation = () => {
      setTabSwitches(prev => {
        const next = prev + 1;
        tabSwitchesRef.current = next;
        if (next >= MAX_TAB_SWITCHES) {
          submitExam();
        } else {
          alert(
            `Warning ${next}/${MAX_TAB_SWITCHES}: Switching tabs or leaving the exam window is not allowed.\n` +
            `The exam will be auto-submitted after ${MAX_TAB_SWITCHES} violations.`
          );
        }
        return next;
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) handleViolation();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleViolation);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleViolation);
    };
  }, [submitExam]);

  // ── Calculator ────────────────────────────────────────────────────────────
  const [calcOpen,    setCalcOpen]    = useState(false);
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcPrev,    setCalcPrev]    = useState('');
  const [calcOp,      setCalcOp]      = useState('');
  const [calcFresh,   setCalcFresh]   = useState(true);

  const calcPress = (val: string) => {
    if (val === 'C')  { setCalcDisplay('0'); setCalcPrev(''); setCalcOp(''); setCalcFresh(true); return; }
    if (val === '⌫')  { setCalcDisplay(d => d.length > 1 ? d.slice(0, -1) : '0'); return; }
    if (['+','−','×','÷'].includes(val)) { setCalcPrev(calcDisplay); setCalcOp(val); setCalcFresh(true); return; }
    if (val === '=') {
      if (!calcOp || !calcPrev) return;
      const a = parseFloat(calcPrev), b = parseFloat(calcDisplay);
      const res = calcOp === '+' ? a + b : calcOp === '−' ? a - b : calcOp === '×' ? a * b : b !== 0 ? a / b : 'Error';
      setCalcDisplay(typeof res === 'number' ? parseFloat(res.toFixed(10)).toString() : 'Error');
      setCalcPrev(''); setCalcOp(''); setCalcFresh(true); return;
    }
    if (val === '.' && calcDisplay.includes('.')) return;
    setCalcDisplay(d => calcFresh ? (val === '.' ? '0.' : val) : (d === '0' && val !== '.' ? val : d + val));
    setCalcFresh(false);
  };

  const CALC_KEYS = [
    ['C','⌫','÷','×'],
    ['7','8','9','−'],
    ['4','5','6','+'],
    ['1','2','3','='],
    ['.','0'],
  ];

  const warn    = timeLeft <= 60;
  const timePct = (timeLeft / totalSeconds) * 100;

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-12 select-none" onCopy={e => e.preventDefault()}>
      {/* Top bar */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-3 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 text-sm truncate max-w-[200px]">{examData.title}</span>
          <span className="text-xs text-slate-400">{answered}/{examData.questions.length} answered</span>
          {tabSwitches > 0 && (
            <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              Tab switches: {tabSwitches}/{MAX_TAB_SWITCHES}
            </span>
          )}
        </div>
        {/* Overall countdown — turns red + pulses at ≤ 60s */}
        <div className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono font-bold text-base transition-all duration-300
          ${warn ? 'bg-red-100 text-red-600 ring-2 ring-red-400 animate-pulse scale-110' : 'bg-slate-100 text-slate-700'}`}>
          <Timer className="h-5 w-5" />
          {fmt(timeLeft)}
          {warn && <span className="text-xs ml-1">Time running out!</span>}
        </div>
      </div>

      {/* Timer bar */}
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-1000 ${warn ? 'bg-red-500' : 'bg-indigo-500'}`}
          style={{ width: `${timePct}%` }} />
      </div>

      {/* Section tabs — only shown when exam has sections */}
      {hasSections && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveSection('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              activeSection === 'all'
                ? 'bg-slate-700 text-white border-slate-700'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}
          >
            All ({examData.questions.length})
          </button>
          {presentSections.map(s => {
            const meta = SECTION_META[s];
            const { total, done } = sectionProgress(s);
            return (
              <button
                key={s}
                onClick={() => {
                  setActiveSection(s);
                  const first = examData.questions.findIndex(q => q.section === s);
                  if (first !== -1) setIdx(first);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  activeSection === s
                    ? `${meta.bg} ${meta.color} ${meta.border} ring-2 ${meta.ring}`
                    : `bg-white ${meta.color} border-slate-200 hover:${meta.border}`
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                {meta.label}
                <span className="ml-1 font-normal text-slate-400">{done}/{total}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Question */}
        <div className="lg:col-span-3 space-y-4">
          <QuestionCard
            q={q}
            idx={idx}
            total={examData.questions.length}
            answers={answers}
            flagged={flagged}
            onAnswer={oidx => setAnswers(a => { const n = [...a]; n[idx] = oidx; answersRef.current = n; return n; })}
            onFlag={() => setFlagged(f => { const n = [...f]; n[idx] = !n[idx]; return n; })}
          />
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setIdx(i => i - 1)} disabled={idx === 0} className="rounded-xl">
              <ChevronLeft className="h-4 w-4 mr-1" />Previous
            </Button>
            {idx === examData.questions.length - 1 ? (
              <Button onClick={() => submitExam()}
                className="rounded-xl px-6 bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle2 className="h-4 w-4 mr-2" />Submit Exam
              </Button>
            ) : (
              <Button onClick={() => setIdx(i => i + 1)}
                className="rounded-xl px-6 bg-indigo-600 hover:bg-indigo-700 text-white">
                Next<ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>

        {/* Navigator */}
        <div className="lg:col-span-1">
          <Card className="border-slate-200 shadow-sm sticky top-4">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-slate-700">Navigator</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              {hasSections ? (
                /* Grouped by section */
                presentSections.map(s => {
                  const meta = SECTION_META[s];
                  const qs = examData.questions.map((q, i) => ({ q, i })).filter(({ q }) => q.section === s);
                  return (
                    <div key={s}>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${meta.color}`}>{meta.label}</p>
                      <div className="grid grid-cols-5 gap-1">
                        {qs.map(({ i }) => (
                          <button key={i} onClick={() => setIdx(i)}
                            className={`w-full aspect-square rounded-lg text-xs font-bold transition-all
                              ${i === idx
                                ? `${meta.bg} ${meta.color} ring-2 ${meta.ring} border ${meta.border}`
                                : flagged[i]
                                  ? 'bg-amber-100 text-amber-700 border border-amber-300'
                                  : answers[i] !== null
                                    ? `${meta.bg} ${meta.color} border ${meta.border} opacity-80`
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                            {i + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                /* Flat grid when no sections */
                <div className="grid grid-cols-5 gap-1.5">
                  {examData.questions.map((_, i) => (
                    <button key={i} onClick={() => setIdx(i)}
                      className={`w-full aspect-square rounded-lg text-xs font-bold transition-all
                        ${i === idx ? 'bg-indigo-600 text-white ring-2 ring-indigo-300' :
                          flagged[i] ? 'bg-amber-100 text-amber-700 border border-amber-300' :
                          answers[i] !== null ? 'bg-green-100 text-green-700 border border-green-300' :
                          'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}

              <div className="pt-3 border-t border-slate-100">
                <Progress value={(answered / examData.questions.length) * 100} className="h-2 mb-1" />
                <p className="text-xs text-center text-slate-500">{answered} of {examData.questions.length} answered</p>
              </div>

              {/* Calculator */}
              <div className="pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCalcOpen(o => !o)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors py-1"
                >
                  <span>🧮 Calculator</span>
                  <span className="text-slate-400">{calcOpen ? '▲' : '▼'}</span>
                </button>
                {calcOpen && (
                  <div className="mt-2">
                    <div className="bg-slate-900 text-white rounded-xl px-3 py-2 mb-2 text-right">
                      {calcOp && <p className="text-[10px] text-slate-400">{calcPrev} {calcOp}</p>}
                      <p className="text-xl font-mono font-bold overflow-hidden text-ellipsis">{calcDisplay}</p>
                    </div>
                    <div className="space-y-1">
                      {CALC_KEYS.map((row, ri) => (
                        <div key={ri} className="flex gap-1">
                          {row.map(k => {
                            const isOp = ['+','−','×','÷'].includes(k);
                            const isEq = k === '=';
                            const isCl = k === 'C';
                            return (
                              <button key={k} type="button" onClick={() => calcPress(k)}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all active:scale-95
                                  ${isCl ? 'bg-red-100 text-red-700 hover:bg-red-200' :
                                    isEq ? 'bg-orange-500 text-white hover:bg-orange-600' :
                                    isOp ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' :
                                           'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}>
                                {k}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {flagged.some(Boolean) && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs font-semibold text-amber-700 mb-1.5">Flagged for review:</p>
                  <div className="flex flex-wrap gap-1">
                    {flagged.map((f, i) => f ? (
                      <button key={i} onClick={() => setIdx(i)}
                        className="w-6 h-6 rounded bg-amber-200 text-amber-800 text-xs font-bold hover:bg-amber-300">
                        {i + 1}
                      </button>
                    ) : null)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Results ───────────────────────────────────────────────────────────────────
function ResultsScreen({ examData, answers, score, timeTaken, tabViolations, onRestart }: {
  examData: ExamData; answers: number[]; score: number; timeTaken: number;
  tabViolations?: number; onRestart?: () => void;
}) {
  const router = useRouter();
  const [view, setView]         = useState<'summary' | 'review'>('summary');
  const [expanded, setExpanded] = useState<number | null>(null);
  const pct     = Math.round((score / examData.questions.length) * 100);
  const letters = ['A', 'B', 'C', 'D'];
  const gradBg  = pct >= 80 ? 'from-green-500 to-emerald-600' : pct >= 60 ? 'from-yellow-500 to-orange-500' : 'from-red-500 to-rose-600';
  const verdict = pct >= 90 ? 'Outstanding! 🏆' : pct >= 80 ? 'Excellent! ⭐' : pct >= 70 ? 'Good Job! 👍' : pct >= 60 ? 'Pass 📘' : 'Keep Practising 💪';

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12 pt-4">
      <Tabs value={view} onValueChange={v => setView(v as any)}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-2xl font-headline font-bold text-slate-900">Exam Complete</h2>
          <TabsList className="bg-slate-100 rounded-xl">
            <TabsTrigger value="summary" className="rounded-lg">Results</TabsTrigger>
            <TabsTrigger value="review" className="rounded-lg">Review Answers</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="summary">
          <div className="space-y-5">
            <Card className="overflow-hidden border-0 shadow-xl">
              <div className={`bg-gradient-to-br ${gradBg} p-5 sm:p-8 text-white text-center`}>
                <p className="text-lg font-medium opacity-90 mb-1">{verdict}</p>
                <div className="text-7xl font-black my-3">{pct}%</div>
                <p className="text-white/80">{score} correct out of {examData.questions.length}</p>
              </div>
              <CardContent className="py-5">
                <div className={`grid gap-4 ${tabViolations ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                  {[
                    { label: 'Score',    value: `${score}/${examData.questions.length}`, icon: Target,    color: 'text-indigo-600' },
                    { label: 'Accuracy', value: `${pct}%`,                               icon: TrendingUp, color: pct >= 60 ? 'text-green-600' : 'text-red-500' },
                    { label: 'Time',     value: fmt(timeTaken),                           icon: Timer,      color: 'text-slate-600' },
                  ].map(s => (
                    <div key={s.label} className="flex flex-col items-center gap-1 p-3 bg-slate-50 rounded-xl">
                      <s.icon className={`h-5 w-5 ${s.color}`} />
                      <span className={`text-xl font-bold ${s.color}`}>{s.value}</span>
                      <span className="text-xs text-slate-500">{s.label}</span>
                    </div>
                  ))}
                  {!!tabViolations && (
                    <div className="flex flex-col items-center gap-1 p-3 bg-red-50 rounded-xl border border-red-200">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      <span className="text-xl font-bold text-red-600">{tabViolations}</span>
                      <span className="text-xs text-red-500 text-center">Tab Violations</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700">Question Breakdown — click any to review</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
                  {examData.questions.map((q, i) => {
                    const ok = answers[i] === q.correctIndex, skip = answers[i] === -1;
                    return (
                      <button key={i} onClick={() => { setView('review'); setExpanded(i); }}
                        className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold hover:scale-110 transition-transform
                          ${skip ? 'bg-slate-200 text-slate-500' : ok ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-700 border border-red-300'}`}>
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3 justify-center flex-wrap">
              {onRestart && (
                <Button onClick={onRestart} variant="outline" className="rounded-xl px-6">
                  <RotateCcw className="h-4 w-4 mr-2" />New Exam
                </Button>
              )}
              <Button onClick={() => setView('review')} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6">
                <BookOpen className="h-4 w-4 mr-2" />Review with Explanations
              </Button>
              <Button onClick={() => router.push('/dashboard')} variant="outline" className="rounded-xl px-6">
                <ArrowLeft className="h-4 w-4 mr-2" />Back to Dashboard
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="review">
          <div className="space-y-3">
            {examData.questions.map((q, i) => {
              const ua = answers[i], ok = ua === q.correctIndex, skip = ua === -1, open = expanded === i;
              return (
                <Card key={i} className={`border-2 shadow-sm ${skip ? 'border-slate-200' : ok ? 'border-green-200' : 'border-red-200'}`}>
                  <button className="w-full text-left" onClick={() => setExpanded(open ? null : i)}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center
                          ${skip ? 'bg-slate-200' : ok ? 'bg-green-100' : 'bg-red-100'}`}>
                          {skip ? <AlertTriangle className="h-4 w-4 text-slate-500" /> : ok ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-bold text-slate-400">Q{i + 1}</span>
                            <Badge variant="outline" className="text-xs font-normal text-slate-500">{q.topic}</Badge>
                            <span className={`text-xs font-semibold ${skip ? 'text-slate-500' : ok ? 'text-green-600' : 'text-red-600'}`}>
                              {skip ? 'Skipped' : ok ? 'Correct' : 'Incorrect'}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-slate-800 leading-snug"><QuestionText text={q.question} /></p>
                        </div>
                        <ChevronRight className={`h-4 w-4 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
                      </div>
                    </CardHeader>
                  </button>
                  {open && (
                    <CardContent className="pt-0 space-y-4 border-t border-slate-100">
                      <div className="space-y-2 mt-3">
                        {q.options.map((opt: string, oi: number) => {
                          const isUser = ua === oi, isCorrect = q.correctIndex === oi;
                          return (
                            <div key={oi} className={`flex items-start gap-3 p-3 rounded-xl border
                              ${isCorrect ? 'bg-green-50 border-green-300' : isUser && !isCorrect ? 'bg-red-50 border-red-300' : 'bg-slate-50 border-slate-200'}`}>
                              <span className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold
                                ${isCorrect ? 'bg-green-600 text-white' : isUser ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                {letters[oi]}
                              </span>
                              <span className={`text-sm ${isCorrect ? 'text-green-800 font-medium' : isUser ? 'text-red-800' : 'text-slate-600'}`}>{opt}</span>
                              {isCorrect && <CheckCircle2 className="h-4 w-4 text-green-600 ml-auto flex-shrink-0 mt-0.5" />}
                              {isUser && !isCorrect && <XCircle className="h-4 w-4 text-red-500 ml-auto flex-shrink-0 mt-0.5" />}
                            </div>
                          );
                        })}
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                        <Lightbulb className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">Explanation</p>
                          <p className="text-sm text-amber-900 leading-relaxed">{q.explanation}</p>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
            <div className="flex justify-center gap-3 pt-2 flex-wrap">
              {onRestart && (
                <Button onClick={onRestart} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-8">
                  <RotateCcw className="h-4 w-4 mr-2" />Start New Exam
                </Button>
              )}
              <Button onClick={() => router.push('/dashboard')} variant="outline" className="rounded-xl px-6">
                <ArrowLeft className="h-4 w-4 mr-2" />Back to Dashboard
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ExamPage() {
  const { toast } = useToast();

  const signalExamActive = (active: boolean) => {
    window.dispatchEvent(new CustomEvent('examActiveChange', { detail: active }));
  };

  const [phase, setPhase] = useState<Phase>('setup');
  const [examData, setExamData] = useState<ExamData | null>(null);
  const [config, setConfig]     = useState<{ course: Course; subject: Subject; count: number } | null>(null);
  const [scheduledExam, setScheduledExam] = useState<any | null>(null); // active scheduled test
  const [answers, setAnswers]       = useState<number[]>([]);
  const [score, setScore]           = useState(0);
  const [timeTaken, setTimeTaken]   = useState(0);
  const [tabViolations, setTabViolations] = useState(0);

  const handleStart = async (course: Course, subject: Subject, count: number) => {
    if (!subject.syllabus?.trim()) {
      toast({ title: 'No syllabus found', description: 'This subject has no syllabus content. Ask your teacher to add one.', variant: 'destructive' });
      return;
    }
    setConfig({ course, subject, count });
    setScheduledExam(null);
    setPhase('generating');
    try {
      const data = await generateExamFlow({
        courseName: course.name, subjectName: subject.name,
        syllabus: subject.syllabus, difficulty: 'medium', count,
      });
      setExamData(data);
      setPhase('exam');
      signalExamActive(true);
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || '';
      const description = msg.includes('429') ? 'AI rate limit reached. Please wait a minute and try again.'
        : msg.includes('syllabus') ? 'Syllabus content is missing or too short.'
        : msg || 'Please try again.';
      toast({ title: 'Failed to generate exam', description, variant: 'destructive' });
      setPhase('setup');
    }
  };

  // Convert a scheduled Exam document into the GenerateExamOutput shape
  const handleStartScheduled = (exam: any) => {
    setScheduledExam(exam);
    setConfig(null);
    const questions = (exam.questions || []).map((q: any) => {
      const correctIndex = q.options?.findIndex((o: any) => o.isCorrect) ?? 0;
      return {
        question:     q.questionText,
        options:      q.options?.map((o: any) => o.text) || [],
        correctIndex,
        explanation:  q.explanation || '',
        topic:        q.topic       || '',
        section:      q.section     || '',
      };
    });
    setExamData({ title: exam.title, questions });
    setPhase('exam');
    signalExamActive(true);
  };

  const handleComplete = async (userAnswers: number[], time: number, tabViol: number) => {
    if (!examData) return;
    const correct = examData.questions.reduce((acc, q, i) => acc + (q.correctIndex === userAnswers[i] ? 1 : 0), 0);
    const pct = Math.round((correct / examData.questions.length) * 100);
    // Defer parent state updates to avoid "setState during render" error when
    // submit is triggered by a browser event (blur/visibilitychange) mid-render
    setTimeout(() => {
      setAnswers(userAnswers); setScore(correct); setTimeTaken(time); setTabViolations(tabViol); setPhase('results');
    }, 0);
    signalExamActive(false);
    try {
      const user = getCurrentUser();
      if (user) {
        const userId = user._id || user.id;
        await fetch('/api/exam-results', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId, userName: user.name,
            courseId:    config?.course._id    || scheduledExam?._id  || '',
            courseName:  config?.course.name   || scheduledExam?.title || 'Scheduled Test',
            subjectName: config?.subject.name  || scheduledExam?.subject || '',
            score: correct, total: examData.questions.length, percentage: pct,
            timeTaken: time, answers: userAnswers,
            correctAnswers: examData.questions.map(q => q.correctIndex),
            questions: examData.questions, date: new Date().toISOString(),
            isScheduledExam: !!scheduledExam,
            tabViolations: tabViol,
          }),
        });
      }
    } catch (e) { console.error('Save failed:', e); }
  };

  const handleRestart = () => {
    signalExamActive(false);
    setPhase('setup'); setExamData(null); setConfig(null); setScheduledExam(null);
  };

  if (phase === 'generating') return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center">
          <Brain className="h-10 w-10 text-indigo-600" />
        </div>
        <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-xl font-semibold text-slate-800">Generating Your Exam…</p>
        <p className="text-slate-500 text-sm">AI is crafting questions for {config?.subject.name}</p>
      </div>
    </div>
  );

  if (phase === 'exam' && examData) {
    const totalSeconds = scheduledExam
      ? scheduledExam.durationMins * 60
      : (config?.count ?? 10) * SECONDS_PER_QUESTION;
    return <ExamScreen examData={examData} totalSeconds={totalSeconds} onComplete={handleComplete} />;
  }

  if (phase === 'results' && examData)
    return <ResultsScreen examData={examData} answers={answers} score={score} timeTaken={timeTaken} tabViolations={tabViolations} onRestart={handleRestart} />;

  return <SetupScreen onStart={handleStart} onStartScheduled={handleStartScheduled} />;
}