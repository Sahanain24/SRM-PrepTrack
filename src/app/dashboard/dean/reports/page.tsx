'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/mock-db';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import {
  Download, FileSpreadsheet, Loader2, Users, BarChart2,
  Brain, Target, GraduationCap, RefreshCw, CheckCircle2,
  FileText, TrendingUp, ClipboardList,
} from 'lucide-react';

const ALLOWED = ['dean', 'deputy_dean', 'pro_vc', 'hod', 'admin'];

const SKILL_KEYS = [
  { key: 'communication',         label: 'Communication' },
  { key: 'problemSolving',        label: 'Problem Solving' },
  { key: 'technical',             label: 'Technical' },
  { key: 'teamwork',              label: 'Teamwork' },
  { key: 'timeManagement',        label: 'Time Mgmt' },
  { key: 'leadership',            label: 'Leadership' },
  { key: 'criticalThinking',      label: 'Critical Thinking' },
  { key: 'emotionalIntelligence', label: 'Emotional Intell.' },
  { key: 'industryReadiness',     label: 'Industry Ready' },
];

export default function ReportsPage() {
  const router    = useRouter();
  const { toast } = useToast();

  const [loading,       setLoading]       = useState(true);
  const [generating,    setGenerating]    = useState<string | null>(null);
  const [summary,       setSummary]       = useState<any>(null);
  const [programData,   setProgramData]   = useState<any[]>([]);
  const [heatmap,       setHeatmap]       = useState<any[]>([]);
  const [aspirations,   setAspirations]   = useState<any[]>([]);
  const [training,      setTraining]      = useState<any[]>([]);
  const [allStudents,   setAllStudents]   = useState<any[]>([]);
  const [allAssessments,setAllAssessments]= useState<any[]>([]);
  const [perf,          setPerf]          = useState<any>(null);
  const [examResults,   setExamResults]   = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [s, p, h, a, t, students, assessments, perfData, examData] = await Promise.all([
        fetch('/api/analytics?type=summary').then(r => r.json()),
        fetch('/api/analytics?type=program-wise').then(r => r.json()),
        fetch('/api/analytics?type=skill-heatmap').then(r => r.json()),
        fetch('/api/analytics?type=career-aspirations').then(r => r.json()),
        fetch('/api/analytics?type=training-demand').then(r => r.json()),
        fetch('/api/users?role=student').then(r => r.json()),
        fetch('/api/analytics').then(r => r.json()),
        fetch('/api/analytics/performance').then(r => r.json()),
        fetch('/api/exam-results').then(r => r.json()),
      ]);
      setSummary(s);
      setProgramData(Array.isArray(p) ? p : []);
      setHeatmap(Array.isArray(h) ? h : []);
      setAspirations(Array.isArray(a) ? a : []);
      setTraining(Array.isArray(t) ? t : []);
      setAllStudents(Array.isArray(students) ? students : []);
      setAllAssessments(Array.isArray(assessments) ? assessments : []);
      setPerf(perfData && !perfData.error ? perfData : null);
      setExamResults(Array.isArray(examData) ? examData : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const user = getCurrentUser() as any;
    if (!user || !ALLOWED.includes(user.role)) { router.push('/dashboard'); return; }
    load();
  }, []);

  const clean = (row: any[]) => row.map(c => (c === null || c === undefined) ? '' : c);

  const dl = (wb: any, filename: string) => {
    XLSX.writeFile(wb, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast({ title: 'Report downloaded!' });
  };

  const fmtDate = (d: string | null | undefined) => {
    if (!d) return '—';
    try { return new Intl.DateTimeFormat('en-GB').format(new Date(d)); } catch { return d; }
  };

  // ── 1. Executive Summary ────────────────────────────────────────────────────
  const genExecutiveSummary = () => {
    const wb  = XLSX.utils.book_new();
    const rate = allStudents.length ? Math.round((allAssessments.length / allStudents.length) * 100) : 0;

    const rows = [
      clean(['SRM PrepTrack — Executive Summary']),
      clean([`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`]),
      clean([]),
      clean(['METRIC', 'VALUE']),
      clean(['Total Registered Students',         allStudents.length]),
      clean(['Self-Assessments Completed',        allAssessments.length]),
      clean(['Assessment Completion Rate (%)',    rate]),
      clean([]),
      clean(['AI TEST PERFORMANCE']),
      clean(['AI Test Avg — All Attempts (%)',    perf?.overview?.examAvgAll         ?? 0]),
      clean(['AI Test Avg — First Attempt (%)',   perf?.overview?.examAvgFirstAttempt ?? 0]),
      clean(['Total AI Test Attempts',            perf?.overview?.examTotalAttempts   ?? 0]),
      clean(['Students Who Attempted AI Tests',   perf?.overview?.studentsAttempted   ?? 0]),
      clean([]),
      clean(['CODING TEST PERFORMANCE']),
      clean(['Coding Test Avg (%)',               perf?.overview?.codingAvg              ?? 0]),
      clean(['Coding Test Total Submissions',     perf?.overview?.codingTotalSubmissions ?? 0]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Executive Summary');
    dl(wb, 'Executive_Summary');
  };

  // ── 2. Exam Performance Report (new) ───────────────────────────────────────
  const genExamReport = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Student-wise results
    const studentResultsRows = [
      clean(['AI Exam Results — Student-wise']),
      clean([`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`]),
      clean([]),
      clean(['Student Name', 'Roll Number', 'Program', 'Year', 'Section',
             'Exam Title', 'Subject', 'Score', 'Total', 'Percentage (%)',
             'Time Taken (sec)', 'First Attempt', 'Date']),
    ];
    examResults.forEach((r: any) => {
      const stu = allStudents.find(s => s._id === r.userId?.toString() || s.name === r.userName);
      studentResultsRows.push(clean([
        r.userName,
        stu?.rollNumber || '—',
        stu?.program    || '—',
        stu?.year       || '—',
        stu?.section    || '—',
        r.courseName,
        r.subjectName   || '—',
        r.score,
        r.total,
        Math.round(r.percentage || 0),
        r.timeTaken || 0,
        r.isFirstAttempt ? 'Yes' : 'No',
        fmtDate(r.date),
      ]));
    });
    const ws1 = XLSX.utils.aoa_to_sheet(studentResultsRows);
    ws1['!cols'] = [22, 14, 12, 6, 10, 32, 20, 8, 8, 16, 14, 14, 14].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws1, 'Student Results');

    // Sheet 2: Program-wise breakdown
    const progRows = [
      clean(['Program-wise Exam Performance']),
      clean([]),
      clean(['Program', 'Students', 'Exam Avg (%)', 'Exam Attempts', 'Coding Avg (%)', 'Coding Submissions']),
      ...(perf?.byProgram || []).map((p: any) => clean([
        p.program, p.students, p.examAvg, p.examAttempts, p.codingAvg, p.codingSubmissions,
      ])),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(progRows);
    ws2['!cols'] = [16, 10, 14, 14, 14, 18].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws2, 'Program-wise');

    // Sheet 3: Batch-wise breakdown
    const batchRows = [
      clean(['Batch-wise Exam Performance']),
      clean([]),
      clean(['Batch', 'Students', 'Exam Avg (%)', 'Exam Attempts', 'Coding Avg (%)', 'Coding Submissions']),
      ...(perf?.byBatch || []).map((b: any) => clean([
        b.batch, b.students, b.examAvg, b.examAttempts, b.codingAvg, b.codingSubmissions,
      ])),
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(batchRows);
    ws3['!cols'] = [14, 10, 14, 14, 14, 18].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws3, 'Batch-wise');

    // Sheet 4: Section-wise breakdown
    const secRows = [
      clean(['Section-wise Exam Performance']),
      clean([]),
      clean(['Program', 'Year', 'Section', 'Students', 'Exam Avg (%)', 'Exam Attempts', 'Coding Avg (%)', 'Coding Submissions']),
      ...(perf?.bySection || []).map((s: any) => clean([
        s.program, s.year, s.section, s.students, s.examAvg, s.examAttempts, s.codingAvg, s.codingSubmissions,
      ])),
    ];
    const ws4 = XLSX.utils.aoa_to_sheet(secRows);
    ws4['!cols'] = [14, 6, 10, 10, 14, 14, 14, 18].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws4, 'Section-wise');

    // Sheet 5: Attempt-wise comparison
    const attemptRows = [
      clean(['Attempt-wise Performance (avg score improves with retakes?)']),
      clean([]),
      clean(['Attempt #', 'Avg Score (%)', 'Records']),
      ...(perf?.attemptComparison || []).map((a: any) => clean([a.attempt, a.avgPercentage, a.count])),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(attemptRows), 'Attempt-wise');

    dl(wb, 'Exam_Performance_Report');
  };

  // ── 3. Program Analytics ────────────────────────────────────────────────────
  const genProgramReport = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Program summary with both skill and exam data
    const rows = [
      clean(['Program-wise Analytics Report']),
      clean([`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`]),
      clean([]),
      clean(['Program', 'Students (Assessment)', 'Avg CGPA', 'Avg Communication', 'Avg Technical', 'Avg Leadership',
             'Exam Avg (%)', 'Exam Attempts', 'Coding Avg (%)']),
    ];
    programData.forEach((p: any) => {
      const perfP = (perf?.byProgram || []).find((pp: any) => pp.program === p._id);
      rows.push(clean([
        p._id, p.count,
        +(p.avgCGPA || 0).toFixed(2),
        +(p.avgComm || 0).toFixed(2),
        +(p.avgTech || 0).toFixed(2),
        +(p.avgLead || 0).toFixed(2),
        perfP?.examAvg         ?? '—',
        perfP?.examAttempts    ?? '—',
        perfP?.codingAvg       ?? '—',
      ]));
    });
    const ws1 = XLSX.utils.aoa_to_sheet(rows);
    ws1['!cols'] = [14, 20, 10, 20, 16, 16, 14, 14, 14].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws1, 'Program Overview');

    // Sheet 2: Skill heatmap
    const hRows = [
      clean(['Skill Heatmap (Average Score out of 5)']),
      clean([]),
      clean(['Program', ...SKILL_KEYS.map(s => s.label), 'Students']),
      ...heatmap.map((h: any) => clean([
        h._id,
        ...SKILL_KEYS.map(s => +(h[s.key] || 0).toFixed(2)),
        h.count,
      ])),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(hRows);
    ws2['!cols'] = [14, ...SKILL_KEYS.map(() => 18), 10].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws2, 'Skill Heatmap');
    dl(wb, 'Program_Analytics');
  };

  // ── 4. Student Masterlist ──────────────────────────────────────────────────
  const genStudentMasterlist = () => {
    const wb = XLSX.utils.book_new();

    // Build per-student exam summary map
    const examByStudent: Record<string, { count: number; avg: number; best: number }> = {};
    examResults.forEach((r: any) => {
      const key = r.userId?.toString() || r.userName;
      if (!examByStudent[key]) examByStudent[key] = { count: 0, avg: 0, best: 0 };
      examByStudent[key].count++;
      examByStudent[key].avg  = Math.round(
        (examByStudent[key].avg * (examByStudent[key].count - 1) + (r.percentage || 0)) / examByStudent[key].count
      );
      examByStudent[key].best = Math.max(examByStudent[key].best, r.percentage || 0);
    });

    // Sheet 1: All students with exam summary
    const stuRows = [
      clean(['Student Masterlist with Exam Performance']),
      clean([`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`]),
      clean([]),
      clean(['Name', 'Roll Number', 'Program', 'Year', 'Section', 'Batch', 'Email',
             'AI Tests Taken', 'AI Test Avg (%)', 'AI Test Best (%)', 'Assessment Done']),
    ];
    const assessed = new Set(allAssessments.map((a: any) => a.rollNumber));
    allStudents.forEach((s: any) => {
      const ex = examByStudent[s._id] || examByStudent[s.name] || null;
      stuRows.push(clean([
        s.name, s.rollNumber, s.program, s.year, s.section, s.batch, s.email,
        ex ? ex.count : 0,
        ex ? ex.avg   : '—',
        ex ? Math.round(ex.best) : '—',
        assessed.has(s.rollNumber) ? 'Yes' : 'No',
      ]));
    });
    const ws1 = XLSX.utils.aoa_to_sheet(stuRows);
    ws1['!cols'] = [22, 14, 12, 6, 10, 12, 28, 14, 16, 16, 16].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws1, 'All Students');

    // Sheet 2: Students with assessment data
    const aRows = [
      clean(['Students with Completed Self-Assessment']),
      clean([]),
      clean(['Name', 'Roll Number', 'Program', 'Year', 'Section', 'CGPA', 'Career Aspiration']),
      ...allAssessments.map((a: any) => clean([
        a.studentName, a.rollNumber,
        a.sectionA?.program, a.sectionA?.yearOfStudy, a.sectionA?.section,
        a.sectionA?.cgpa, a.sectionA?.careerAspiration,
      ])),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(aRows);
    ws2['!cols'] = [22, 14, 12, 6, 10, 8, 24].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws2, 'With Assessment');

    // Sheet 3: Students pending assessment
    const notAssessed = allStudents.filter((s: any) => !assessed.has(s.rollNumber));
    const naRows = [
      clean(['Students Pending Self-Assessment']),
      clean([]),
      clean(['Name', 'Roll Number', 'Program', 'Year', 'Section', 'Email']),
      ...notAssessed.map((s: any) => clean([s.name, s.rollNumber, s.program, s.year, s.section, s.email])),
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(naRows);
    ws3['!cols'] = [22, 14, 12, 6, 10, 28].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws3, 'Pending Assessment');
    dl(wb, 'Student_Masterlist');
  };

  // ── 5. Career & Training ───────────────────────────────────────────────────
  const genCareerReport = () => {
    const wb   = XLSX.utils.book_new();
    const rows = [
      clean(['Career Aspirations & Training Demand Report']),
      clean([`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`]),
      clean([]),
      clean(['CAREER ASPIRATIONS']),
      clean(['Career Path', 'Student Count']),
      ...aspirations.map((a: any) => clean([a._id, a.count])),
      clean([]),
      clean(['TOP TRAINING DEMANDS']),
      clean(['Training Type', 'Demand Count']),
      ...training.map((t: any) => clean([t._id, t.count])),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Career & Training');
    dl(wb, 'Career_Training_Report');
  };

  // ── Report cards ────────────────────────────────────────────────────────────
  const REPORTS = [
    {
      id: 'executive',
      title: 'Executive Summary',
      description: 'High-level KPIs — students, assessment completion, AI test averages, coding test averages.',
      icon: FileText,
      color: 'from-blue-500 to-indigo-600',
      generate: genExecutiveSummary,
    },
    {
      id: 'exam',
      title: 'Exam Performance Report',
      description: 'Detailed AI test results per student + program-wise, batch-wise, section-wise and attempt-wise breakdown.',
      icon: ClipboardList,
      color: 'from-rose-500 to-pink-600',
      generate: genExamReport,
    },
    {
      id: 'program',
      title: 'Program Analytics',
      description: 'Skill heatmap (9 competencies) + exam and coding averages per program.',
      icon: BarChart2,
      color: 'from-violet-500 to-purple-600',
      generate: genProgramReport,
    },
    {
      id: 'students',
      title: 'Student Masterlist',
      description: 'All students with AI test summary, assessment status — assessed and pending sheets included.',
      icon: Users,
      color: 'from-emerald-500 to-teal-600',
      generate: genStudentMasterlist,
    },
    {
      id: 'career',
      title: 'Career & Training Report',
      description: 'Career aspiration distribution and top training demands across all programs.',
      icon: Target,
      color: 'from-amber-500 to-orange-600',
      generate: genCareerReport,
    },
  ];

  const handleGenerate = async (report: typeof REPORTS[0]) => {
    setGenerating(report.id);
    try { report.generate(); }
    catch (e: any) { toast({ title: 'Failed to generate report', description: e.message, variant: 'destructive' }); }
    finally { setGenerating(null); }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
    </div>
  );

  const totalStudents  = allStudents.length;
  const totalAssessed  = allAssessments.length;
  const completionRate = totalStudents ? Math.round((totalAssessed / totalStudents) * 100) : 0;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg">
            <Download className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
            <p className="text-slate-500 text-sm">Download institution-wide reports as Excel spreadsheets</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5 rounded-xl">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh Data
        </Button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Students',   value: totalStudents,                           icon: Users,        color: 'bg-blue-50 text-blue-600' },
          { label: 'Assessments Done', value: totalAssessed,                           icon: CheckCircle2, color: 'bg-green-50 text-green-600' },
          { label: 'Completion Rate',  value: `${completionRate}%`,                    icon: TrendingUp,   color: 'bg-indigo-50 text-indigo-600' },
          { label: 'AI Test Attempts', value: perf?.overview?.examTotalAttempts ?? 0,  icon: ClipboardList,color: 'bg-rose-50 text-rose-600' },
        ].map(s => (
          <Card key={s.label} className="border-slate-200 shadow-sm">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${s.color}`}><s.icon className="h-5 w-5" /></div>
              <div>
                <p className="text-xl font-bold text-slate-900">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Report cards */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" /> Available Reports (Excel .xlsx)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {REPORTS.map(report => {
            const Icon = report.icon;
            const busy = generating === report.id;
            return (
              <Card key={report.id} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${report.color} text-white shadow flex-shrink-0`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900">{report.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{report.description}</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleGenerate(report)}
                    disabled={!!generating || loading}
                    className="w-full gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white h-9 text-sm"
                  >
                    {busy
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                      : <><Download className="h-4 w-4" /> Download</>}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
        <FileSpreadsheet className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <p>All reports are generated from live data and downloaded directly to your device. No data is sent to any external server.</p>
      </div>
    </div>
  );
}
