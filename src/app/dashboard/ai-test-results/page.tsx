'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, BarChart2, Search, RefreshCw,
  Calendar, Clock, Users, FileText, Target,
  Download, Trophy, TrendingUp, CheckCircle2, XCircle,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import * as XLSX from 'xlsx';

const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#14b8a6', '#f97316'];
const PASS_COLOR = '#10b981';
const FAIL_COLOR = '#f43f5e';

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
  passingMarks?: number;
}

interface Result {
  _id: string;
  userId: string;
  userName: string;
  rollNumber?: string;
  score: number;
  total: number;
  percentage: number;
  timeTaken?: number;
  date: string;
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

// ── Donut Chart ────────────────────────────────────────────────────────────────
function DonutChart({ pass, fail, total }: { pass: number; fail: number; total: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const data = [
    { name: 'Pass', value: pass },
    { name: 'Fail', value: fail },
  ];
  if (!mounted) return <div className="h-40 flex items-center justify-center text-xs text-slate-300">Loading…</div>;
  return (
    <div className="relative h-40">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={62}
            dataKey="value" startAngle={90} endAngle={-270} paddingAngle={2}>
            <Cell fill={PASS_COLOR} />
            <Cell fill={FAIL_COLOR} />
          </Pie>
          <Tooltip formatter={(v: any, n: any) => [`${v} students`, n]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <p className="text-2xl font-black text-slate-900">{total}</p>
        <p className="text-[10px] text-slate-500">Students</p>
      </div>
    </div>
  );
}

// ── Score Distribution Pie ─────────────────────────────────────────────────────
function ScorePie({ buckets }: { buckets: { name: string; value: number }[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <div className="h-40 flex items-center justify-center text-xs text-slate-300">Loading…</div>;
  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie data={buckets} cx="50%" cy="50%" outerRadius={62}
          dataKey="value" paddingAngle={2}>
          {buckets.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip formatter={(v: any, n: any) => [`${v} students`, n]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
        <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Excel download ─────────────────────────────────────────────────────────────
function downloadExcel(exam: Exam, results: Result[]) {
  const rows = results.map(r => ({
    'Student Name':   r.userName,
    'Roll Number':    r.rollNumber || '—',
    'Score':          `${r.score}/${r.total}`,
    'Percentage':     `${r.percentage}%`,
    'Status':         r.percentage >= (exam.passingMarks ?? 50) ? 'Pass' : 'Fail',
    'Time Taken (s)': r.timeTaken ?? '—',
    'Date':           formatDate(r.date || r.createdAt),
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Results');
  XLSX.writeFile(wb, `${exam.title.replace(/\s+/g, '_')}_results.xlsx`);
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function TechnicalTestResultsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [exams, setExams]     = useState<Exam[]>([]);
  const [results, setResults] = useState<Record<string, Result[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [tab, setTab]         = useState<'list' | 'performance'>('list');
  const [drill, setDrill]     = useState<{ exam: Exam; results: Result[] } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/exams/ai-schedule?all=1');
      const data = await res.json();
      const list: Exam[] = Array.isArray(data) ? data : [];
      setExams(list);

      const resultMap: Record<string, Result[]> = {};
      await Promise.all(list.map(async (e) => {
        const r = await fetch(`/api/exam-results?courseId=${e._id}`);
        const rs = await r.json();
        resultMap[e._id] = Array.isArray(rs) ? rs : [];
      }));
      setResults(resultMap);
    } catch (e) {
      toast({ title: 'Failed to load', variant: 'destructive' });
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

  const totalSubmissions = Object.values(results).reduce((s, r) => s + r.length, 0);
  const passing = (exam: Exam, rs: Result[]) => rs.filter(r => r.percentage >= (exam.passingMarks ?? 50)).length;

  // Performance tab: aggregate stats
  const allResults = exams.flatMap(e => (results[e._id] || []).map(r => ({ ...r, examTitle: e.title, passingMark: e.passingMarks ?? 50 })));
  const overallPass = allResults.filter(r => r.percentage >= r.passingMark).length;
  const overallFail = allResults.length - overallPass;

  const scoreBuckets = [
    { name: '0-40%',   value: allResults.filter(r => r.percentage < 40).length },
    { name: '40-60%',  value: allResults.filter(r => r.percentage >= 40 && r.percentage < 60).length },
    { name: '60-80%',  value: allResults.filter(r => r.percentage >= 60 && r.percentage < 80).length },
    { name: '80-100%', value: allResults.filter(r => r.percentage >= 80).length },
  ].filter(b => b.value > 0);

  const avgPct = allResults.length
    ? Math.round(allResults.reduce((s, r) => s + r.percentage, 0) / allResults.length)
    : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg">
            <BarChart2 className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Technical Test Results</h1>
            <p className="text-slate-500 text-sm">All scheduled technical exams and student performance</p>
          </div>
        </div>
        <Button variant="outline" onClick={load} className="rounded-xl gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Exams',      value: exams.length,      icon: FileText,     color: 'text-violet-600 bg-violet-50' },
          { label: 'Total Submissions',value: totalSubmissions,   icon: Users,        color: 'text-indigo-600 bg-indigo-50' },
          { label: 'Overall Avg Score',value: `${avgPct}%`,       icon: TrendingUp,   color: 'text-blue-600 bg-blue-50'    },
          { label: 'Pass Rate',        value: allResults.length ? `${Math.round(overallPass / allResults.length * 100)}%` : '—', icon: Trophy, color: 'text-green-600 bg-green-50' },
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

      <Tabs value={tab} onValueChange={v => setTab(v as any)}>
        <TabsList className="bg-slate-100 rounded-xl">
          <TabsTrigger value="list" className="rounded-lg">📋 Exam List</TabsTrigger>
          <TabsTrigger value="performance" className="rounded-lg">📊 Performance</TabsTrigger>
        </TabsList>

        {/* ── Exam List Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="list" className="mt-4 space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="Search by title or subject…" className="pl-9 h-9 rounded-xl text-sm"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-violet-500" /></div>
          ) : filtered.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200 shadow-none">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <BarChart2 className="h-12 w-12 text-slate-300" />
                <p className="font-semibold text-slate-600">No technical tests found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map(exam => {
                const rs = results[exam._id] || [];
                const passCount = passing(exam, rs);
                const failCount = rs.length - passCount;
                return (
                  <Card key={exam._id} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-5 pb-5">
                      <div className="flex items-start gap-4 flex-wrap">
                        {/* Info */}
                        <div className="flex-1 space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-slate-900 truncate">{exam.title}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${statusColor(exam.status)}`}>
                              {exam.status}
                            </span>
                          </div>
                          {exam.subject && <p className="text-sm text-slate-500">{exam.subject}</p>}
                          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                            {exam.examDate && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(exam.examDate)}</span>}
                            <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{exam.totalQuestions} questions</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{exam.durationMins} min</span>
                            <span className="flex items-center gap-1 font-medium text-indigo-600"><Users className="h-3 w-3" />{rs.length} submitted</span>
                          </div>
                          {rs.length > 0 && (
                            <div className="flex gap-3 text-xs mt-1">
                              <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3 w-3" />{passCount} pass</span>
                              <span className="flex items-center gap-1 text-red-500"><XCircle className="h-3 w-3" />{failCount} fail</span>
                            </div>
                          )}
                        </div>

                        {/* Mini donut */}
                        {rs.length > 0 && (
                          <div className="w-36 cursor-pointer" onClick={() => setDrill({ exam, results: rs })} title="Click for detailed report">
                            <DonutChart pass={passCount} fail={failCount} total={rs.length} />
                            <p className="text-[10px] text-center text-indigo-500 mt-1">Click chart for details</p>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-col gap-2">
                          <Button size="sm" onClick={() => router.push(`/dashboard/teacher/schedule-exam/results/${exam._id}`)}
                            className="rounded-xl gap-2 bg-violet-600 hover:bg-violet-700 text-white">
                            <BarChart2 className="h-4 w-4" /> View Results
                          </Button>
                          {rs.length > 0 && (
                            <Button size="sm" variant="outline" onClick={() => downloadExcel(exam, rs)}
                              className="rounded-xl gap-2">
                              <Download className="h-4 w-4" /> Export Excel
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Performance Tab ───────────────────────────────────────────────── */}
        <TabsContent value="performance" className="mt-4 space-y-6">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-violet-500" /></div>
          ) : allResults.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200 shadow-none">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <TrendingUp className="h-12 w-12 text-slate-300" />
                <p className="text-sm text-slate-400">No results yet to display charts.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Overall pass/fail donut */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-700">Overall Pass / Fail</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DonutChart pass={overallPass} fail={overallFail} total={allResults.length} />
                    <div className="flex justify-center gap-6 mt-2 text-xs">
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />Pass ({overallPass})</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" />Fail ({overallFail})</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-700">Score Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScorePie buckets={scoreBuckets} />
                  </CardContent>
                </Card>
              </div>

              {/* Per-exam breakdown */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-slate-700">Per-Exam Breakdown</CardTitle>
                  <p className="text-xs text-indigo-500">Click a chart to see detailed student report</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {exams.filter(e => (results[e._id] || []).length > 0).map(exam => {
                      const rs = results[exam._id] || [];
                      const passCount = passing(exam, rs);
                      const failCount = rs.length - passCount;
                      return (
                        <div key={exam._id}
                          className="p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer"
                          onClick={() => setDrill({ exam, results: rs })}>
                          <p className="text-xs font-semibold text-slate-700 truncate mb-1">{exam.title}</p>
                          <p className="text-[10px] text-slate-400 mb-2">{rs.length} submissions</p>
                          <DonutChart pass={passCount} fail={failCount} total={rs.length} />
                          <div className="flex justify-center gap-4 mt-2 text-[10px]">
                            <span className="text-emerald-600 font-semibold">{passCount} pass</span>
                            <span className="text-red-500 font-semibold">{failCount} fail</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Drill-down Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={!!drill} onOpenChange={open => { if (!open) setDrill(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{drill?.exam.title} — Detailed Report</DialogTitle>
            <DialogDescription>{drill?.results.length} student submissions</DialogDescription>
          </DialogHeader>
          {drill && (
            <div className="space-y-4">
              <Button size="sm" variant="outline" onClick={() => downloadExcel(drill.exam, drill.results)}
                className="rounded-xl gap-2">
                <Download className="h-4 w-4" /> Download Excel
              </Button>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold">#</th>
                      <th className="text-left px-4 py-3 font-semibold">Student</th>
                      <th className="text-left px-4 py-3 font-semibold">Roll No.</th>
                      <th className="text-right px-4 py-3 font-semibold">Score</th>
                      <th className="text-right px-4 py-3 font-semibold">%</th>
                      <th className="text-center px-4 py-3 font-semibold">Status</th>
                      <th className="text-right px-4 py-3 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...drill.results]
                      .sort((a, b) => b.percentage - a.percentage)
                      .map((r, i) => {
                        const pass = r.percentage >= (drill.exam.passingMarks ?? 50);
                        return (
                          <tr key={r._id} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 text-slate-400 text-xs">{i + 1}</td>
                            <td className="px-4 py-2.5 font-medium text-slate-900">{r.userName}</td>
                            <td className="px-4 py-2.5 text-slate-500 text-xs">{r.rollNumber || '—'}</td>
                            <td className="px-4 py-2.5 text-right text-slate-700">{r.score}/{r.total}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{r.percentage}%</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${pass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                {pass ? 'Pass' : 'Fail'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs text-slate-400">{formatDate(r.date || r.createdAt)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
