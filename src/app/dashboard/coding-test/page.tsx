'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/mock-db';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Code2, Loader2, RefreshCw, ArrowRight, CheckCircle2, Clock,
} from 'lucide-react';

interface CodingTestSummary {
  _id: string; title: string; description?: string; durationMins: number;
  examDate?: string; startTime?: string; deadlineDate?: string; deadlineTime?: string;
  problems: { problemId: string; marks: number }[];
  teacherName?: string; createdAt: string;
}

function isPastDeadline(t: CodingTestSummary) {
  if (!t.deadlineDate) return false;
  return new Date(`${t.deadlineDate}T${t.deadlineTime || '23:59'}:00`) < new Date();
}

export default function StudentCodingTestsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const user = getCurrentUser() as any;
  const studentId = user?._id || user?.id;

  const [tests, setTests] = useState<CodingTestSummary[]>([]);
  const [done, setDone]   = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      // Use studentId so the server looks up the student's real profile from the DB
      const url = studentId
        ? `/api/coding-tests?studentId=${studentId}`
        : '/api/coding-tests';
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load tests (${res.status})`);
      const data = await res.json();
      const list: CodingTestSummary[] = Array.isArray(data) ? data : [];
      setTests(list);

      // Check submission status for each test
      const statusMap: Record<string, number> = {};
      await Promise.all(list.map(async t => {
        try {
          const r = await fetch(`/api/coding-tests/${t._id}/results?studentId=${studentId}`);
          const subs = await r.json();
          if (Array.isArray(subs) && subs.length > 0) statusMap[t._id] = subs[0].obtainedMarks;
        } catch { /* non-critical */ }
      }));
      setDone(statusMap);
    } catch (e: any) {
      toast({ title: 'Failed to load coding tests', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totalMarks = (t: CodingTestSummary) => t.problems.reduce((s, p) => s + (p.marks || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg">
            <Code2 className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Coding Tests</h1>
            <p className="text-slate-500 text-sm">Solve coding problems and get instant scoring</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5 rounded-xl">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
      ) : tests.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center gap-2">
            <Code2 className="h-12 w-12 text-slate-300" />
            <p className="text-sm text-slate-400">No coding tests available yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tests.map(t => {
            const attempted = t._id in done;
            const locked = !attempted && isPastDeadline(t);
            return (
              <Card key={t._id} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-4 pb-4 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900">{t.title}</p>
                      {attempted && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Submitted · {done[t._id]}/{totalMarks(t)}
                        </span>
                      )}
                      {locked && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          Deadline Passed
                        </span>
                      )}
                    </div>
                    {t.description && <p className="text-sm text-slate-600 mt-0.5">{t.description}</p>}
                    <div className="flex flex-wrap gap-3 text-xs text-slate-400 mt-1">
                      <Badge variant="outline" className="text-[10px]">{t.problems?.length || 0} problem(s)</Badge>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{t.durationMins} min</span>
                      <span>Total Marks: {totalMarks(t)}</span>
                      {t.deadlineDate && <span>Deadline: {t.deadlineDate} {t.deadlineTime || ''}</span>}
                    </div>
                  </div>
                  {locked ? (
                    <Button size="sm" disabled className="gap-1.5 rounded-xl text-xs opacity-50 cursor-not-allowed">
                      🔒 Locked
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => router.push(`/dashboard/coding-test/${t._id}`)}
                      className="gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs">
                      {attempted ? 'View Submission' : 'Attempt Test'} <ArrowRight className="h-3 w-3" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
