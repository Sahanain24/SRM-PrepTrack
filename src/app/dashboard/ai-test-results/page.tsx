'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2, Sparkles, BarChart2, Search, RefreshCw,
  Calendar, Clock, Users, FileText, Target,
} from 'lucide-react';
interface Exam {
  _id: string;
  title: string;
  subject: string;
  examDate: string;
  startTime: string;
  durationMins: number;
  totalQuestions: number;
  totalMarks: number;
  targetPrograms: string[];
  targetYears: number[];
  status: string;
  createdAt: string;
}

function formatDate(iso: string) {
  if (!iso) return '—';
  try { return new Intl.DateTimeFormat('en-GB').format(new Date(iso)); } catch { return '—'; }
}

function statusColor(s: string) {
  if (s === 'published') return 'bg-green-100 text-green-700';
  if (s === 'completed') return 'bg-blue-100 text-blue-700';
  if (s === 'archived')  return 'bg-slate-100 text-slate-500';
  return 'bg-amber-100 text-amber-700';
}

export default function AITestResultsPage() {
  const router = useRouter();
  const [exams, setExams]       = useState<Exam[]>([]);
  const [counts, setCounts]     = useState<Record<string, number>>({});
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/exams/ai-schedule?all=1');
      const data = await res.json();
      const list: Exam[] = Array.isArray(data) ? data : [];
      setExams(list);

      // Load submission counts per exam
      const countMap: Record<string, number> = {};
      await Promise.all(list.map(async (e) => {
        const r = await fetch(`/api/exam-results?courseId=${e._id}`);
        const results = await r.json();
        const uniqueStudents = new Set((Array.isArray(results) ? results : []).map((x: any) => x.userId));
        countMap[e._id] = uniqueStudents.size;
      }));
      setCounts(countMap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = exams.filter(e =>
    !search ||
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    (e.subject || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalExams      = exams.length;
  const totalSubmissions = Object.values(counts).reduce((s, c) => s + c, 0);
  const published       = exams.filter(e => e.status === 'published').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg">
            <Sparkles className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">AI Placement Test Results</h1>
            <p className="text-slate-500 text-sm">All AI-scheduled placement exams and student results</p>
          </div>
        </div>
        <Button variant="outline" onClick={load} className="rounded-xl gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Exams',    value: totalExams,       icon: FileText,  color: 'text-violet-600 bg-violet-50' },
          { label: 'Active / Published', value: published,   icon: Target,    color: 'text-green-600 bg-green-50'  },
          { label: 'Total Submissions', value: totalSubmissions, icon: Users, color: 'text-indigo-600 bg-indigo-50' },
        ].map(s => (
          <Card key={s.label} className="border-slate-200 shadow-sm">
            <CardContent className="flex items-center gap-3 pt-5 pb-5">
              <div className={`p-3 rounded-xl ${s.color}`}><s.icon className="h-5 w-5" /></div>
              <div>
                <p className="text-xl font-bold text-slate-900">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by title or subject…"
          className="pl-9 h-9 rounded-xl text-sm"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Exam list */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-violet-500" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <Sparkles className="h-12 w-12 text-slate-300" />
            <p className="font-semibold text-slate-600">No AI placement tests found</p>
            <p className="text-sm text-slate-400">Teachers schedule AI placement tests from their dashboard.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(exam => {
            const submissionCount = counts[exam._id] ?? 0;
            return (
              <Card key={exam._id} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-900 truncate">{exam.title}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${statusColor(exam.status)}`}>
                          {exam.status}
                        </span>
                      </div>
                      {exam.subject && <p className="text-sm text-slate-500">{exam.subject}</p>}
                      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                        {exam.examDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(exam.examDate)}
                          </span>
                        )}
                        {exam.startTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {exam.startTime}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {exam.totalQuestions} questions
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {exam.durationMins} min
                        </span>
                        <span className="flex items-center gap-1 font-medium text-indigo-600">
                          <Users className="h-3 w-3" />
                          {submissionCount} student{submissionCount !== 1 ? 's' : ''} submitted
                        </span>
                      </div>
                      {(exam.targetPrograms?.length > 0 || exam.targetYears?.length > 0) && (
                        <div className="flex flex-wrap gap-1">
                          {exam.targetPrograms?.map((p: string) => (
                            <Badge key={p} variant="outline" className="text-[10px] px-1.5">{p}</Badge>
                          ))}
                          {exam.targetYears?.map((y: number) => (
                            <Badge key={y} variant="outline" className="text-[10px] px-1.5">Year {y}</Badge>
                          ))}
                        </div>
                      )}
                      <p className="text-[10px] text-slate-400">Scheduled {formatDate(exam.createdAt)}</p>
                    </div>
                    <Button
                      onClick={() => router.push(`/dashboard/teacher/schedule-exam/results/${exam._id}`)}
                      className="rounded-xl gap-2 bg-violet-600 hover:bg-violet-700 text-white flex-shrink-0"
                      size="sm"
                    >
                      <BarChart2 className="h-4 w-4" /> View Results
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
