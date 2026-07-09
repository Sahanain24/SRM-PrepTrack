'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { getCurrentUser } from '@/lib/mock-db';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import {
  Users, Trophy, Brain, Code2, BarChart2, Target,
  Download, RefreshCw, AlertTriangle, TrendingUp, GraduationCap, X,
} from 'lucide-react';
import {
  RadialBarChart, RadialBar, ResponsiveContainer, Tooltip,
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
  Legend,
} from 'recharts';
import { AITestComparison } from '@/components/dashboard/AITestComparison';

const PALETTE = ['#6366f1','#f59e0b','#10b981','#f43f5e','#14b8a6','#f97316','#06b6d4','#84cc16'];

function pctColor(p: number) {
  return p >= 70 ? '#10b981' : p >= 50 ? '#f59e0b' : '#ef4444';
}

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="pt-4 pb-4 flex flex-col items-center text-center gap-2">
        <div className={`p-2.5 rounded-2xl ${color}`}><Icon className="h-5 w-5" /></div>
        <p className="text-2xl font-black text-slate-900 leading-none">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </CardContent>
    </Card>
  );
}

interface DrillData {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
}

function DrillModal({ data, onClose }: { data: DrillData; onClose: () => void }) {
  const downloadXlsx = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([data.columns, ...data.rows]);
    ws['!cols'] = data.columns.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${data.title.replace(/[^a-zA-Z0-9 ]/g, '').trim()}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">{data.title}</h2>
            {data.subtitle && <p className="text-xs text-slate-500 mt-0.5">{data.subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-auto flex-1 p-5">
          {data.rows.length === 0
            ? <p className="text-slate-400 text-sm text-center py-8">No detailed records available.</p>
            : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    {data.columns.map(c => (
                      <th key={c} className="text-left py-2 px-3 font-semibold text-slate-500">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, i) => (
                    <tr key={i} className={`border-b border-slate-50 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                      {row.map((cell, j) => (
                        <td key={j} className="py-2 px-3 text-slate-700">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
        <div className="px-5 py-3 border-t border-slate-100 flex justify-between items-center">
          <span className="text-xs text-slate-400">{data.rows.length} record{data.rows.length !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2">
            {data.rows.length > 0 && (
              <Button size="sm" onClick={downloadXlsx}
                className="bg-green-600 hover:bg-green-700 text-white rounded-xl flex items-center gap-1.5">
                <Download className="h-3.5 w-3.5" /> Download Report
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onClose} className="rounded-xl">Close</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DonutChart({ data, total, label, onSliceClick, colors }: {
  data: { name: string; value: number }[];
  total: number;
  label: string;
  onSliceClick?: (entry: { name: string; value: number }) => void;
  colors?: string[];
}) {
  const palette = colors ?? PALETTE;
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <div className="relative h-48 flex items-center justify-center text-slate-300 text-xs">Loading chart…</div>;
  return (
    <div className="relative h-48">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={58} outerRadius={80}
            dataKey="value" startAngle={90} endAngle={-270} paddingAngle={2}
            onClick={onSliceClick ? (entry) => onSliceClick(entry) : undefined}
            style={onSliceClick ? { cursor: 'pointer' } : undefined}>
            {data.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
          </Pie>
          <Tooltip formatter={(v: any) => [`${v}`, '']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <p className="text-2xl font-black text-slate-900">{total}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export default function DeanDashboard() {
  const router = useRouter();
  const [chartsMounted, setChartsMounted] = useState(false);
  useEffect(() => { setChartsMounted(true); }, []);
  const [summary, setSummary]         = useState<any>(null);
  const [heatmap, setHeatmap]         = useState<any[]>([]);
  const [aspirations, setAspirations] = useState<any[]>([]);
  const [training, setTraining]       = useState<any[]>([]);
  const [perf, setPerf]               = useState<any>(null);
  const [codingTests, setCodingTests] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [examResults, setExamResults] = useState<any[]>([]);
  const [codingSubmissions, setCodingSubmissions] = useState<any[]>([]);
  const [students, setStudents]       = useState<any[]>([]);
  const [drill, setDrill]             = useState<DrillData | null>(null);

  const openDrill = useCallback((data: DrillData) => setDrill(data), []);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) { router.push('/auth'); return; }
    const allowed = ['dean','deputy_dean','pro_vc','hod','admin'];
    if (!allowed.includes((user as any).role)) { router.push('/dashboard'); return; }
    loadAll();
  }, [router]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, h, a, t, p, ct, exam, stud] = await Promise.all([
        fetch('/api/analytics?type=summary').then(r => r.json()),
        fetch('/api/analytics?type=skill-heatmap').then(r => r.json()),
        fetch('/api/analytics?type=career-aspirations').then(r => r.json()),
        fetch('/api/analytics?type=training-demand').then(r => r.json()),
        fetch('/api/analytics/performance').then(r => r.json()),
        fetch('/api/coding-tests').then(r => r.json()),
        fetch('/api/exam-results').then(r => r.json()),
        fetch('/api/users?role=student').then(r => r.json()),
      ]);
      setSummary(s);
      setHeatmap(Array.isArray(h) ? h : []);
      setAspirations(Array.isArray(a) ? a : []);
      setTraining(Array.isArray(t) ? t : []);
      setPerf(p);
      const tests = Array.isArray(ct) ? ct : [];
      setCodingTests(tests);
      setExamResults(Array.isArray(exam) ? exam : []);
      setStudents(Array.isArray(stud) ? stud : []);
      const allSubs = (await Promise.all(
        tests.map((test: any) =>
          fetch(`/api/coding-tests/${test._id}/results`).then(r => r.json()).then(
            (subs: any[]) => (Array.isArray(subs) ? subs.map(s => ({ ...s, testTitle: test.title })) : [])
          ).catch(() => [])
        )
      )).flat();
      setCodingSubmissions(allSubs);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const downloadReport = async () => {
    const wb = XLSX.utils.book_new();
    let examRes: any[] = [];
    try { const r = await fetch('/api/exam-results'); examRes = await r.json(); } catch {}
    const sumRows = [
      ['SRM Academic Excellence Platform — Strategic Report'],
      [`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`], [],
      ['Metric', 'Value'],
      ['Total Students',               summary?.totalStudents            ?? 0],
      ['Self-Assessments Done',        summary?.totalAssessed            ?? 0],
      ['Completion Rate (%)',          summary?.completionRate            ?? 0],
      ['AI Test Avg — All Attempts (%)', perf?.overview?.examAvgAll       ?? 0],
      ['AI Test Avg — First Attempt (%)', perf?.overview?.examAvgFirstAttempt ?? 0],
      ['Total AI Test Attempts',       perf?.overview?.examTotalAttempts  ?? 0],
      ['Students Attempted AI Tests',  perf?.overview?.studentsAttempted  ?? 0],
      ['Coding Test Avg (%)',          perf?.overview?.codingAvg          ?? 0],
      ['Coding Test Submissions',      perf?.overview?.codingTotalSubmissions ?? 0],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sumRows), 'Summary');
    if (examRes.length > 0) {
      const erRows = [['Student Name', 'Exam Title', 'Subject', 'Score', 'Total', 'Percentage (%)', 'Time (sec)', 'First Attempt', 'Date']];
      examRes.forEach((r: any) => erRows.push([r.userName, r.courseName, r.subjectName || '—', r.score, r.total, Math.round(r.percentage || 0), r.timeTaken || 0, r.isFirstAttempt ? 'Yes' : 'No', r.date ? format(new Date(r.date), 'dd/MM/yyyy') : '—']));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(erRows), 'Technical Test Results');
    }
    XLSX.writeFile(wb, `SRM_Strategic_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent" />
    </div>
  );

  // ── Derived chart data ──
  const attemptChartData = (perf?.attemptComparison || []).map((a: any) => ({
    name: `Attempt ${a.attempt}`,
    avg: a.avgPercentage,
    records: a.count,
  }));

  const programChartData = (perf?.byProgram || []).map((p: any) => ({
    name: p.program,
    exam: p.examAvg,
    coding: (p.codingCorrect ?? 0) === 0 ? 0 : p.codingAvg,
    students: p.students,
  }));

  const batchChartData = (perf?.byBatch || []).map((b: any) => ({
    name: b.batch || '—',
    exam: b.examAvg,
    coding: (b.codingCorrect ?? 0) === 0 ? 0 : b.codingAvg,
  }));

  const aspirationData = aspirations.map((a: any) => ({
    name: a._id,
    value: a.count,
  }));

  const trainingData = training.slice(0, 7).map((t: any) => ({
    name: t._id,
    value: t.count,
  }));

  // Skill radar data — flatten heatmap by skill across all programs
  const SKILL_KEYS = [
    { key: 'communication',        label: 'Comm.' },
    { key: 'problemSolving',        label: 'Problem' },
    { key: 'technical',             label: 'Technical' },
    { key: 'teamwork',              label: 'Teamwork' },
    { key: 'timeManagement',        label: 'Time Mgmt' },
    { key: 'leadership',            label: 'Leadership' },
    { key: 'criticalThinking',      label: 'Critical' },
    { key: 'emotionalIntelligence', label: 'Emotional' },
    { key: 'industryReadiness',     label: 'Industry' },
  ];

  const skillAvgData = SKILL_KEYS.map(sk => {
    const vals = heatmap.map(row => row[sk.key]).filter(Boolean);
    const avg = vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : 0;
    return { skill: sk.label, avg: +avg.toFixed(1), pct: Math.round((avg / 5) * 100) };
  });

  // Skill gap: compute exam gaps
  const rollByName = new Map(students.map((s: any) => [s.name, s.rollNumber || '']));
  const examGapMap = new Map<string, { sum: number; count: number; weak: number }>();
  examResults.forEach((r: any) => {
    const subj = r.subjectName || r.courseName || 'Unknown';
    const e = examGapMap.get(subj) ?? { sum: 0, count: 0, weak: 0 };
    e.sum += r.percentage || 0; e.count += 1;
    if ((r.percentage || 0) < 60) e.weak += 1;
    examGapMap.set(subj, e);
  });
  const examGapData = Array.from(examGapMap.entries())
    .map(([subj, d]) => ({ name: subj, avg: Math.round(d.sum / d.count), weak: d.weak }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 8);

  const codingGapMap = new Map<string, { sum: number; count: number; weak: number }>();
  codingSubmissions.forEach((r: any) => {
    if (!r.testTitle) return;
    const pct = r.totalMarks > 0 ? Math.round((r.obtainedMarks / r.totalMarks) * 100) : 0;
    const e = codingGapMap.get(r.testTitle) ?? { sum: 0, count: 0, weak: 0 };
    e.sum += pct; e.count += 1;
    if (pct < 60) e.weak += 1;
    codingGapMap.set(r.testTitle, e);
  });
  const codingGapData = Array.from(codingGapMap.entries())
    .map(([title, d]) => ({ name: title, avg: Math.round(d.sum / d.count), weak: d.weak }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 8);

  // Completion donut
  const completionDonut = summary ? [
    { name: 'Assessed', value: summary.totalAssessed ?? 0 },
    { name: 'Pending',  value: Math.max(0, (summary.totalStudents ?? 0) - (summary.totalAssessed ?? 0)) },
  ] : [];

  // Lookup helpers for drill-down
  const studentByName  = new Map(students.map((s: any) => [s.name, s]));
  const studentByBatch = (batch: string) => students.filter((s: any) => s.batch === batch || s.batchName === batch);
  const examsBySubject = (subj: string) => examResults.filter((r: any) => (r.subjectName || r.courseName || 'Unknown') === subj);
  const codingByTest   = (title: string) => codingSubmissions.filter((r: any) => r.testTitle === title);

  // Columns + row builder helpers
  const classLabel = (s: any) => {
    const prog = s.program || '';
    const year = s.year    || s.class || '';
    if (prog && year) return `${prog} - Year ${year}`;
    if (prog)         return prog;
    if (year)         return `Year ${year}`;
    return '—';
  };

  const STUDENT_COLS = ['#', 'Name', 'Roll No', 'Class', 'Section'];
  const studentRow = (s: any, idx: number) => [
    idx + 1,
    s.name       || '—',
    s.rollNumber || '—',
    classLabel(s),
    s.section    || '—',
  ];

  const EXAM_COLS   = ['#', 'Name', 'Roll No', 'Class', 'Section', 'Subject', 'Marks', 'Total', '%', 'Date'];
  const examRow = (r: any, idx: number) => {
    const stu = studentByName.get(r.userName) || {};
    return [
      idx + 1,
      r.userName         || '—',
      (stu as any).rollNumber || r.rollNumber || '—',
      classLabel(stu),
      (stu as any).section || '—',
      r.subjectName || r.courseName || '—',
      r.score ?? '—',
      r.total ?? '—',
      `${Math.round(r.percentage || 0)}%`,
      r.date ? format(new Date(r.date), 'dd/MM/yyyy') : '—',
    ];
  };

  const CODING_COLS = ['#', 'Name', 'Roll No', 'Class', 'Section', 'Test', 'Marks', 'Total', '%'];
  const codingRow = (r: any, idx: number) => {
    const stu = studentByName.get(r.studentName) || {};
    const pct = r.totalMarks > 0 ? Math.round((r.obtainedMarks / r.totalMarks) * 100) : 0;
    return [
      idx + 1,
      r.studentName        || '—',
      (stu as any).rollNumber || r.rollNumber || '—',
      classLabel(stu),
      (stu as any).section || '—',
      r.testTitle          || '—',
      r.obtainedMarks      ?? '—',
      r.totalMarks         ?? '—',
      `${pct}%`,
    ];
  };

  const CustomTooltip = ({ active, payload, label }: any) =>
    active && payload?.length ? (
      <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-xs">
        <p className="font-semibold text-slate-700 mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>{p.name}: <strong>{p.value}%</strong></p>
        ))}
      </div>
    ) : null;

  return (
    <div className="space-y-5 pb-8">
      {drill && <DrillModal data={drill} onClose={() => setDrill(null)} />}
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-headline font-bold text-slate-900">Strategic Dashboard</h1>
          <p className="text-slate-500 text-sm">Institution-wide academic performance at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadAll} className="gap-1.5 rounded-xl">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button onClick={downloadReport}
            className="bg-green-600 hover:bg-green-700 text-white rounded-xl flex items-center gap-2 shadow-sm">
            <Download className="h-4 w-4" /> Export Report
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard label="Total Students"     value={summary?.totalStudents ?? 0}                        icon={Users}        color="text-blue-600 bg-blue-50" />
        <KpiCard label="Completion Rate"    value={`${summary?.completionRate ?? 0}%`}                 icon={Target}       color="text-indigo-600 bg-indigo-50" />
        <KpiCard label="Exam Avg (1st try)" value={`${perf?.overview?.examAvgFirstAttempt ?? 0}%`}    icon={Trophy}       color="text-amber-600 bg-amber-50" />
        <KpiCard label="Coding Avg"         value={`${perf?.overview?.codingAvg ?? 0}%`}               icon={Code2}        color="text-emerald-600 bg-emerald-50" />
        <KpiCard label="Technical Test Attempts" value={perf?.overview?.examTotalAttempts ?? 0}         icon={TrendingUp}   color="text-violet-600 bg-violet-50" />
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="overview"     className="flex items-center gap-1.5"><BarChart2 className="h-3.5 w-3.5" /> Overview</TabsTrigger>
          <TabsTrigger value="performance"  className="flex items-center gap-1.5"><Trophy className="h-3.5 w-3.5" /> Performance</TabsTrigger>
          <TabsTrigger value="insights"     className="flex items-center gap-1.5"><Brain className="h-3.5 w-3.5" /> Insights</TabsTrigger>
          <TabsTrigger value="skillgap"     className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Skill Gap</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Overview ── */}
        <TabsContent value="overview" className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Assessment coverage donut */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-500" /> Assessment Coverage
                </CardTitle>
              </CardHeader>
              <CardContent>
                {completionDonut.length > 0 ? (
                  <>
                    <DonutChart data={completionDonut} total={summary?.totalStudents ?? 0} label="Students"
                      onSliceClick={(entry) => {
                        openDrill({
                          title: `${entry.name} Students`,
                          subtitle: `${entry.value} students`,
                          columns: STUDENT_COLS,
                          rows: students.slice(0, entry.value).map(studentRow),
                        });
                      }}
                    />
                    <div className="flex justify-center gap-4 mt-2">
                      {completionDonut.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: PALETTE[i] }} />
                          {d.name} ({d.value})
                        </div>
                      ))}
                    </div>
                  </>
                ) : <p className="text-slate-400 text-sm text-center py-10">No data yet.</p>}
              </CardContent>
            </Card>

            {/* Program student distribution donut */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-violet-500" /> Students by Program
                </CardTitle>
              </CardHeader>
              <CardContent>
                {programChartData.length === 0
                  ? <p className="text-slate-400 text-sm text-center py-10">No data yet.</p>
                  : (
                    <>
                      <DonutChart
                        data={programChartData.map(p => ({ name: p.name, value: p.students }))}
                        total={programChartData.reduce((a, p) => a + p.students, 0)}
                        label="Students"
                        onSliceClick={(entry) => {
                          const list = students.filter((s: any) => s.program === entry.name);
                          openDrill({
                            title: `${entry.name} — Student List`,
                            subtitle: `${list.length} students enrolled`,
                            columns: STUDENT_COLS,
                            rows: list.map(studentRow),
                          });
                        }}
                      />
                      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-2">
                        {programChartData.map((p, i) => (
                          <div key={p.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: PALETTE[i % PALETTE.length] }} />
                            {p.name}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
              </CardContent>
            </Card>

            {/* Attempt trend area */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-indigo-500" /> Score Trend by Attempt
                </CardTitle>
              </CardHeader>
              <CardContent>
                {attemptChartData.length === 0
                  ? <p className="text-slate-400 text-sm text-center py-10">No attempt data yet.</p>
                  : (
                    {chartsMounted && <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={attemptChartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                        <defs>
                          <linearGradient id="avgGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: any) => [`${v}%`, 'Avg']} />
                        <Area type="monotone" dataKey="avg" name="Avg %" stroke="#6366f1" strokeWidth={2.5}
                          fill="url(#avgGrad)" dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }}
                          onClick={(_: any, payload: any) => {
                            if (!payload?.activePayload?.[0]) return;
                            const d = payload.activePayload[0].payload;
                            openDrill({ title: `${d.name} — Summary`, subtitle: `Avg ${d.avg}% across ${d.records} record(s)`, columns: ['Metric', 'Value'], rows: [['Attempt', d.name], ['Average Score', `${d.avg}%`], ['Total Records', d.records]] });
                          }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>}
                  )}
              </CardContent>
            </Card>
          </div>

          {/* Program exam vs coding — pie side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" /> Program Exam Average (pie)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {programChartData.length === 0
                  ? <p className="text-slate-400 text-sm text-center py-10">No data yet.</p>
                  : (
                    <>
                      <DonutChart
                        data={programChartData.map(p => ({ name: p.name, value: p.exam }))}
                        total={Math.round(programChartData.reduce((a, p) => a + p.exam, 0) / programChartData.length)}
                        label="Avg %"
                        onSliceClick={(entry) => {
                          const progStudents = new Set(students.filter((s: any) => s.program === entry.name).map((s: any) => s.name));
                          const results = examResults.filter((r: any) => progStudents.has(r.userName));
                          openDrill({
                            title: `${entry.name} — Exam Results`,
                            subtitle: `${results.length} attempt(s) · Avg ${entry.value}%`,
                            columns: EXAM_COLS,
                            rows: results.map(examRow),
                          });
                        }}
                      />
                      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-2">
                        {programChartData.map((p, i) => (
                          <div key={p.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: PALETTE[i % PALETTE.length] }} />
                            {p.name}: {p.exam}%
                          </div>
                        ))}
                      </div>
                    </>
                  )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-emerald-500" /> Program Coding Average (pie)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {programChartData.length === 0
                  ? <p className="text-slate-400 text-sm text-center py-10">No data yet.</p>
                  : (
                    <>
                      <DonutChart
                        data={programChartData.map(p => ({ name: p.name, value: p.coding }))}
                        total={Math.round(programChartData.reduce((a, p) => a + p.coding, 0) / programChartData.length)}
                        label="Avg %"
                        onSliceClick={(entry) => {
                          const progStudents = new Set(students.filter((s: any) => s.program === entry.name).map((s: any) => s.name));
                          const subs = codingSubmissions.filter((r: any) => progStudents.has(r.studentName));
                          openDrill({
                            title: `${entry.name} — Coding Submissions`,
                            subtitle: `${subs.length} submission(s) · Avg ${entry.value}%`,
                            columns: CODING_COLS,
                            rows: subs.map(codingRow),
                          });
                        }}
                      />
                      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-2">
                        {programChartData.map((p, i) => (
                          <div key={p.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: PALETTE[i % PALETTE.length] }} />
                            {p.name}: {p.coding}%
                          </div>
                        ))}
                      </div>
                    </>
                  )}
              </CardContent>
            </Card>
          </div>

          <AITestComparison />
        </TabsContent>

        {/* ── Tab 2: Performance ── */}
        <TabsContent value="performance" className="space-y-5">
          {/* Batch pie donuts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {batchChartData.length === 0
              ? (
                <Card className="border-slate-200 shadow-sm col-span-3">
                  <CardContent><p className="text-slate-400 text-sm text-center py-10">No batch data yet.</p></CardContent>
                </Card>
              )
              : batchChartData.slice(0, 6).map((b, i) => {
                const bDonut = [
                  { name: 'Exam',   value: b.exam },
                  { name: 'Coding', value: b.coding },
                  { name: 'Gap',    value: Math.max(0, 100 - Math.max(b.exam, b.coding)) },
                ];
                return (
                  <Card key={b.name} className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-0 pt-3">
                      <CardTitle className="text-xs font-semibold text-slate-700 text-center">{b.name || `Batch ${i+1}`}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-1">
                      <DonutChart data={bDonut} total={Math.round((b.exam + b.coding) / 2)} label="Avg %"
                        onSliceClick={(entry) => {
                          const batchStudents = studentByBatch(b.name);
                          if (entry.name === 'Exam') {
                            const bNames = new Set(batchStudents.map((s: any) => s.name));
                            const results = examResults.filter((r: any) => bNames.has(r.userName));
                            openDrill({ title: `${b.name} — Exam Results`, subtitle: `Avg ${b.exam}%`, columns: EXAM_COLS, rows: results.map(examRow) });
                          } else if (entry.name === 'Coding') {
                            const bNames = new Set(batchStudents.map((s: any) => s.name));
                            const subs = codingSubmissions.filter((r: any) => bNames.has(r.studentName));
                            openDrill({ title: `${b.name} — Coding Results`, subtitle: `Avg ${b.coding}%`, columns: CODING_COLS, rows: subs.map(codingRow) });
                          } else {
                            openDrill({ title: `${b.name} — Students`, subtitle: `${batchStudents.length} enrolled`, columns: STUDENT_COLS, rows: batchStudents.map(studentRow) });
                          }
                        }}
                      />
                      <div className="flex justify-center gap-3 mt-1">
                        {[{ label: 'Exam', color: PALETTE[0] }, { label: 'Coding', color: PALETTE[2] }].map(l => (
                          <div key={l.label} className="flex items-center gap-1 text-[10px] text-slate-500">
                            <span className="w-2 h-2 rounded-full inline-block" style={{ background: l.color }} />{l.label}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>

          {/* Coding tests — card grid */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Code2 className="h-4 w-4 text-emerald-500" /> Coding Test Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              {codingTests.length === 0
                ? <p className="text-slate-400 text-sm text-center py-8">No coding tests scheduled yet.</p>
                : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {codingTests.map((t: any) => (
                      <div key={t._id} className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-emerald-50 p-4 space-y-2">
                        <p className="font-semibold text-sm text-slate-800 leading-tight">{t.title}</p>
                        <p className="text-xs text-slate-500">{t.teacherName || 'Teacher TBD'}</p>
                        <div className="flex flex-wrap gap-1">
                          {(t.targetPrograms?.length > 0 ? t.targetPrograms : ['All']).map((p: string) => (
                            <span key={p} className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-medium">{p}</span>
                          ))}
                          {t.targetYears?.map((y: number) => (
                            <span key={y} className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-medium">Year {y}</span>
                          ))}
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                          <span>{(t.problems || []).length} problems · {t.durationMins} min</span>
                          <span className="font-medium text-slate-700">{t.examDate || 'TBD'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 3: Insights ── */}
        <TabsContent value="insights" className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Career aspiration donut */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Target className="h-4 w-4 text-violet-500" /> Career Aspirations
                </CardTitle>
              </CardHeader>
              <CardContent>
                {aspirationData.length === 0
                  ? <p className="text-slate-400 text-sm text-center py-10">No data yet.</p>
                  : (
                    <>
                      <DonutChart
                        data={aspirationData}
                        total={aspirations.reduce((a: number, x: any) => a + x.count, 0)}
                        label="Responses"
                        onSliceClick={(entry) => {
                          const aList = students.filter((s: any) => s.careerAspiration === entry.name || s.aspiration === entry.name);
                          openDrill({
                            title: `Career: ${entry.name}`,
                            subtitle: `${entry.value} student(s) selected this aspiration`,
                            columns: aList.length ? STUDENT_COLS : ['Info'],
                            rows: aList.length ? aList.map(studentRow) : [[`${entry.value} students aspire to: ${entry.name}`]],
                          });
                        }}
                      />
                      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-2">
                        {aspirationData.map((d, i) => (
                          <div key={d.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                            {d.name}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
              </CardContent>
            </Card>

            {/* Training demand donut */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Brain className="h-4 w-4 text-orange-500" /> Top Training Demands
                </CardTitle>
              </CardHeader>
              <CardContent>
                {trainingData.length === 0
                  ? <p className="text-slate-400 text-sm text-center py-10">No data yet.</p>
                  : (
                    <>
                      <DonutChart
                        data={trainingData}
                        total={trainingData.reduce((a, d) => a + d.value, 0)}
                        label="Requests"
                        onSliceClick={(entry) => {
                          const tList = students.filter((s: any) => s.trainingInterest === entry.name || (Array.isArray(s.trainingPreferences) && s.trainingPreferences.includes(entry.name)));
                          openDrill({
                            title: `Training Demand: ${entry.name}`,
                            subtitle: `${entry.value} student(s) requested this`,
                            columns: tList.length ? STUDENT_COLS : ['Info'],
                            rows: tList.length ? tList.map(studentRow) : [[`${entry.value} students requested: ${entry.name}`]],
                          });
                        }}
                      />
                      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-2">
                        {trainingData.map((d, i) => (
                          <div key={d.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                            {d.name}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
              </CardContent>
            </Card>

            {/* Skill level donut — strong vs average vs weak */}
            {heatmap.length > 0 && (() => {
              const strong  = skillAvgData.filter(d => d.avg >= 3.5).length;
              const average = skillAvgData.filter(d => d.avg >= 2.5 && d.avg < 3.5).length;
              const weak    = skillAvgData.filter(d => d.avg < 2.5).length;
              const skillHealthData = [
                { name: 'Strong (≥3.5)', value: strong },
                { name: 'Average', value: average },
                { name: 'Weak (<2.5)', value: weak },
              ].filter(d => d.value > 0);
              return (
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="pb-1">
                    <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <BarChart2 className="h-4 w-4 text-rose-500" /> Skill Health Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DonutChart data={skillHealthData} total={skillAvgData.length} label="Skills"
                      colors={['#10b981','#f59e0b','#ef4444']}
                      onSliceClick={(entry) => {
                        const bucket = entry.name.startsWith('Strong') ? skillAvgData.filter(d => d.avg >= 3.5) : entry.name.startsWith('Average') ? skillAvgData.filter(d => d.avg >= 2.5 && d.avg < 3.5) : skillAvgData.filter(d => d.avg < 2.5);
                        openDrill({ title: `Skills — ${entry.name}`, subtitle: `${bucket.length} skill(s) in this category`, columns: ['Skill', 'Avg Score', 'Institution %'], rows: bucket.map(d => [d.skill, `${d.avg}/5`, `${d.pct}%`]) });
                      }}
                    />
                    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-2">
                      {skillHealthData.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: ['#10b981','#f59e0b','#ef4444'][i] }} />
                          {d.name} ({d.value})
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </div>

          {/* Skill radial bars */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Brain className="h-4 w-4 text-rose-500" /> Institution-wide Skill Profile (avg out of 5)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {heatmap.length === 0
                ? <p className="text-slate-400 text-sm text-center py-8">No assessment data yet.</p>
                : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                    {chartsMounted && <ResponsiveContainer width="100%" height={260}>
                      <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="90%"
                        data={skillAvgData.map((d, i) => ({ ...d, fill: PALETTE[i % PALETTE.length] }))}
                        startAngle={90} endAngle={-270}>
                        <RadialBar dataKey="pct" cornerRadius={6} label={false} />
                        <Tooltip formatter={(v: any) => [`${v}%`, 'Score']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      </RadialBarChart>
                    </ResponsiveContainer>}
                    <div className="space-y-2">
                      {skillAvgData.map((d, i) => (
                        <div key={d.skill} className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                          <span className="text-xs text-slate-700 w-20 shrink-0">{d.skill}</span>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${d.pct}%`, background: PALETTE[i % PALETTE.length] }} />
                          </div>
                          <span className="text-xs font-bold text-slate-700 w-8 text-right">{d.avg}/5</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 4: Skill Gap ── */}
        <TabsContent value="skillgap" className="space-y-5">
          {/* At-risk + pass/fail donuts */}
          {(examGapData.length > 0 || codingGapData.length > 0) && (() => {
            const totalExamWeak   = examGapData.reduce((a, d) => a + d.weak, 0);
            const totalCodingWeak = codingGapData.reduce((a, d) => a + d.weak, 0);
            const totalStudents   = summary?.totalStudents ?? 0;
            const atRiskData = [
              { name: 'Exam below 60%',   value: totalExamWeak },
              { name: 'Coding below 60%', value: totalCodingWeak },
            ].filter(d => d.value > 0);

            const examPassFail = [
              { name: 'Passed (≥60%)', value: examGapData.filter(d => d.avg >= 60).length },
              { name: 'At Risk (<60%)', value: examGapData.filter(d => d.avg < 60).length },
            ].filter(d => d.value > 0);

            const codingPassFail = [
              { name: 'Passed (≥60%)', value: codingGapData.filter(d => d.avg >= 60).length },
              { name: 'At Risk (<60%)', value: codingGapData.filter(d => d.avg < 60).length },
            ].filter(d => d.value > 0);

            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="pb-1">
                    <CardTitle className="text-sm font-semibold text-slate-700">At-Risk Students</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DonutChart data={atRiskData} total={totalExamWeak + totalCodingWeak} label="At-Risk"
                      onSliceClick={(entry) => {
                        if (entry.name.includes('Exam')) {
                          const weak = examResults.filter((r: any) => (r.percentage || 0) < 60);
                          openDrill({ title: 'Exam At-Risk Students (< 60%)', subtitle: `${weak.length} record(s)`, columns: EXAM_COLS, rows: weak.map(examRow) });
                        } else {
                          const weak = codingSubmissions.filter((r: any) => r.totalMarks > 0 && (r.obtainedMarks/r.totalMarks)*100 < 60);
                          openDrill({ title: 'Coding At-Risk Students (< 60%)', subtitle: `${weak.length} record(s)`, columns: CODING_COLS, rows: weak.map(codingRow) });
                        }
                      }}
                    />
                    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-2">
                      {atRiskData.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: PALETTE[i] }} />
                          {d.name}: <strong className="ml-0.5">{d.value}</strong>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="pb-1">
                    <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-indigo-500" /> Exam Subjects Pass/Fail
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DonutChart data={examPassFail} total={examGapData.length} label="Subjects"
                      onSliceClick={(entry) => {
                        const passed = entry.name.includes('Passed');
                        const filtered = examGapData.filter(d => passed ? d.avg >= 60 : d.avg < 60);
                        openDrill({ title: `Exam Subjects — ${entry.name}`, subtitle: `${filtered.length} subject(s)`, columns: ['Subject', 'Avg Score', 'Below 60%'], rows: filtered.map(d => [d.name, `${d.avg}%`, d.weak]) });
                      }}
                    />
                    <div className="flex justify-center gap-4 mt-2">
                      {examPassFail.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: PALETTE[i % PALETTE.length] }}>
                          <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                          {d.name} ({d.value})
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="pb-1">
                    <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Code2 className="h-4 w-4 text-emerald-500" /> Coding Tests Pass/Fail
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DonutChart data={codingPassFail} total={codingGapData.length} label="Tests"
                      onSliceClick={(entry) => {
                        const passed = entry.name.includes('Passed');
                        const filtered = codingGapData.filter(d => passed ? d.avg >= 60 : d.avg < 60);
                        openDrill({ title: `Coding Tests — ${entry.name}`, subtitle: `${filtered.length} test(s)`, columns: ['Test', 'Avg Score', 'Below 60%'], rows: filtered.map(d => [d.name, `${d.avg}%`, d.weak]) });
                      }}
                    />
                    <div className="flex justify-center gap-4 mt-2">
                      {codingPassFail.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: PALETTE[i % PALETTE.length] }}>
                          <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                          {d.name} ({d.value})
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {/* Per-subject gap bars */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-indigo-500" /> AI Test Subject Averages
                </CardTitle>
              </CardHeader>
              <CardContent>
                {examGapData.length === 0
                  ? <p className="text-sm text-slate-400 text-center py-8">No exam results yet.</p>
                  : chartsMounted && (
                    <ResponsiveContainer width="100%" height={Math.max(240, examGapData.length * 36)}>
                      <BarChart data={examGapData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" width={140}
                          tick={({ x, y, payload }: any) => {
                            const label: string = payload.value.length > 18 ? payload.value.slice(0, 17) + '…' : payload.value;
                            return <text x={x} y={y} dy={4} textAnchor="end" fontSize={10} fill="#475569">{label}</text>;
                          }} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: any) => [`${v}%`, 'Avg Score']} />
                        <Bar dataKey="avg" name="Avg %" radius={[0, 4, 4, 0]} maxBarSize={18}
                          onClick={(d: any) => {
                            const results = examsBySubject(d.name);
                            openDrill({
                              title: `Subject: ${d.name}`,
                              subtitle: `Avg ${d.avg}% · ${d.weak} student(s) below 60%`,
                              columns: EXAM_COLS,
                              rows: results.map(examRow),
                            });
                          }}
                          style={{ cursor: 'pointer' }}>
                          {examGapData.map((d) => <Cell key={d.name} fill={pctColor(d.avg)} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-emerald-500" /> Coding Test Averages
                </CardTitle>
              </CardHeader>
              <CardContent>
                {codingGapData.length === 0
                  ? <p className="text-sm text-slate-400 text-center py-8">No coding submissions yet.</p>
                  : chartsMounted && (
                    <ResponsiveContainer width="100%" height={Math.max(240, codingGapData.length * 36)}>
                      <BarChart data={codingGapData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" width={140}
                          tick={({ x, y, payload }: any) => {
                            const label: string = payload.value.length > 18 ? payload.value.slice(0, 17) + '…' : payload.value;
                            return <text x={x} y={y} dy={4} textAnchor="end" fontSize={10} fill="#475569">{label}</text>;
                          }} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: any) => [`${v}%`, 'Avg Score']} />
                        <Bar dataKey="avg" name="Avg %" radius={[0, 4, 4, 0]} maxBarSize={18}
                          onClick={(d: any) => {
                            const subs = codingByTest(d.name);
                            openDrill({
                              title: `Coding Test: ${d.name}`,
                              subtitle: `Avg ${d.avg}% · ${d.weak} student(s) below 60%`,
                              columns: CODING_COLS,
                              rows: subs.map(codingRow),
                            });
                          }}
                          style={{ cursor: 'pointer' }}>
                          {codingGapData.map((d) => <Cell key={d.name} fill={pctColor(d.avg)} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
