'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { getCurrentUser } from '@/lib/mock-db';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import {
  Users, Trophy, Brain, Code2, BarChart2, Target, LineChart,
  Download, GraduationCap, CheckCircle2, RefreshCw, AlertTriangle,
} from 'lucide-react';
import { AITestComparison } from '@/components/dashboard/AITestComparison';

// Color coding for heatmap cells
function heatColor(val: number): string {
  if (!val) return 'bg-slate-100 text-slate-400';
  const pct = ((val - 1) / 4) * 100;
  if (pct >= 70) return 'bg-green-100 text-green-800 font-semibold';
  if (pct >= 45) return 'bg-yellow-100 text-yellow-800 font-semibold';
  return 'bg-red-100 text-red-800 font-semibold';
}
function pctColor(p: number) {
  return p >= 70 ? 'text-green-600' : p >= 50 ? 'text-amber-600' : 'text-red-500';
}
function barColor(p: number) {
  return p >= 70 ? 'bg-green-500' : p >= 50 ? 'bg-amber-500' : 'bg-red-400';
}

const SKILL_KEYS = [
  { key: 'communication',    label: 'Communication' },
  { key: 'problemSolving',   label: 'Problem Solving' },
  { key: 'technical',        label: 'Technical' },
  { key: 'teamwork',         label: 'Teamwork' },
  { key: 'timeManagement',   label: 'Time Mgmt' },
  { key: 'leadership',       label: 'Leadership' },
  { key: 'criticalThinking', label: 'Critical Thinking' },
  { key: 'emotionalIntelligence', label: 'Emotional Intell.' },
  { key: 'industryReadiness',     label: 'Industry Ready' },
];

function Bar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-2.5 rounded-full ${barColor(pct)}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold w-10 text-right ${pctColor(pct)}`}>{pct}%</span>
    </div>
  );
}

export default function DeanDashboard() {
  const router = useRouter();
  const [summary, setSummary]         = useState<any>(null);
  const [heatmap, setHeatmap]         = useState<any[]>([]);
  const [aspirations, setAspirations] = useState<any[]>([]);
  const [training, setTraining]       = useState<any[]>([]);
  const [perf, setPerf]               = useState<any>(null);
  const [codingTests, setCodingTests] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [examResults, setExamResults]       = useState<any[]>([]);
  const [codingSubmissions, setCodingSubmissions] = useState<any[]>([]);
  const [students, setStudents]             = useState<any[]>([]);

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
      // Fetch all coding test submissions in parallel
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

    // Fetch AI test results for student-level sheet
    let examResults: any[] = [];
    try {
      const res = await fetch('/api/exam-results');
      const data = await res.json();
      examResults = Array.isArray(data) ? data : [];
    } catch { /* non-fatal */ }

    // Sheet 1: Summary
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

    // Sheet 2: Student-wise AI Test Results
    if (examResults.length > 0) {
      const erRows = [['Student Name', 'Exam Title', 'Subject', 'Score', 'Total', 'Percentage (%)', 'Time (sec)', 'First Attempt', 'Date']];
      examResults.forEach((r: any) => erRows.push([
        r.userName, r.courseName, r.subjectName || '—',
        r.score, r.total, Math.round(r.percentage || 0), r.timeTaken || 0,
        r.isFirstAttempt ? 'Yes' : 'No',
        r.date ? format(new Date(r.date), 'dd/MM/yyyy') : '—',
      ]));
      const wsEr = XLSX.utils.aoa_to_sheet(erRows);
      wsEr['!cols'] = [22, 32, 20, 8, 8, 16, 12, 14, 14].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, wsEr, 'AI Test Results');
    }

    // Sheet 3: Program-wise performance
    const progRows = [['Program', 'Students', 'Exam Avg (%)', 'Exam Attempts', 'Coding Avg (%)', 'Coding Submissions']];
    (perf?.byProgram || []).forEach((p: any) => progRows.push([
      p.program, p.students, p.examAvg, p.examAttempts, p.codingAvg, p.codingSubmissions,
    ]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(progRows), 'Program Performance');

    // Sheet 4: Batch-wise performance
    const batchRows = [['Batch', 'Students', 'Exam Avg (%)', 'Exam Attempts', 'Coding Avg (%)', 'Coding Submissions']];
    (perf?.byBatch || []).forEach((b: any) => batchRows.push([
      b.batch, b.students, b.examAvg, b.examAttempts, b.codingAvg, b.codingSubmissions,
    ]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(batchRows), 'Batch Performance');

    // Sheet 5: Section-wise performance
    const sectionRows = [['Program', 'Year', 'Section', 'Students', 'Exam Avg (%)', 'Exam Attempts', 'Coding Avg (%)', 'Coding Submissions']];
    (perf?.bySection || []).forEach((sec: any) => sectionRows.push([
      sec.program, sec.year, sec.section, sec.students, sec.examAvg, sec.examAttempts, sec.codingAvg, sec.codingSubmissions,
    ]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sectionRows), 'Section Performance');

    // Sheet 6: Attempt-wise comparison
    const attemptRows = [['Attempt #', 'Avg Score (%)', 'Records']];
    (perf?.attemptComparison || []).forEach((a: any) => attemptRows.push([a.attempt, a.avgPercentage, a.count]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(attemptRows), 'Attempt Comparison');

    // Sheet 7: Coding tests
    const ctRows = [['Title', 'Teacher', 'Problems', 'Duration (min)', 'Target Programs', 'Target Years', 'Scheduled Date']];
    codingTests.forEach((t: any) => ctRows.push([
      t.title, t.teacherName || '—', (t.problems || []).length, t.durationMins,
      (t.targetPrograms || []).join(', ') || 'All',
      (t.targetYears    || []).join(', ') || 'All',
      t.examDate || '—',
    ]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ctRows), 'Coding Tests');

    // Sheet 8: Skill heatmap
    const hRows = [['Program', ...SKILL_KEYS.map(s => s.label), 'Students']];
    heatmap.forEach((row: any) => hRows.push([
      row._id, ...SKILL_KEYS.map(s => +(row[s.key] || 0).toFixed(2)), row.count,
    ]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hRows), 'Skill Heatmap');

    // Sheet 9: Training demand
    const trainRows = [['Training Type', 'Demand Count']];
    training.forEach(t => trainRows.push([t._id, t.count]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(trainRows), 'Training Demand');

    XLSX.writeFile(wb, `SRM_Strategic_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent" />
    </div>
  );

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-headline font-bold text-slate-900">Strategic Dashboard</h1>
          <p className="text-slate-500 text-sm">Institution-wide student performance analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadAll} className="gap-1.5 rounded-xl">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button onClick={downloadReport}
            className="bg-green-600 hover:bg-green-700 text-white rounded-xl flex items-center gap-2 shadow-sm">
            <Download className="h-4 w-4" /> Download Excel Report
          </Button>
        </div>
      </div>

      {/* Summary KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Students',     value: summary?.totalStudents    ?? 0,        icon: Users,        color: 'text-blue-600 bg-blue-50' },
          { label: 'Assessments Done',   value: summary?.totalAssessed    ?? 0,        icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
          { label: 'Completion Rate',    value: `${summary?.completionRate ?? 0}%`,    icon: Target,       color: 'text-indigo-600 bg-indigo-50' },
          { label: 'Exam Avg (1st try)', value: `${perf?.overview?.examAvgFirstAttempt ?? 0}%`, icon: Trophy, color: 'text-amber-600 bg-amber-50' },
          { label: 'Coding Test Avg',    value: `${perf?.overview?.codingAvg ?? 0}%`,  icon: Code2,        color: 'text-emerald-600 bg-emerald-50' },
        ].map(s => (
          <Card key={s.label} className="border-slate-200 shadow-sm">
            <CardContent className="pt-3 pb-3 flex flex-col items-center text-center gap-1.5">
              <div className={`p-2 rounded-xl ${s.color}`}><s.icon className="h-4 w-4" /></div>
              <p className="text-xl font-black text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-3">
          <TabsTrigger value="overview" className="flex items-center gap-1.5">
            <BarChart2 className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5" /> Performance
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5" /> Insights
          </TabsTrigger>
          <TabsTrigger value="skillgap" className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Skill Gap
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Overview ── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <LineChart className="h-4 w-4 text-indigo-500" /> Attempt-wise Exam Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(perf?.attemptComparison || []).length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">No exam attempt data yet.</p>
                ) : (
                  <div className="flex items-end gap-4 h-36 px-2">
                    {perf.attemptComparison.map((a: any) => (
                      <div key={a.attempt} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                        <span className="text-xs font-bold text-slate-700">{a.avgPercentage}%</span>
                        <div className="w-full max-w-14 bg-slate-100 rounded-t-lg overflow-hidden flex items-end" style={{ height: '100px' }}>
                          <div className={`w-full rounded-t-lg ${barColor(a.avgPercentage)}`} style={{ height: `${Math.max(4, a.avgPercentage)}%` }} />
                        </div>
                        <span className="text-[10px] font-semibold text-slate-600">Attempt {a.attempt}</span>
                        <span className="text-[10px] text-slate-400">{a.count} records</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-indigo-500" /> Program-wise Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(perf?.byProgram || []).length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">No performance data yet.</p>
                ) : (
                  <div className="space-y-3">
                    {perf.byProgram.map((p: any) => (
                      <div key={p.program} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-800 w-20 shrink-0">{p.program}</span>
                          <Badge variant="outline" className="text-[10px]">{p.students}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex items-center gap-1.5">
                            <Trophy className="h-3 w-3 text-amber-500 shrink-0" />
                            <Bar value={p.examAvg} />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Code2 className="h-3 w-3 text-emerald-500 shrink-0" />
                            <Bar value={p.codingAvg} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <AITestComparison />
        </TabsContent>

        {/* ── Tab 2: Performance ── */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-violet-500" /> Batch-wise Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(perf?.byBatch || []).length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">No batch data yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="text-left py-2 px-2 font-semibold">Batch</th>
                          <th className="text-center py-2 px-2 font-semibold">Students</th>
                          <th className="text-left py-2 px-2 font-semibold">Exam Avg</th>
                          <th className="text-left py-2 px-2 font-semibold">Coding Avg</th>
                        </tr>
                      </thead>
                      <tbody>
                        {perf.byBatch.map((b: any) => (
                          <tr key={b.batch} className="border-b border-slate-50">
                            <td className="py-2 px-2 font-semibold text-slate-700">{b.batch || '—'}</td>
                            <td className="py-2 px-2 text-center text-slate-500">{b.students}</td>
                            <td className="py-2 px-2 w-32"><Bar value={b.examAvg} /></td>
                            <td className="py-2 px-2 w-32"><Bar value={b.codingAvg} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" /> Section-wise Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(perf?.bySection || []).length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">No section data yet.</p>
                ) : (
                  <div className="overflow-x-auto max-h-72">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="text-left py-2 px-2 font-semibold">Section</th>
                          <th className="text-center py-2 px-2 font-semibold">Students</th>
                          <th className="text-left py-2 px-2 font-semibold">Exam Avg</th>
                          <th className="text-left py-2 px-2 font-semibold">Coding Avg</th>
                        </tr>
                      </thead>
                      <tbody>
                        {perf.bySection.map((sec: any, i: number) => (
                          <tr key={i} className="border-b border-slate-50">
                            <td className="py-2 px-2 font-semibold text-slate-700">
                              {sec.program || '—'}{sec.year && sec.year !== '—' ? ` Y${sec.year}` : ''}{sec.section ? ` §${sec.section}` : ''}
                            </td>
                            <td className="py-2 px-2 text-center text-slate-500">{sec.students}</td>
                            <td className="py-2 px-2 w-32"><Bar value={sec.examAvg} /></td>
                            <td className="py-2 px-2 w-32"><Bar value={sec.codingAvg} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Code2 className="h-4 w-4 text-emerald-500" /> Coding Test Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              {codingTests.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">No coding tests scheduled yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="text-left py-2 px-3 font-semibold">Title</th>
                        <th className="text-left py-2 px-2 font-semibold">Teacher</th>
                        <th className="text-center py-2 px-2 font-semibold">Problems</th>
                        <th className="text-center py-2 px-2 font-semibold">Duration</th>
                        <th className="text-left py-2 px-2 font-semibold">Audience</th>
                        <th className="text-left py-2 px-2 font-semibold">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {codingTests.map((t: any) => (
                        <tr key={t._id} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-2 px-3 font-semibold text-slate-800">{t.title}</td>
                          <td className="py-2 px-2 text-slate-500">{t.teacherName || '—'}</td>
                          <td className="py-2 px-2 text-center text-slate-600">{(t.problems || []).length}</td>
                          <td className="py-2 px-2 text-center text-slate-600">{t.durationMins} min</td>
                          <td className="py-2 px-2">
                            <div className="flex flex-wrap gap-1">
                              {(t.targetPrograms?.length > 0 ? t.targetPrograms : ['All']).map((p: string) => (
                                <span key={p} className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-medium">{p}</span>
                              ))}
                              {t.targetYears?.map((y: number) => (
                                <span key={y} className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-medium">Y{y}</span>
                              ))}
                              {t.targetSections?.length > 0
                                ? t.targetSections.map((s: string) => (
                                    <span key={s} className="px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 text-[10px] font-medium">§{s}</span>
                                  ))
                                : <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px]">All Sections</span>
                              }
                            </div>
                          </td>
                          <td className="py-2 px-2 text-slate-500">{t.examDate || '—'}{t.startTime ? ` ${t.startTime}` : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 3: Insights ── */}
        <TabsContent value="insights" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Target className="h-4 w-4 text-violet-500" /> Career Aspiration Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                {aspirations.length === 0
                  ? <p className="text-slate-400 text-sm text-center py-8">No data yet.</p>
                  : (() => {
                      const total = aspirations.reduce((a: number, x: any) => a + x.count, 0);
                      const COLORS = ['bg-indigo-500','bg-violet-500','bg-orange-500','bg-teal-500','bg-blue-500','bg-rose-500'];
                      return (
                        <div className="space-y-3">
                          {aspirations.map((a: any, idx: number) => {
                            const pct = total > 0 ? Math.round((a.count / total) * 100) : 0;
                            return (
                              <div key={a._id}>
                                <div className="flex justify-between mb-1">
                                  <span className="text-sm text-slate-700">{a._id}</span>
                                  <span className="text-sm font-bold text-slate-800">{pct}% ({a.count})</span>
                                </div>
                                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${COLORS[idx % COLORS.length]}`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Top Training Demands</CardTitle>
              </CardHeader>
              <CardContent>
                {training.length === 0
                  ? <p className="text-slate-400 text-sm text-center py-6">No data.</p>
                  : <div className="space-y-2">
                      {training.slice(0, 7).map((t: any, idx: number) => (
                        <div key={t._id} className="flex items-center gap-3">
                          <span className="text-xs font-bold text-slate-400 w-4">#{idx+1}</span>
                          <div className="flex-1">
                            <div className="flex justify-between mb-0.5">
                              <span className="text-xs text-slate-700">{t._id}</span>
                              <span className="text-xs font-bold text-slate-800">{t.count}</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-orange-400 rounded-full"
                                style={{ width: `${Math.min((t.count / (training[0]?.count || 1)) * 100, 100)}%` }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>}
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Brain className="h-4 w-4 text-rose-500" /> Skill Gap Heatmap
              </CardTitle>
              <CardDescription className="text-xs">Self-assessed skill score by program (1–5). 🔴 &lt;2.5 · 🟡 2.5–3.5 · 🟢 &gt;3.5</CardDescription>
            </CardHeader>
            <CardContent>
              {heatmap.length === 0
                ? <p className="text-slate-400 text-sm text-center py-8">No assessment data yet.</p>
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 px-3 text-slate-500 font-semibold w-32">Program</th>
                          {SKILL_KEYS.map(s => (
                            <th key={s.key} className="py-2 px-2 text-slate-500 font-semibold text-center min-w-[80px]">{s.label}</th>
                          ))}
                          <th className="py-2 px-2 text-slate-500 font-semibold text-center">Students</th>
                        </tr>
                      </thead>
                      <tbody>
                        {heatmap.map((row: any) => (
                          <tr key={row._id} className="border-b border-slate-50">
                            <td className="py-2 px-3 font-semibold text-slate-700">{row._id}</td>
                            {SKILL_KEYS.map(s => (
                              <td key={s.key} className="py-2 px-2 text-center">
                                <span className={`inline-block px-2 py-1 rounded-lg text-xs ${heatColor(row[s.key])}`}>
                                  {row[s.key] ? row[s.key].toFixed(1) : '—'}
                                </span>
                              </td>
                            ))}
                            <td className="py-2 px-2 text-center text-slate-500">{row.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 4: Skill Gap ── */}
        <TabsContent value="skillgap">
          {(() => {
            const rollByName = new Map(students.map((s: any) => [s.name, s.rollNumber || '']));

            const examGaps = (() => {
              const map = new Map<string, { sum: number; count: number; weak: { name: string; roll: string }[] }>();
              examResults.forEach((r: any) => {
                const subj = r.subjectName || r.courseName || 'Unknown';
                const e = map.get(subj) ?? { sum: 0, count: 0, weak: [] };
                e.sum += r.percentage || 0; e.count += 1;
                if ((r.percentage || 0) < 60 && r.userName && !e.weak.find(w => w.name === r.userName))
                  e.weak.push({ name: r.userName, roll: rollByName.get(r.userName) || '' });
                map.set(subj, e);
              });
              return Array.from(map.entries())
                .map(([subj, d]) => ({ label: subj, avg: Math.round(d.sum / d.count), count: d.count, weak: d.weak }))
                .sort((a, b) => a.avg - b.avg);
            })();

            const codingGaps = (() => {
              const map = new Map<string, { sum: number; count: number; weak: { name: string; roll: string }[] }>();
              codingSubmissions.forEach((r: any) => {
                if (!r.testTitle) return;
                const pct = r.totalMarks > 0 ? Math.round((r.obtainedMarks / r.totalMarks) * 100) : 0;
                const e = map.get(r.testTitle) ?? { sum: 0, count: 0, weak: [] };
                e.sum += pct; e.count += 1;
                if (pct < 60 && r.studentName && !e.weak.find(w => w.name === r.studentName))
                  e.weak.push({ name: r.studentName, roll: r.rollNumber || '' });
                map.set(r.testTitle, e);
              });
              return Array.from(map.entries())
                .map(([title, d]) => ({ label: title, avg: Math.round(d.sum / d.count), count: d.count, weak: d.weak }))
                .sort((a, b) => a.avg - b.avg);
            })();

            const GapCard = ({ title, icon: Icon, iconColor, gaps, emptyMsg }: {
              title: string; icon: any; iconColor: string;
              gaps: { label: string; avg: number; count: number; weak: { name: string; roll: string }[] }[];
              emptyMsg: string;
            }) => (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${iconColor}`} /> {title}
                  </CardTitle>
                  <CardDescription className="text-xs">Average score sorted weakest first. Students below 60% are highlighted.</CardDescription>
                </CardHeader>
                <CardContent>
                  {gaps.length === 0
                    ? <p className="text-sm text-slate-400 text-center py-6">{emptyMsg}</p>
                    : (
                      <div className="space-y-4">
                        {gaps.map(({ label, avg, count, weak }) => {
                          const bc = avg >= 70 ? 'bg-green-500' : avg >= 50 ? 'bg-yellow-400' : 'bg-red-500';
                          const lc = avg >= 70 ? 'text-green-700' : avg >= 50 ? 'text-yellow-700' : 'text-red-600';
                          return (
                            <div key={label} className="space-y-1.5">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium text-slate-800 truncate max-w-[55%]">{label}</span>
                                <div className="flex items-center gap-3 shrink-0">
                                  {weak.length > 0 && (
                                    <span className="text-xs text-red-500 flex items-center gap-1">
                                      <AlertTriangle className="h-3 w-3" /> {weak.length} &lt;60%
                                    </span>
                                  )}
                                  <span className={`font-bold text-sm ${lc}`}>{avg}%</span>
                                  <span className="text-xs text-slate-400">{count} attempt{count > 1 ? 's' : ''}</span>
                                </div>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2.5">
                                <div className={`${bc} h-2.5 rounded-full`} style={{ width: `${avg}%` }} />
                              </div>
                              {weak.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-0.5">
                                  {weak.map(({ name, roll }) => (
                                    <span key={name} className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                                      {roll ? `${roll} — ${name}` : name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                </CardContent>
              </Card>
            );

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <GapCard title="AI Placement Tests — Subject Gap" icon={AlertTriangle} iconColor="text-indigo-500"
                  gaps={examGaps} emptyMsg="No exam results yet." />
                <GapCard title="Coding Tests — Skill Gap" icon={Code2} iconColor="text-emerald-500"
                  gaps={codingGaps} emptyMsg="No coding test submissions yet." />
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
