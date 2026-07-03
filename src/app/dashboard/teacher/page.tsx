'use client';

import { useEffect, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { getCurrentUser } from '@/lib/mock-db';
import { format } from 'date-fns';
import {
  GraduationCap, MessageSquare,
  Send, Search, Users, BarChart2,
  ChevronRight, Eye,
  Download, FileSpreadsheet, Code2, Loader2, Filter, X,
  LineChart, TrendingUp, AlertTriangle,
} from 'lucide-react';
import { AITestComparison } from '@/components/dashboard/AITestComparison';

// ── Types ─────────────────────────────────────────────────────────────────────
interface AptitudeAttempt {
  _id: string; userName: string; topic: string;
  score: number; total: number; percentage: number; timeTaken: number;
  answers: number[]; correctAnswers: number[]; questions: any[];
  date: string;
}

function fmt(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}
function pctColor(p: number) {
  return p >= 80 ? 'text-green-600' : p >= 60 ? 'text-yellow-600' : 'text-red-500';
}

// ── Excel helpers ─────────────────────────────────────────────────────────────
function setColWidths(ws: XLSX.WorkSheet, widths: number[]) {
  ws['!cols'] = widths.map(w => ({ wch: w }));
}

function getFirstAptAttemptsForUser(attempts: AptitudeAttempt[], userName: string): AptitudeAttempt[] {
  const userAttempts = attempts.filter(a => a.userName === userName);
  const map = new Map<string, AptitudeAttempt>();
  [...userAttempts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .forEach(a => { if (!map.has(a.topic)) map.set(a.topic, a); });
  return Array.from(map.values());
}

// ── Download: Full Class Report ───────────────────────────────────────────────
function downloadClassReport(students: any[], aptAttempts: AptitudeAttempt[], examResults: any[]) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Class Overview
  const overviewRows: any[][] = [
    ['SRM PrepTrack — Student Performance Report'],
    [`Generated on: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`],
    [],
    ['#', 'Student Name', 'Roll Number', 'Program', 'Year', 'Section',
     'AI Tests Taken', 'AI Test Avg (%)', 'AI Test Best (%)',
     'Aptitude Tests Taken', 'Aptitude Avg (%)',
     'Overall Avg (%)', 'Status'],
  ];

  students.forEach((student, idx) => {
    // AI test results (ExamResult) — match by userId or userName
    const sExam    = examResults.filter(r => r.userId?.toString() === (student._id || student.id) || r.userName === student.name);
    const examAvg  = sExam.length ? Math.round(sExam.reduce((a, r) => a + (r.percentage || 0), 0) / sExam.length) : null;
    const examBest = sExam.length ? Math.round(Math.max(...sExam.map(r => r.percentage || 0))) : null;

    // Aptitude Arena results
    const sApt    = aptAttempts.filter(a => a.userName === student.name);
    const aptAvg  = sApt.length ? Math.round(sApt.reduce((a, e) => a + e.percentage, 0) / sApt.length) : null;

    const scores  = [examAvg, aptAvg].filter(s => s !== null) as number[];
    const overall = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const status  = overall !== null
      ? overall >= 80 ? 'Excellent' : overall >= 60 ? 'Satisfactory' : 'Needs Improvement'
      : 'No Data';

    overviewRows.push([
      idx + 1,
      student.name,
      student.rollNumber || '—',
      student.program    || '—',
      student.year       || '—',
      student.section    || '—',
      sExam.length,
      examAvg  !== null ? examAvg  : '—',
      examBest !== null ? examBest : '—',
      sApt.length,
      aptAvg   !== null ? aptAvg   : '—',
      overall  !== null ? overall  : '—',
      status,
    ]);
  });

  const ws1 = XLSX.utils.aoa_to_sheet(overviewRows);
  ws1['A1'] = { t: 's', v: 'SRM PrepTrack — Student Performance Report', s: { font: { bold: true, sz: 14, color: { rgb: '4F46E5' } } } };
  ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 12 } }];
  setColWidths(ws1, [4, 22, 14, 12, 6, 10, 14, 16, 16, 18, 16, 16, 20]);
  XLSX.utils.book_append_sheet(wb, ws1, 'Class Overview');

  // Sheet 2: AI Test Results
  if (examResults.length > 0) {
    const examRows: any[][] = [
      ['Student Name', 'Roll Number', 'Exam Title', 'Subject', 'Score', 'Total', 'Percentage (%)', 'Time Taken', 'Date'],
    ];
    examResults.forEach(r => {
      const student = students.find(s => s._id === r.userId?.toString() || s.name === r.userName);
      examRows.push([
        r.userName, student?.rollNumber || '—', r.courseName, r.subjectName || '—',
        r.score, r.total, Math.round(r.percentage || 0),
        fmt(r.timeTaken || 0), r.date ? format(new Date(r.date), 'dd/MM/yyyy') : '—',
      ]);
    });
    const ws2 = XLSX.utils.aoa_to_sheet(examRows);
    setColWidths(ws2, [22, 14, 30, 20, 8, 8, 16, 12, 14]);
    XLSX.utils.book_append_sheet(wb, ws2, 'AI Test Results');
  }

  // Sheet 3: Aptitude Results
  if (aptAttempts.length > 0) {
    const aptRows: any[][] = [
      ['Student Name', 'Topic', 'Score', 'Total', 'Percentage (%)', 'Time Taken', 'Date'],
    ];
    aptAttempts.forEach(a => {
      aptRows.push([
        a.userName, a.topic, a.score, a.total,
        Math.round(a.percentage), fmt(a.timeTaken),
        format(new Date(a.date), 'dd/MM/yyyy'),
      ]);
    });
    const ws3 = XLSX.utils.aoa_to_sheet(aptRows);
    setColWidths(ws3, [22, 30, 8, 8, 16, 12, 14]);
    XLSX.utils.book_append_sheet(wb, ws3, 'Aptitude Arena Results');
  }

  XLSX.writeFile(wb, `SRM_ClassReport_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

// ── Download: Single Student Report ──────────────────────────────────────────
function downloadStudentReport(student: any, aptAttempts: AptitudeAttempt[], examResults: any[] = []) {
  const wb       = XLSX.utils.book_new();
  const selApt   = aptAttempts.filter(a => a.userName === student.name);
  const firstApt = getFirstAptAttemptsForUser(aptAttempts, student.name);
  const selExam  = examResults.filter(r => r.userId?.toString() === (student._id || student.id) || r.userName === student.name);

  const aptAvg   = selApt.length   ? Math.round(selApt.reduce((a, e) => a + e.percentage, 0) / selApt.length)   : null;
  const firstAvg = firstApt.length ? Math.round(firstApt.reduce((a, e) => a + e.percentage, 0) / firstApt.length) : null;
  const examAvg  = selExam.length  ? Math.round(selExam.reduce((a, r) => a + (r.percentage || 0), 0) / selExam.length) : null;
  const examBest = selExam.length  ? Math.round(Math.max(...selExam.map(r => r.percentage || 0))) : null;

  // Sheet 1: Summary
  const summaryRows = [
    [`Student Report — ${student.name}`],
    [`Roll Number: ${student.rollNumber || '—'}`],
    [`Program: ${student.program || '—'}  |  Year: ${student.year || '—'}  |  Section: ${student.section || '—'}`],
    [`Email: ${student.email}`],
    [`Report Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`],
    [],
    ['Module', 'Performance', 'Details'],
    ['AI Scheduled Tests',            examAvg  !== null ? `${examAvg}% avg  |  Best: ${examBest}%` : 'Not taken', `${selExam.length} attempt(s)`],
    ['Aptitude Arena (All Attempts)', aptAvg   !== null ? `${aptAvg}% average`                      : 'Not taken', `${selApt.length} attempt(s)`],
    ['Aptitude Arena (1st Attempt)',  firstAvg !== null ? `${firstAvg}% first attempt avg`           : 'Not taken', `${firstApt.length} topic(s)`],
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws1['A1'] = { t: 's', v: `Student Report — ${student.name}`, s: { font: { bold: true, sz: 14, color: { rgb: '4F46E5' } } } };
  ws1['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 2 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: 2 } },
  ];
  setColWidths(ws1, [28, 30, 30]);
  XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

  // Sheet 2: AI Test Results
  if (selExam.length > 0) {
    const examRows: any[][] = [
      [`AI Test Results — ${student.name}`],
      [],
      ['Exam Title', 'Subject', 'Score', 'Total', 'Percentage (%)', 'Time Taken', 'Date'],
    ];
    selExam.forEach(r => {
      examRows.push([
        r.courseName, r.subjectName || '—', r.score, r.total,
        Math.round(r.percentage || 0), fmt(r.timeTaken || 0),
        r.date ? format(new Date(r.date), 'dd/MM/yyyy') : '—',
      ]);
    });
    const wsExam = XLSX.utils.aoa_to_sheet(examRows);
    setColWidths(wsExam, [32, 20, 8, 8, 16, 12, 14]);
    XLSX.utils.book_append_sheet(wb, wsExam, 'AI Test Results');
  }

  // Sheet 3: Aptitude Attempts with question-level detail
  if (selApt.length > 0) {
    const aptRows: any[][] = [
      [`Aptitude Results — ${student.name}`],
      [],
      ['Topic', 'Score', 'Total', 'Percentage (%)', 'Time Taken', 'Date'],
    ];
    selApt.forEach(a => {
      aptRows.push([a.topic, a.score, a.total, Math.round(a.percentage), fmt(a.timeTaken), format(new Date(a.date), 'dd/MM/yyyy')]);
    });

    aptRows.push([], ['— Detailed Question Analysis —']);
    selApt.forEach((a, ai) => {
      aptRows.push([]);
      aptRows.push([`Attempt ${ai + 1}: ${a.topic} — ${format(new Date(a.date), 'dd/MM/yyyy')} — Score: ${a.score}/${a.total} (${Math.round(a.percentage)}%)`]);
      aptRows.push(['Q#', 'Question', 'Sub-Topic', 'Student Answer', 'Correct Answer', 'Result']);
      a.questions?.forEach((q: any, qi: number) => {
        const ua      = a.answers[qi];
        const correct = a.correctAnswers[qi];
        const isSkip  = ua === -1;
        const isRight = ua === correct;
        aptRows.push([
          qi + 1, q.question, q.topic ?? '',
          isSkip ? 'Skipped' : q.options?.[ua] ?? `Option ${ua + 1}`,
          q.options?.[correct] ?? `Option ${correct + 1}`,
          isSkip ? 'Skipped' : isRight ? 'Correct ✓' : 'Wrong ✗',
        ]);
      });
    });

    const ws2 = XLSX.utils.aoa_to_sheet(aptRows);
    setColWidths(ws2, [30, 8, 8, 16, 12, 14]);
    XLSX.utils.book_append_sheet(wb, ws2, 'Aptitude Results');
  }

  const safeN = student.name.replace(/[^a-z0-9]/gi, '_');
  XLSX.writeFile(wb, `SRM_Report_${safeN}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

// ─────────────────────────────────────────────────────────────────────────────
export default function TeacherDashboard() {
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [students, setStudents]               = useState<any[]>([]);
  const [aptAttempts, setAptAttempts]         = useState<AptitudeAttempt[]>([]);
  const [searchQuery, setSearchQuery]         = useState('');
  const [filterProgram, setFilterProgram]     = useState('');
  const [filterYear, setFilterYear]           = useState('');
  const [filterSection, setFilterSection]     = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [feedbackMsg, setFeedbackMsg]         = useState('');
  const [sendingFb, setSendingFb]             = useState(false);
  const [downloading, setDownloading]         = useState(false);
  const [codingTests, setCodingTests]         = useState<any[]>([]);
  const [codingResults, setCodingResults]     = useState<Record<string, any[]>>({});
  const [codingLoading, setCodingLoading]     = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [expandedTestId, setExpandedTestId]   = useState<string | null>(null);
  const [perf, setPerf]                       = useState<any>(null);
  const [examResults, setExamResults]         = useState<any[]>([]);
  const [skillGapLoading, setSkillGapLoading] = useState(true);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Students
    (async () => {
      try {
        setStudentsLoading(true);
        const res = await fetch('/api/users?role=student');
        const list: any[] = res.ok ? await res.json() : [];
        setStudents(list);
      } catch (e) { console.error('Failed to load students:', e); }
      finally { setStudentsLoading(false); }
    })();

    // All aptitude results (for Excel reports + skill gap)
    (async () => {
      try {
        const res = await fetch('/api/aptitude-results');
        const data = await res.json();
        setAptAttempts(Array.isArray(data) ? data : []);
      } catch (e) { console.error('Failed to load aptitude results:', e); }
    })();

    // Exam results (for skill gap analysis)
    (async () => {
      try {
        const res = await fetch('/api/exam-results');
        const data = await res.json();
        setExamResults(Array.isArray(data) ? data : []);
      } catch (e) { console.error('Failed to load exam results:', e); }
      finally { setSkillGapLoading(false); }
    })();

    // Coding tests
    (async () => {
      try {
        setCodingLoading(true);
        const teacher   = getCurrentUser() as any;
        const teacherId = teacher?._id || teacher?.id;
        if (!teacherId) return;
        const res  = await fetch(`/api/coding-tests?teacherId=${teacherId}`);
        const data = await res.json();
        const tests = Array.isArray(data) ? data : [];
        setCodingTests(tests);
        const resultsMap: Record<string, any[]> = {};
        await Promise.all(tests.map(async (t: any) => {
          const r    = await fetch(`/api/coding-tests/${t._id}/results`);
          const subs = await r.json();
          resultsMap[t._id] = Array.isArray(subs) ? subs : [];
        }));
        setCodingResults(resultsMap);
      } catch (e) { console.error(e); }
      finally { setCodingLoading(false); }
    })();

    // Performance analytics
    (async () => {
      try {
        const teacher   = getCurrentUser() as any;
        const teacherId = teacher?._id || teacher?.id;
        const url = teacherId
          ? `/api/analytics/performance?teacherId=${teacherId}`
          : '/api/analytics/performance';
        const res = await fetch(url);
        if (res.ok) setPerf(await res.json());
      } catch (e) { console.error(e); }
    })();
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const programs = [...new Set(students.map(s => s.program).filter(Boolean))].sort();
  const years    = [...new Set(students.map(s => String(s.year)).filter(Boolean))].sort();
  const sections = [...new Set(students.map(s => s.section).filter(Boolean))].sort();

  // Class average score from local data (avoids API scoping issues)
  const classAvgScore = aptAttempts.length
    ? Math.round(aptAttempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / aptAttempts.length)
    : null;

  const filtered = students.filter(s => {
    const q = searchQuery.toLowerCase();
    if (q && !s.name?.toLowerCase().includes(q) && !s.email?.toLowerCase().includes(q) && !s.rollNumber?.toLowerCase().includes(q)) return false;
    if (filterProgram && s.program !== filterProgram) return false;
    if (filterYear    && String(s.year) !== filterYear) return false;
    if (filterSection && s.section !== filterSection) return false;
    return true;
  });
  const hasFilters = searchQuery || filterProgram || filterYear || filterSection;

  // ── Skill Gap Derivations ─────────────────────────────────────────────────
  const rollByName = new Map(students.map(s => [s.name, s.rollNumber || '']));

  const codingTestGaps = (() => {
    const map = new Map<string, { total: number; sum: number; weak: { name: string; roll: string }[] }>();
    codingTests.forEach(t => {
      const subs = codingResults[t._id] || [];
      subs.forEach((r: any) => {
        const pct = r.totalMarks > 0 ? Math.round((r.obtainedMarks / r.totalMarks) * 100) : 0;
        const entry = map.get(t.title) ?? { total: 0, sum: 0, weak: [] };
        entry.total += 1;
        entry.sum   += pct;
        if (pct < 60 && r.studentName && !entry.weak.find(w => w.name === r.studentName))
          entry.weak.push({ name: r.studentName, roll: r.rollNumber || '' });
        map.set(t.title, entry);
      });
    });
    return Array.from(map.entries())
      .map(([title, d]) => ({ subject: title, avg: Math.round(d.sum / d.total), attempts: d.total, weak: d.weak }))
      .sort((a, b) => a.avg - b.avg);
  })();

  const examSubjectGaps = (() => {
    const map = new Map<string, { total: number; sum: number; weak: { name: string; roll: string }[] }>();
    examResults.forEach(r => {
      const subj = r.subjectName || r.courseName || 'Unknown';
      const entry = map.get(subj) ?? { total: 0, sum: 0, weak: [] };
      entry.total += 1;
      entry.sum   += r.percentage || 0;
      if ((r.percentage || 0) < 60 && r.userName && !entry.weak.find(w => w.name === r.userName))
        entry.weak.push({ name: r.userName, roll: rollByName.get(r.userName) || '' });
      map.set(subj, entry);
    });
    return Array.from(map.entries())
      .map(([subject, d]) => ({ subject, avg: Math.round(d.sum / d.total), attempts: d.total, weak: d.weak }))
      .sort((a, b) => a.avg - b.avg);
  })();

  // ── Download handlers ─────────────────────────────────────────────────────
  const handleDownloadClass = async () => {
    setDownloading(true);
    try {
      const [aptRes, examRes] = await Promise.all([
        fetch('/api/aptitude-results').then(r => r.json()),
        fetch('/api/exam-results').then(r => r.json()),
      ]);
      const freshApt: AptitudeAttempt[] = Array.isArray(aptRes)  ? aptRes  : aptAttempts;
      const freshExam: any[]            = Array.isArray(examRes) ? examRes : [];
      downloadClassReport(students, freshApt, freshExam);
      toast({ title: 'Class report downloaded', description: 'Check your Downloads folder.' });
    } catch (e) {
      toast({ title: 'Download failed', variant: 'destructive' });
    } finally { setDownloading(false); }
  };

  const handleDownloadStudent = async (student: any) => {
    try {
      const uid = student._id || student.id;
      const [aptRes, examRes] = await Promise.all([
        fetch(`/api/aptitude-results${uid ? `?userId=${uid}` : ''}`).then(r => r.json()),
        fetch(`/api/exam-results${uid ? `?userId=${uid}` : ''}`).then(r => r.json()),
      ]);
      const studentApt: AptitudeAttempt[] = Array.isArray(aptRes)  ? aptRes  : aptAttempts.filter(a => a.userName === student.name);
      const studentExam: any[]            = Array.isArray(examRes) ? examRes : [];
      downloadStudentReport(student, studentApt, studentExam);
      toast({ title: `${student.name}'s report downloaded` });
    } catch (e) {
      toast({ title: 'Download failed', variant: 'destructive' });
    }
  };

  // ── Send feedback ─────────────────────────────────────────────────────────
  const sendFeedback = async () => {
    if (!selectedStudent || !feedbackMsg.trim()) return;
    setSendingFb(true);
    try {
      const teacher = getCurrentUser();
      if (!teacher) return;
      const { db } = await import('@/lib/mock-db');
      await db.createTeacherFeedback({
        teacherId: (teacher as any)._id || (teacher as any).id,
        studentId: selectedStudent._id || selectedStudent.id,
        message:   feedbackMsg,
        date:      new Date().toISOString(),
        read:      false,
      });
      toast({ title: 'Feedback sent', description: `Sent to ${selectedStudent.name}` });
      setFeedbackMsg('');
    } catch {
      toast({ title: 'Error sending feedback', variant: 'destructive' });
    } finally { setSendingFb(false); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-headline font-bold text-primary">Student Performance Hub</h1>
          <p className="text-sm text-muted-foreground">Evaluate students across all modules and send targeted feedback.</p>
        </div>
        <Button
          onClick={handleDownloadClass}
          disabled={downloading || students.length === 0}
          className="bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-sm flex items-center gap-2 whitespace-nowrap"
        >
          <FileSpreadsheet className="h-4 w-4" />
          {downloading ? 'Generating…' : 'Download Class Report'}
        </Button>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: 'Total Students',
            value: studentsLoading ? '…' : students.length,
            icon: Users, color: 'text-blue-600 bg-blue-50',
          },
          {
            label: 'Avg Aptitude Score',
            value: classAvgScore !== null ? `${classAvgScore}%` : aptAttempts.length === 0 && perf !== null ? 'No data' : '…',
            icon: TrendingUp, color: 'text-violet-600 bg-violet-50',
          },
          {
            label: 'Coding Submissions',
            value: Object.values(codingResults).reduce((s, r) => s + r.length, 0),
            icon: Code2, color: 'text-indigo-600 bg-indigo-50',
          },
        ].map(s => (
          <Card key={s.label} className="border-slate-200 shadow-sm">
            <CardContent className="flex items-center gap-3 pt-4 pb-4">
              <div className={`p-2.5 rounded-xl ${s.color}`}><s.icon className="h-4 w-4" /></div>
              <div>
                <p className="text-lg font-bold text-slate-900">{s.value}</p>
                <p className="text-[11px] text-slate-500">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="students" className="w-full">
        <TabsList className="mb-2">
          <TabsTrigger value="students" className="flex items-center gap-1.5">
            <GraduationCap className="h-4 w-4" /> Class Overview
          </TabsTrigger>
          <TabsTrigger value="progress" className="flex items-center gap-1.5">
            <LineChart className="h-4 w-4" /> AI Progress
          </TabsTrigger>
          <TabsTrigger value="coding" className="flex items-center gap-1.5">
            <Code2 className="h-4 w-4" /> Coding Tests
          </TabsTrigger>
          <TabsTrigger value="skillgap" className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" /> Skill Gap
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Class Overview ── */}
        <TabsContent value="students">
          <Card className="border-none shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="font-headline flex items-center gap-2 text-base">
                  <GraduationCap className="h-4 w-4" /> Class Overview
                  {hasFilters && (
                    <Badge className="ml-1 bg-indigo-100 text-indigo-700 text-xs font-normal">
                      {filtered.length} of {students.length}
                    </Badge>
                  )}
                </CardTitle>
                {hasFilters && (
                  <Button variant="ghost" size="sm" className="text-xs gap-1 text-slate-500"
                    onClick={() => { setSearchQuery(''); setFilterProgram(''); setFilterYear(''); setFilterSection(''); }}>
                    <X className="h-3.5 w-3.5" /> Clear filters
                  </Button>
                )}
              </div>
              <CardDescription className="text-xs">
                Click <strong>View</strong> to see student details and send feedback.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filter bar */}
              <div className="flex flex-wrap gap-2 mb-3">
                <div className="relative flex-1 min-w-40">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search name, email or roll no…"
                    className="pl-9 h-9 rounded-xl text-sm"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={filterProgram || '__all__'} onValueChange={v => setFilterProgram(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="h-9 w-36 rounded-xl text-sm">
                    <Filter className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                    <SelectValue placeholder="Program" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Programs</SelectItem>
                    {programs.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterYear || '__all__'} onValueChange={v => setFilterYear(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="h-9 w-28 rounded-xl text-sm">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Years</SelectItem>
                    {years.map(y => <SelectItem key={y} value={y}>Year {y}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterSection || '__all__'} onValueChange={v => setFilterSection(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="h-9 w-32 rounded-xl text-sm">
                    <SelectValue placeholder="Section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Sections</SelectItem>
                    {sections.map(s => <SelectItem key={s} value={s}>Section {s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="overflow-x-auto">
                {studentsLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Roll No.</TableHead>
                        <TableHead>Batch / Section</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            No students found.
                          </TableCell>
                        </TableRow>
                      ) : filtered.map(student => (
                        <TableRow key={student._id || student.id}>
                          <TableCell>
                            <div className="font-medium">{student.name}</div>
                            <div className="text-xs text-muted-foreground">{student.email}</div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-mono text-slate-600">{student.rollNumber || '—'}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {student.program && <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">{student.program}</Badge>}
                              {student.year    && <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">Y{student.year}</Badge>}
                              {student.section && <Badge variant="outline" className="text-[10px] bg-violet-50 text-violet-700 border-violet-200">§{student.section}</Badge>}
                              {!student.program && !student.year && !student.section && <span className="text-xs text-slate-400">—</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="sm"
                                onClick={() => { setSelectedStudent(student); setFeedbackMsg(''); }}>
                                <Eye className="h-4 w-4 mr-1" />View
                              </Button>
                              <Button variant="outline" size="sm"
                                onClick={() => handleDownloadStudent(student)}
                                className="text-green-700 border-green-300 hover:bg-green-50"
                                title="Download student Excel report">
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2: AI Progress ── */}
        <TabsContent value="progress">
          <AITestComparison />
        </TabsContent>

        {/* ── Tab 3: Coding Tests ── */}
        <TabsContent value="coding">
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2 text-base">
                <Code2 className="h-4 w-4" /> Coding Test Reports
              </CardTitle>
              <CardDescription className="text-xs">
                Click a test to expand and view per-student scores.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {codingLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                </div>
              ) : codingTests.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No coding tests scheduled yet.</p>
              ) : (
                <div className="space-y-3">
                  {codingTests.map(t => {
                    const totalMarks = (t.problems || []).reduce((s: number, p: any) => s + (p.marks || 0), 0);
                    const subs  = codingResults[t._id] || [];
                    const isOpen = expandedTestId === t._id;
                    return (
                      <div key={t._id} className="border border-slate-200 rounded-xl overflow-hidden">
                        <button type="button"
                          onClick={() => setExpandedTestId(isOpen ? null : t._id)}
                          className="w-full flex items-center justify-between gap-3 p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-slate-900 text-sm">{t.title}</p>
                            <Badge variant="outline" className="text-[10px]">{(t.problems || []).length} problem(s)</Badge>
                            <Badge variant="outline" className="text-[10px]">Total: {totalMarks} marks</Badge>
                            <Badge className="text-[10px] bg-emerald-100 text-emerald-700">{subs.length} submission(s)</Badge>
                          </div>
                          <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                        </button>
                        {isOpen && (
                          <div className="p-3 space-y-2">
                            {subs.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">No submissions yet.</p>
                            ) : (
                              subs.slice().sort((a: any, b: any) => b.obtainedMarks - a.obtainedMarks).map((r: any) => (
                                <div key={r._id} className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-medium text-sm text-slate-900">{r.studentName}</p>
                                    <span className="text-xs text-slate-400">{r.rollNumber}</span>
                                    {r.section && <Badge variant="outline" className="text-[10px]">{r.program} Y{r.year} §{r.section}</Badge>}
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                      {r.obtainedMarks}/{r.totalMarks} marks
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-2 text-xs text-slate-500 mt-1">
                                    {(r.answers || []).map((a: any) => {
                                      const p = (t.problems || []).find((x: any) => x.problemId === a.problemId);
                                      return (
                                        <span key={a.problemId} className="px-2 py-0.5 rounded-full bg-white border border-slate-200">
                                          {p?.title || 'Problem'}: {a.marksAwarded}/{p?.marks ?? 0} ({a.passedCount}/{a.totalCount} tests)
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 4: Skill Gap Analysis ── */}
        <TabsContent value="skillgap">
          <div className="space-y-4">
            {skillGapLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-violet-500" /></div>
            ) : (
              <>
                {/* Exam Subject Gaps */}
                <Card className="border-none shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="font-headline flex items-center gap-2 text-base">
                      <BarChart2 className="h-4 w-4 text-indigo-500" /> AI Test — Subject-wise Performance
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Average score per subject across all students. Subjects below 60% indicate a skill gap.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {examSubjectGaps.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No exam results available yet.</p>
                    ) : (
                      <div className="space-y-4">
                        {examSubjectGaps.map(({ subject, avg, attempts, weak }) => {
                          const bar = `${avg}%`;
                          const color = avg >= 70 ? 'bg-green-500' : avg >= 50 ? 'bg-yellow-400' : 'bg-red-500';
                          const label = avg >= 70 ? 'text-green-700' : avg >= 50 ? 'text-yellow-700' : 'text-red-600';
                          return (
                            <div key={subject} className="space-y-1.5">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium text-slate-800 truncate max-w-[60%]">{subject}</span>
                                <div className="flex items-center gap-3 shrink-0">
                                  {weak.length > 0 && (
                                    <span className="text-xs text-red-500 flex items-center gap-1">
                                      <AlertTriangle className="h-3 w-3" /> {weak.length} student{weak.length > 1 ? 's' : ''} &lt;60%
                                    </span>
                                  )}
                                  <span className={`font-bold text-sm ${label}`}>{avg}%</span>
                                  <span className="text-xs text-slate-400">{attempts} attempt{attempts > 1 ? 's' : ''}</span>
                                </div>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2.5">
                                <div className={`${color} h-2.5 rounded-full transition-all`} style={{ width: bar }} />
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

                {/* Aptitude Topic Gaps */}
                <Card className="border-none shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="font-headline flex items-center gap-2 text-base">
                      <Code2 className="h-4 w-4 text-emerald-500" /> Coding Tests — Performance
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Average score per coding test. Tests below 60% indicate a skill gap.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {codingTestGaps.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No coding test submissions yet.</p>
                    ) : (
                      <div className="space-y-4">
                        {codingTestGaps.map(({ subject, avg, attempts, weak }) => {
                          const bar = `${avg}%`;
                          const color = avg >= 70 ? 'bg-green-500' : avg >= 50 ? 'bg-yellow-400' : 'bg-red-500';
                          const label = avg >= 70 ? 'text-green-700' : avg >= 50 ? 'text-yellow-700' : 'text-red-600';
                          return (
                            <div key={subject} className="space-y-1.5">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium text-slate-800 truncate max-w-[60%]">{subject}</span>
                                <div className="flex items-center gap-3 shrink-0">
                                  {weak.length > 0 && (
                                    <span className="text-xs text-red-500 flex items-center gap-1">
                                      <AlertTriangle className="h-3 w-3" /> {weak.length} student{weak.length > 1 ? 's' : ''} &lt;60%
                                    </span>
                                  )}
                                  <span className={`font-bold text-sm ${label}`}>{avg}%</span>
                                  <span className="text-xs text-slate-400">{attempts} submission{attempts > 1 ? 's' : ''}</span>
                                </div>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2.5">
                                <div className={`${color} h-2.5 rounded-full transition-all`} style={{ width: bar }} />
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
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Student Detail Dialog ── */}
      <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <DialogTitle className="text-xl font-headline flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-primary" />{selectedStudent?.name}
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  {selectedStudent?.rollNumber && <span className="font-mono mr-2">{selectedStudent.rollNumber}</span>}
                  {selectedStudent?.email}
                </DialogDescription>
              </div>
              <Button variant="outline" size="sm"
                onClick={() => selectedStudent && handleDownloadStudent(selectedStudent)}
                className="text-green-700 border-green-300 hover:bg-green-50 rounded-xl flex items-center gap-2">
                <Download className="h-4 w-4" /> Download Report
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 space-y-3" ref={scrollRef}>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <Label className="text-sm font-bold">Send Feedback to {selectedStudent?.name}</Label>
            </div>
            <p className="text-xs text-slate-500">
              Write specific feedback — it appears as a notification on their dashboard.
            </p>
            <Textarea
              placeholder={`e.g. "Good improvement on Data Structures! Focus on linked list deletions for next attempt."`}
              value={feedbackMsg}
              onChange={e => setFeedbackMsg(e.target.value)}
              className="min-h-[100px] rounded-xl"
            />
            {selectedStudent?.feedback?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Previously sent</p>
                {selectedStudent.feedback.slice(0, 3).map((f: any) => (
                  <div key={f._id || f.id} className="p-3 bg-slate-50 rounded-xl border text-xs text-slate-600">
                    <div className="flex justify-between mb-1">
                      <span className="font-semibold text-slate-700">You</span>
                      <span className="text-slate-400">{new Intl.DateTimeFormat('en-GB').format(new Date(f.date))}</span>
                    </div>
                    {f.message}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 shrink-0 border-t mt-2">
            <Button variant="outline" onClick={() => setSelectedStudent(null)}>Close</Button>
            <Button onClick={sendFeedback} disabled={!feedbackMsg.trim() || sendingFb}
              className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {sendingFb ? 'Sending…' : <><Send className="h-4 w-4 mr-2" />Send Feedback</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
