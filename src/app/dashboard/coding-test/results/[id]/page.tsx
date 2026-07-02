'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Code2, Loader2, RefreshCw, ArrowLeft, Trophy,
} from 'lucide-react';

interface CodingTest {
  _id: string; title: string; problems: { problemId: string; title: string; marks: number }[];
}
interface Submission {
  _id: string; studentName: string; rollNumber: string; program: string; year: number; section: string;
  totalMarks: number; obtainedMarks: number; submittedAt: string;
  answers: { problemId: string; passedCount: number; totalCount: number; marksAwarded: number }[];
}

function fmtDt(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

export default function CodingTestResultsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [test, setTest] = useState<CodingTest | null>(null);
  const [results, setResults] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [tRes, rRes] = await Promise.all([
      fetch(`/api/coding-tests/${id}`),
      fetch(`/api/coding-tests/${id}/results`),
    ]);
    setTest(await tRes.json());
    const rData = await rRes.json();
    setResults(Array.isArray(rData) ? rData : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  return (
    <div className="space-y-6 pb-12">
      <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/coding-test/results')} className="gap-1.5 rounded-xl">
        <ArrowLeft className="h-3.5 w-3.5" /> All Coding Tests
      </Button>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg">
            <Code2 className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{test?.title || 'Coding Test'}</h1>
            <p className="text-slate-500 text-sm">{results.length} submission(s)</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5 rounded-xl">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
      ) : results.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center gap-2">
            <Trophy className="h-12 w-12 text-slate-300" />
            <p className="text-sm text-slate-400">No students have submitted this test yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {results.map(r => (
            <Card key={r._id} className="border-slate-200 shadow-sm">
              <CardContent className="pt-4 pb-4 flex items-start gap-4 flex-wrap">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-base flex-shrink-0">
                  {r.studentName?.[0] || 'S'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900">{r.studentName}</p>
                    <span className="text-xs text-slate-400">{r.rollNumber}</span>
                    <Badge variant="outline" className="text-[10px]">{r.program} Y{r.year}{r.section ? ` §${r.section}` : ''}</Badge>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      {r.obtainedMarks}/{r.totalMarks} marks
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500 mt-1">
                    {r.answers.map(a => {
                      const p = test?.problems.find(x => x.problemId === a.problemId);
                      return (
                        <span key={a.problemId} className="px-2 py-0.5 rounded-full bg-slate-100">
                          {p?.title || a.problemId}: {a.marksAwarded}/{p?.marks ?? 0} ({a.passedCount}/{a.totalCount} tests)
                        </span>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Submitted {fmtDt(r.submittedAt)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
