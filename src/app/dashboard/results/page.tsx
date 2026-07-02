'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/mock-db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Code2, Loader2, ArrowRight, Clock } from 'lucide-react';

interface ExamResult {
  _id: string; courseName: string; subjectName: string;
  score: number; total: number; percentage: number; timeTaken: number;
  isFirstAttempt: boolean; date: string;
}
interface CodingSubmission {
  _id: string; testId: string; totalMarks: number; obtainedMarks: number; submittedAt: string;
}
interface CodingTest { _id: string; title: string; }

function pctColor(p: number) {
  return p >= 80 ? 'text-green-600' : p >= 60 ? 'text-yellow-600' : 'text-red-500';
}
function fmtDt(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

export default function StudentResultsPage() {
  const router = useRouter();
  const user = getCurrentUser() as any;
  const userId = user?._id || user?.id;

  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [codingSubs, setCodingSubs]   = useState<CodingSubmission[]>([]);
  const [codingTests, setCodingTests] = useState<Record<string, CodingTest>>({});
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const eRes = await fetch(`/api/exam-results?userId=${userId}`);
        const eData = await eRes.json();
        setExamResults(Array.isArray(eData) ? eData : []);

        const params = new URLSearchParams();
        if (user?.program) params.set('program', user.program);
        if (user?.year)    params.set('year', String(user.year));
        if (user?.section) params.set('section', user.section);
        const tRes = await fetch(`/api/coding-tests?${params.toString()}`);
        const tData = await tRes.json();
        const tests: CodingTest[] = Array.isArray(tData) ? tData : [];
        const testMap: Record<string, CodingTest> = {};
        tests.forEach(t => { testMap[t._id] = t; });
        setCodingTests(testMap);

        const subs: CodingSubmission[] = [];
        await Promise.all(tests.map(async t => {
          const r = await fetch(`/api/coding-tests/${t._id}/results?studentId=${userId}`);
          const data = await r.json();
          if (Array.isArray(data) && data.length > 0) subs.push({ ...data[0], testId: t._id });
        }));
        setCodingSubs(subs);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [userId]);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg">
          <Trophy className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Results</h1>
          <p className="text-slate-500 text-sm">Your exam and coding test results in one place</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
      ) : (
        <>
          {/* Exam Arena results */}
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" /> Exam Arena Results</CardTitle>
              <CardDescription>Your results from AI-generated subject exams.</CardDescription>
            </CardHeader>
            <CardContent>
              {examResults.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">You haven't taken any exams yet.</p>
              ) : (
                <div className="space-y-2">
                  {examResults.map(r => (
                    <div key={r._id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{r.subjectName}</p>
                        <p className="text-xs text-slate-500">{r.courseName} · {fmtDt(r.date)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.isFirstAttempt && <Badge variant="outline" className="text-[10px]">1st attempt</Badge>}
                        <Badge className={`text-xs font-bold bg-white border ${pctColor(r.percentage)}`}>
                          {r.score}/{r.total} ({r.percentage}%)
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Coding Test results */}
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Code2 className="h-5 w-5" /> Coding Test Results</CardTitle>
              <CardDescription>Your scores from coding tests scheduled by your teachers.</CardDescription>
            </CardHeader>
            <CardContent>
              {codingSubs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">You haven't submitted any coding tests yet.</p>
              ) : (
                <div className="space-y-2">
                  {codingSubs.map(s => (
                    <div key={s._id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{codingTests[s.testId]?.title || 'Coding Test'}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1"><Clock className="h-3 w-3" /> Submitted {fmtDt(s.submittedAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="text-xs font-bold bg-emerald-100 text-emerald-700">
                          {s.obtainedMarks}/{s.totalMarks} marks
                        </Badge>
                        <Button size="sm" variant="outline" className="gap-1 rounded-xl text-xs"
                          onClick={() => router.push(`/dashboard/coding-test/${s.testId}`)}>
                          View <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
