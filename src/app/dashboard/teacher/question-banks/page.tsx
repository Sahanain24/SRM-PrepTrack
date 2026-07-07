'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { getCurrentUser } from '@/lib/mock-db';
import {
  Plus, Trash2, BookOpen, FileText, ChevronRight,
  RefreshCw, HelpCircle, CheckCircle2, FileSpreadsheet,
  Download, Upload, XCircle, Pencil, Eye, CalendarClock,
  Clock, Calendar, Users,
} from 'lucide-react';

const PROGRAMS    = ['BCA', 'BCA(DS)', 'BCom', 'MSc(ADS)', 'MCom', 'MCA', 'MCA GenAI'];
const YEARS       = [1, 2, 3];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;

interface Bank {
  _id: string;
  title: string;
  subject: string;
  programs: string[];
  description: string;
  questionCount: number;
  createdAt: string;
}

interface Question {
  _id: string;
  questionText: string;
  questionType: 'MCQ' | 'TrueFalse';
  options: { label: string; text: string; isCorrect: boolean }[];
  explanation: string;
  marks: number;
  difficulty: string;
  topic: string;
}

const BLANK_BANK = { title: '', subject: '', programs: [] as string[], description: '' };
const BLANK_Q = {
  questionText: '',
  questionType: 'MCQ' as const,
  options: [
    { label: 'A', text: '', isCorrect: false },
    { label: 'B', text: '', isCorrect: false },
    { label: 'C', text: '', isCorrect: false },
    { label: 'D', text: '', isCorrect: false },
  ],
  explanation: '',
  marks: 1,
  difficulty: 'Medium' as const,
  topic: '',
};
const BLANK_SCHEDULE = {
  title: '',
  examDate: '',
  startTime: '',
  durationMins: 60,
  passingMarks: 0,
  targetPrograms: [] as string[],
  targetYears: [] as number[],
  targetBatches: '',
  shuffleQuestions: false,
  shuffleOptions: false,
  showResultImmediately: true,
};

export default function QuestionBanksPage() {
  const { toast } = useToast();
  const teacherId = (getCurrentUser() as any)?._id || (getCurrentUser() as any)?.id || '';
  const xlFileRef = useRef<HTMLInputElement>(null);

  const [banks,      setBanks]      = useState<Bank[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [activeBank, setActiveBank] = useState<Bank | null>(null);
  const [questions,  setQuestions]  = useState<Question[]>([]);
  const [qLoading,   setQLoading]   = useState(false);

  // Bank dialog
  const [bankOpen,   setBankOpen]   = useState(false);
  const [bankSaving, setBankSaving] = useState(false);
  const [newBank,    setNewBank]    = useState(BLANK_BANK);

  // Add/Edit question dialog
  const [qOpen,      setQOpen]      = useState(false);
  const [qSaving,    setQSaving]    = useState(false);
  const [editingQ,   setEditingQ]   = useState<Question | null>(null); // null = add mode
  const [qForm,      setQForm]      = useState(BLANK_Q);

  // Preview dialog
  const [previewQ,   setPreviewQ]   = useState<Question | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);

  // Schedule dialog
  const [schedOpen,   setSchedOpen]   = useState(false);
  const [schedSaving, setSchedSaving] = useState(false);
  const [schedule,    setSchedule]    = useState(BLANK_SCHEDULE);

  // Excel import
  const allRowsRef                  = useRef<any[]>([]);
  const [xlOpen,    setXlOpen]      = useState(false);
  const [xlPreview, setXlPreview]   = useState<any[]>([]);
  const [xlLoading, setXlLoading]   = useState(false);
  const [xlResult,  setXlResult]    = useState<{ created: number; skipped: number; errors: string[] } | null>(null);

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadBanks = useCallback(async () => {
    setLoading(true);
    try {
      const url = teacherId ? `/api/question-banks?teacherId=${teacherId}` : '/api/question-banks';
      const data = await fetch(url).then(r => r.json());
      setBanks(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [teacherId]);

  const loadQuestions = useCallback(async (bankId: string) => {
    setQLoading(true);
    try {
      const data = await fetch(`/api/questions?bankId=${bankId}`).then(r => r.json());
      setQuestions(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setQLoading(false); }
  }, []);

  useEffect(() => { loadBanks(); }, [loadBanks]);

  const openBank = (bank: Bank) => {
    setActiveBank(bank);
    loadQuestions(bank._id);
  };

  // ── Create bank ─────────────────────────────────────────────────────────────
  const handleCreateBank = async () => {
    if (!newBank.title.trim()) { toast({ title: 'Title is required', variant: 'destructive' }); return; }
    if (!teacherId) { toast({ title: 'Please log in again', variant: 'destructive' }); return; }
    setBankSaving(true);
    try {
      const res  = await fetch('/api/question-banks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newBank, teacherId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: `"${newBank.title}" created` });
      setBankOpen(false); setNewBank(BLANK_BANK); loadBanks();
    } catch (err: any) { toast({ title: err.message, variant: 'destructive' }); }
    finally { setBankSaving(false); }
  };

  const handleDeleteBank = async (bank: Bank) => {
    if (!confirm(`Delete "${bank.title}"? This cannot be undone.`)) return;
    await fetch(`/api/question-banks?id=${bank._id}`, { method: 'DELETE' });
    toast({ title: `"${bank.title}" deleted` });
    if (activeBank?._id === bank._id) { setActiveBank(null); setQuestions([]); }
    loadBanks();
  };

  // ── Add / Edit question ──────────────────────────────────────────────────────
  const openAddQuestion = () => { setEditingQ(null); setQForm(BLANK_Q); setQOpen(true); };
  const openEditQuestion = (q: Question) => {
    setEditingQ(q);
    setQForm({
      questionText: q.questionText,
      questionType: q.questionType,
      options:      q.options.map(o => ({ ...o })),
      explanation:  q.explanation || '',
      marks:        q.marks,
      difficulty:   q.difficulty as any,
      topic:        q.topic || '',
    });
    setPreviewQ(null);
    setQOpen(true);
  };

  const handleSaveQuestion = async () => {
    if (!qForm.questionText.trim()) { toast({ title: 'Question text is required', variant: 'destructive' }); return; }
    const hasCorrect = qForm.options.some(o => o.isCorrect && o.text.trim());
    if (!hasCorrect) { toast({ title: 'Mark at least one correct answer', variant: 'destructive' }); return; }
    if (!activeBank) return;
    setQSaving(true);
    try {
      const isEdit = !!editingQ;
      const url    = isEdit ? `/api/questions/${editingQ._id}` : '/api/questions';
      const method = isEdit ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...qForm, bankId: activeBank._id, teacherId }),
      });
      const data = await res.json();
      if (res.status === 409) throw new Error('This question already exists in the bank.');
      if (!res.ok) throw new Error(data.error);
      toast({ title: isEdit ? 'Question updated' : 'Question added' });
      setQOpen(false); loadQuestions(activeBank._id); loadBanks();
    } catch (err: any) { toast({ title: err.message, variant: 'destructive' }); }
    finally { setQSaving(false); }
  };

  const handleDeleteQuestion = async (qId: string) => {
    await fetch(`/api/questions/${qId}`, { method: 'DELETE' });
    toast({ title: 'Question deleted' });
    setPreviewQ(null);
    if (activeBank) loadQuestions(activeBank._id);
    loadBanks();
  };

  // ── Preview navigation ───────────────────────────────────────────────────────
  const openPreview = (q: Question, idx: number) => { setPreviewQ(q); setPreviewIdx(idx); };
  const prevQ = () => {
    const idx = Math.max(0, previewIdx - 1);
    setPreviewQ(questions[idx]); setPreviewIdx(idx);
  };
  const nextQ = () => {
    const idx = Math.min(questions.length - 1, previewIdx + 1);
    setPreviewQ(questions[idx]); setPreviewIdx(idx);
  };

  // ── Schedule test ────────────────────────────────────────────────────────────
  const openSchedule = () => {
    setSchedule({ ...BLANK_SCHEDULE, title: activeBank?.title || '' });
    setSchedOpen(true);
  };

  const handleSchedule = async () => {
    if (!schedule.title.trim()) { toast({ title: 'Exam title is required', variant: 'destructive' }); return; }
    if (!schedule.examDate)     { toast({ title: 'Date is required', variant: 'destructive' }); return; }
    if (!schedule.startTime)    { toast({ title: 'Start time is required', variant: 'destructive' }); return; }
    if (!activeBank) return;
    const hasBatches = schedule.targetBatches.split(',').map(s => s.trim()).filter(Boolean).length > 0;
    if (schedule.targetPrograms.length === 0 && schedule.targetYears.length === 0 && !hasBatches) {
      toast({ title: 'No target selected', description: 'Select at least one program, year, or batch so the right students can see this test.', variant: 'destructive' });
      return;
    }
    setSchedSaving(true);
    try {
      const batches = schedule.targetBatches
        .split(',').map(s => s.trim()).filter(Boolean);
      const res  = await fetch('/api/exams', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankId:      activeBank._id,
          teacherId,
          title:       schedule.title,
          subject:     activeBank.subject,
          examDate:    schedule.examDate,
          startTime:   schedule.startTime,
          durationMins: schedule.durationMins,
          passingMarks: schedule.passingMarks || undefined,
          targetPrograms: schedule.targetPrograms,
          targetYears:    schedule.targetYears,
          targetBatches:  batches,
          shuffleQuestions: schedule.shuffleQuestions,
          shuffleOptions:   schedule.shuffleOptions,
          showResultImmediately: schedule.showResultImmediately,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: `"${schedule.title}" scheduled and published to students` });
      setSchedOpen(false);
    } catch (err: any) { toast({ title: err.message, variant: 'destructive' }); }
    finally { setSchedSaving(false); }
  };

  // ── Excel helpers ────────────────────────────────────────────────────────────
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['questionText','optionA','optionB','optionC','optionD','correctOption','difficulty','marks','topic','explanation'],
      ['What is the time complexity of binary search?','O(n)','O(log n)','O(n²)','O(1)','B','Medium',1,'Searching','Binary search halves the search space each step.'],
      ['Which data structure uses LIFO?','Queue','Linked List','Stack','Tree','C','Easy',1,'Data Structures','LIFO = Last In First Out = Stack.'],
      ['What does SQL stand for?','Structured Query Language','Simple Query Logic','Stored Query List','Sequential Query Language','A','Easy',1,'Databases',''],
    ]);
    ws['!cols'] = [40,22,22,22,22,14,10,6,18,40].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, 'Questions');
    XLSX.writeFile(wb, 'QuestionBank_Template.xlsx');
  };

  const handleXlFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb   = XLSX.read(ev.target?.result, { type: 'binary' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as any[];
      allRowsRef.current = rows;
      setXlPreview(rows.slice(0, 4));
      setXlResult(null); setXlOpen(true);
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleXlImport = async () => {
    if (!activeBank || allRowsRef.current.length === 0) return;
    setXlLoading(true);
    const result = { created: 0, skipped: 0, errors: [] as string[] };
    for (const row of allRowsRef.current) {
      const text = row['questionText']?.toString().trim();
      if (!text) { result.errors.push('Row missing questionText — skipped'); continue; }
      const correct = row['correctOption']?.toString().toUpperCase().trim();
      const options = ['A','B','C','D'].map(l => ({
        label: l, text: row[`option${l}`]?.toString().trim() || '', isCorrect: l === correct,
      }));
      try {
        const res = await fetch('/api/questions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bankId: activeBank._id, teacherId, questionText: text, questionType: 'MCQ',
            options, difficulty: row['difficulty']?.toString().trim() || 'Medium',
            marks: parseInt(row['marks']) || 1,
            topic: row['topic']?.toString().trim() || '',
            explanation: row['explanation']?.toString().trim() || '',
          }),
        });
        if (res.status === 409) { result.skipped++; continue; }
        if (res.ok) result.created++;
        else { const d = await res.json(); result.errors.push(`"${text.slice(0,40)}": ${d.error}`); }
      } catch (err: any) { result.errors.push(`"${text.slice(0,40)}": ${err.message}`); }
    }
    setXlResult(result);
    loadQuestions(activeBank._id); loadBanks();
    setXlLoading(false);
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const toggleProgram = (p: string) =>
    setNewBank(prev => ({ ...prev, programs: prev.programs.includes(p) ? prev.programs.filter(x => x !== p) : [...prev.programs, p] }));

  const toggleSchedProgram = (p: string) =>
    setSchedule(prev => ({ ...prev, targetPrograms: prev.targetPrograms.includes(p) ? prev.targetPrograms.filter(x => x !== p) : [...prev.targetPrograms, p] }));

  const toggleSchedYear = (y: number) =>
    setSchedule(prev => ({ ...prev, targetYears: prev.targetYears.includes(y) ? prev.targetYears.filter(x => x !== y) : [...prev.targetYears, y] }));

  const setCorrect = (idx: number) =>
    setQForm(prev => ({ ...prev, options: prev.options.map((o, i) => ({ ...o, isCorrect: i === idx })) }));

  const diffBadge = (d: string) =>
    d === 'Easy' ? 'bg-green-100 text-green-700' : d === 'Hard' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700';

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-slate-900">Question Banks</h1>
          <p className="text-slate-500 mt-1">Build question banks and schedule them as tests for students.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadBanks} className="rounded-xl">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setBankOpen(true)} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
            <Plus className="h-4 w-4" /> New Bank
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Bank list ── */}
        <div className="lg:col-span-1 space-y-3">
          <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide px-1">Your Banks ({banks.length})</p>
          {loading ? (
            <p className="text-sm text-slate-400 text-center py-8">Loading…</p>
          ) : banks.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200 shadow-none">
              <CardContent className="py-10 text-center">
                <BookOpen className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No question banks yet.</p>
                <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={() => setBankOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Create First Bank
                </Button>
              </CardContent>
            </Card>
          ) : banks.map(bank => (
            <div
              key={bank._id}
              onClick={() => openBank(bank)}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all group
                ${activeBank?._id === bank._id
                  ? 'border-indigo-400 bg-indigo-50 shadow-md'
                  : 'border-slate-200 bg-white hover:border-indigo-200 hover:shadow-sm'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{bank.title}</p>
                  {bank.subject && <p className="text-xs text-slate-500 mt-0.5">{bank.subject}</p>}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {bank.programs?.slice(0,3).map(p => (
                      <Badge key={p} variant="outline" className="text-[10px] px-1.5 py-0">{p}</Badge>
                    ))}
                    {(bank.programs?.length || 0) > 3 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{bank.programs.length - 3}</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-lg font-bold text-indigo-600">{bank.questionCount}</p>
                    <p className="text-[10px] text-slate-400">questions</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteBank(bank); }}
                    className="opacity-0 group-hover:opacity-100 ml-2 text-slate-300 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Questions panel ── */}
        <div className="lg:col-span-2">
          {!activeBank ? (
            <Card className="border-dashed border-2 border-slate-200 shadow-none h-full">
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <ChevronRight className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-slate-400">Select a question bank to view, edit, and schedule.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-none shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" /> {activeBank.title}
                    </CardTitle>
                    <CardDescription>
                      {activeBank.subject && `${activeBank.subject} · `}
                      {questions.length} question{questions.length !== 1 ? 's' : ''}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={downloadTemplate}
                      className="rounded-xl gap-2 border-blue-300 text-blue-700 hover:bg-blue-50" title="Download Excel template">
                      <Download className="h-4 w-4" /> Template
                    </Button>
                    <Button variant="outline" onClick={() => xlFileRef.current?.click()}
                      className="rounded-xl gap-2 border-green-300 text-green-700 hover:bg-green-50">
                      <FileSpreadsheet className="h-4 w-4" /> Import Excel
                    </Button>
                    <input ref={xlFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleXlFile} />
                    <Button onClick={openAddQuestion} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                      <Plus className="h-4 w-4" /> Add Question
                    </Button>
                    {questions.length > 0 && (
                      <Button onClick={openSchedule}
                        className="rounded-xl bg-green-600 hover:bg-green-700 text-white gap-2">
                        <CalendarClock className="h-4 w-4" /> Schedule Test
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {qLoading ? (
                  <p className="text-center text-slate-400 py-8">Loading questions…</p>
                ) : questions.length === 0 ? (
                  <div className="text-center py-12">
                    <HelpCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">No questions yet. Click "Add Question" or import an Excel file.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {questions.map((q, i) => (
                      <div key={q._id} className="border border-slate-200 rounded-xl p-4 bg-white group hover:border-indigo-200 transition-colors">
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center mt-0.5">
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 leading-snug">{q.questionText}</p>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              <Badge variant="outline" className={`text-[10px] px-1.5 ${diffBadge(q.difficulty)}`}>{q.difficulty}</Badge>
                              <Badge variant="outline" className="text-[10px] px-1.5">{q.marks} mark{q.marks !== 1 ? 's' : ''}</Badge>
                              {q.topic && <Badge variant="outline" className="text-[10px] px-1.5 text-slate-500">{q.topic}</Badge>}
                            </div>
                            {/* Options preview — truncated */}
                            <div className="grid grid-cols-2 gap-1 mt-2">
                              {q.options?.map((o, oi) => (
                                <div key={oi} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg
                                  ${o.isCorrect ? 'bg-green-50 text-green-700 font-medium' : 'text-slate-500'}`}>
                                  {o.isCorrect && <CheckCircle2 className="h-3 w-3 flex-shrink-0" />}
                                  <span className="font-semibold">{o.label}.</span>
                                  <span className="truncate">{o.text}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* Actions — visible on hover */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                            <button onClick={() => openPreview(q, i)} title="Full preview"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                              <Eye className="h-4 w-4" />
                            </button>
                            <button onClick={() => openEditQuestion(q)} title="Edit question"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleDeleteQuestion(q._id)} title="Delete question"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          DIALOGS
      ════════════════════════════════════════════════════════════════════════ */}

      {/* ── New Bank ── */}
      <Dialog open={bankOpen} onOpenChange={o => { setBankOpen(o); if (!o) setNewBank(BLANK_BANK); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Question Bank</DialogTitle>
            <DialogDescription>Group questions by subject for use in exams.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Bank Title *</Label>
              <Input placeholder="e.g. Data Structures – Mid Sem" value={newBank.title}
                onChange={e => setNewBank(p => ({ ...p, title: e.target.value }))} className="rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Subject</Label>
              <Input placeholder="e.g. Computer Science" value={newBank.subject}
                onChange={e => setNewBank(p => ({ ...p, subject: e.target.value }))} className="rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input placeholder="Optional" value={newBank.description}
                onChange={e => setNewBank(p => ({ ...p, description: e.target.value }))} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Applicable Programs</Label>
              <div className="flex flex-wrap gap-2">
                {PROGRAMS.map(p => (
                  <button key={p} type="button" onClick={() => toggleProgram(p)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all
                      ${newBank.programs.includes(p) ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBankOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleCreateBank} disabled={bankSaving} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
              {bankSaving ? 'Creating…' : 'Create Bank'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Question Preview ── */}
      <Dialog open={!!previewQ} onOpenChange={o => { if (!o) setPreviewQ(null); }}>
        <DialogContent className="sm:max-w-lg">
          {previewQ && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {previewIdx + 1}
                  </span>
                  Question Preview
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={`text-[10px] ${diffBadge(previewQ.difficulty)}`}>{previewQ.difficulty}</Badge>
                  <Badge variant="outline" className="text-[10px]">{previewQ.marks} mark{previewQ.marks !== 1 ? 's' : ''}</Badge>
                  {previewQ.topic && <Badge variant="outline" className="text-[10px] text-slate-500">{previewQ.topic}</Badge>}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Question text */}
                <p className="text-base font-medium text-slate-800 leading-relaxed">{previewQ.questionText}</p>

                {/* Options */}
                <div className="space-y-2">
                  {previewQ.options?.map((o, i) => (
                    <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-colors
                      ${o.isCorrect
                        ? 'border-green-400 bg-green-50'
                        : 'border-slate-200 bg-white'}`}>
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0
                        ${o.isCorrect ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {o.label}
                      </span>
                      <span className={`text-sm ${o.isCorrect ? 'text-green-800 font-semibold' : 'text-slate-700'}`}>
                        {o.text || <em className="text-slate-300">No text</em>}
                      </span>
                      {o.isCorrect && <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto flex-shrink-0" />}
                    </div>
                  ))}
                </div>

                {/* Explanation */}
                {previewQ.explanation && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <p className="text-xs font-semibold text-amber-700 mb-1">Explanation</p>
                    <p className="text-sm text-amber-900">{previewQ.explanation}</p>
                  </div>
                )}
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                {/* Navigation */}
                <div className="flex items-center gap-2 mr-auto">
                  <Button variant="outline" size="sm" onClick={prevQ} disabled={previewIdx === 0} className="rounded-xl">← Prev</Button>
                  <span className="text-xs text-slate-400">{previewIdx + 1} / {questions.length}</span>
                  <Button variant="outline" size="sm" onClick={nextQ} disabled={previewIdx === questions.length - 1} className="rounded-xl">Next →</Button>
                </div>
                <Button variant="outline" onClick={() => openEditQuestion(previewQ)} className="rounded-xl gap-2 border-amber-300 text-amber-700 hover:bg-amber-50">
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
                <Button variant="outline" onClick={() => handleDeleteQuestion(previewQ._id)} className="rounded-xl gap-2 border-red-200 text-red-600 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Add / Edit Question ── */}
      <Dialog open={qOpen} onOpenChange={o => { setQOpen(o); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingQ ? 'Edit Question' : 'Add Question'}</DialogTitle>
            <DialogDescription>{editingQ ? `Editing question in: ${activeBank?.title}` : `Adding to: ${activeBank?.title}`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Question Text *</Label>
              <textarea rows={3} placeholder="Enter the question…" value={qForm.questionText}
                onChange={e => setQForm(p => ({ ...p, questionText: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Options — click the circle to mark the correct answer</Label>
              {qForm.options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button type="button" onClick={() => setCorrect(i)}
                    className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all
                      ${o.isCorrect ? 'bg-green-500 border-green-500' : 'border-slate-300 hover:border-green-400'}`} />
                  <span className="text-xs font-bold text-slate-500 w-4">{o.label}.</span>
                  <Input placeholder={`Option ${o.label}`} value={o.text}
                    onChange={e => setQForm(p => ({ ...p, options: p.options.map((opt, j) => j === i ? { ...opt, text: e.target.value } : opt) }))}
                    className="rounded-xl text-sm" />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Difficulty</Label>
                <select value={qForm.difficulty} onChange={e => setQForm(p => ({ ...p, difficulty: e.target.value as any }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
                  {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Marks</Label>
                <Input type="number" min={1} max={10} value={qForm.marks}
                  onChange={e => setQForm(p => ({ ...p, marks: parseInt(e.target.value) || 1 }))} className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Topic</Label>
                <Input placeholder="e.g. Arrays" value={qForm.topic}
                  onChange={e => setQForm(p => ({ ...p, topic: e.target.value }))} className="rounded-xl" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Explanation (optional — shown after exam)</Label>
              <Input placeholder="Why is this the correct answer?" value={qForm.explanation}
                onChange={e => setQForm(p => ({ ...p, explanation: e.target.value }))} className="rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleSaveQuestion} disabled={qSaving}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
              {qSaving ? 'Saving…' : editingQ ? 'Save Changes' : 'Add Question'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Schedule Test ── */}
      <Dialog open={schedOpen} onOpenChange={o => { setSchedOpen(o); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-green-600" /> Schedule Test
            </DialogTitle>
            <DialogDescription>
              This will publish the exam to students matching your target criteria.
              All {questions.length} questions from "{activeBank?.title}" will be included.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Title */}
            <div className="space-y-1">
              <Label className="text-xs">Exam Title *</Label>
              <Input placeholder="e.g. Mid Semester Exam – Data Structures" value={schedule.title}
                onChange={e => setSchedule(p => ({ ...p, title: e.target.value }))} className="rounded-xl" />
            </div>

            {/* Date + Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" /> Date *</Label>
                <Input type="date" value={schedule.examDate}
                  onChange={e => setSchedule(p => ({ ...p, examDate: e.target.value }))} className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> Start Time *</Label>
                <Input type="time" value={schedule.startTime}
                  onChange={e => setSchedule(p => ({ ...p, startTime: e.target.value }))} className="rounded-xl" />
              </div>
            </div>

            {/* Duration + Passing marks */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Duration (minutes)</Label>
                <Input type="number" min={5} max={300} value={schedule.durationMins}
                  onChange={e => setSchedule(p => ({ ...p, durationMins: parseInt(e.target.value) || 60 }))} className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Passing Marks (optional)</Label>
                <Input type="number" min={0} placeholder="Auto: 40% of total" value={schedule.passingMarks || ''}
                  onChange={e => setSchedule(p => ({ ...p, passingMarks: parseInt(e.target.value) || 0 }))} className="rounded-xl" />
              </div>
            </div>

            {/* Target Programs */}
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1"><Users className="h-3 w-3" /> Target Programs (leave empty = all)</Label>
              <div className="flex flex-wrap gap-2">
                {PROGRAMS.map(p => (
                  <button key={p} type="button" onClick={() => toggleSchedProgram(p)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all
                      ${schedule.targetPrograms.includes(p) ? 'bg-green-600 text-white border-green-600' : 'border-slate-200 text-slate-600 hover:border-green-300'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Years */}
            <div className="space-y-2">
              <Label className="text-xs">Target Years (leave empty = all)</Label>
              <div className="flex gap-2">
                {YEARS.map(y => (
                  <button key={y} type="button" onClick={() => toggleSchedYear(y)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all
                      ${schedule.targetYears.includes(y) ? 'bg-green-600 text-white border-green-600' : 'border-slate-200 text-slate-600 hover:border-green-300'}`}>
                    Year {y}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Batches */}
            <div className="space-y-1">
              <Label className="text-xs">Target Batches (comma-separated, optional)</Label>
              <Input placeholder="e.g. 2022-2025, 2023-2026" value={schedule.targetBatches}
                onChange={e => setSchedule(p => ({ ...p, targetBatches: e.target.value }))} className="rounded-xl" />
            </div>

            {/* Options */}
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <Label className="text-xs text-slate-500 uppercase tracking-wide">Options</Label>
              {[
                { key: 'shuffleQuestions',    label: 'Shuffle question order'       },
                { key: 'shuffleOptions',      label: 'Shuffle answer options'       },
                { key: 'showResultImmediately', label: 'Show result to student immediately after submission' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={(schedule as any)[key]}
                    onChange={e => setSchedule(p => ({ ...p, [key]: e.target.checked }))}
                    className="w-4 h-4 rounded accent-green-600" />
                  <span className="text-sm text-slate-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSchedOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleSchedule} disabled={schedSaving}
              className="rounded-xl bg-green-600 hover:bg-green-700 text-white gap-2">
              <CalendarClock className="h-4 w-4" />
              {schedSaving ? 'Publishing…' : 'Publish Exam'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Excel Import ── */}
      <Dialog open={xlOpen} onOpenChange={o => { setXlOpen(o); if (!o) setXlResult(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Questions from Excel</DialogTitle>
            <DialogDescription>
              {xlResult ? 'Import complete.' : `Importing into: ${activeBank?.title}. Preview of first ${xlPreview.length} of ${allRowsRef.current.length} rows.`}
            </DialogDescription>
          </DialogHeader>

          {xlResult ? (
            <div className="space-y-4 py-2">
              <div className="flex gap-6 flex-wrap">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-bold text-lg">{xlResult.created}</span>
                  <span className="text-sm">added</span>
                </div>
                {xlResult.skipped > 0 && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <XCircle className="h-5 w-5" />
                    <span className="font-bold text-lg">{xlResult.skipped}</span>
                    <span className="text-sm">duplicate{xlResult.skipped !== 1 ? 's' : ''} skipped</span>
                  </div>
                )}
                {xlResult.errors.length > 0 && (
                  <div className="flex items-center gap-2 text-red-500">
                    <XCircle className="h-5 w-5" />
                    <span className="font-bold text-lg">{xlResult.errors.length}</span>
                    <span className="text-sm">errors</span>
                  </div>
                )}
              </div>
              {xlResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 max-h-32 overflow-y-auto">
                  {xlResult.errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-700">Required columns:</p>
                <p><code className="bg-white px-1 rounded border">questionText</code>, <code className="bg-white px-1 rounded border">optionA–D</code>, <code className="bg-white px-1 rounded border">correctOption</code> (A/B/C/D)</p>
                <p className="text-slate-500">Optional: <code className="bg-white px-1 rounded border">difficulty</code>, <code className="bg-white px-1 rounded border">marks</code>, <code className="bg-white px-1 rounded border">topic</code>, <code className="bg-white px-1 rounded border">explanation</code></p>
              </div>
              <div className="overflow-x-auto max-h-52 border border-slate-200 rounded-xl">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>{xlPreview[0] && Object.keys(xlPreview[0]).map(k => (
                      <th key={k} className="text-left py-2 px-2 text-slate-500 font-semibold whitespace-nowrap border-b border-slate-200">{k}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {xlPreview.map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                        {Object.values(row).map((v: any, j) => (
                          <td key={j} className="py-1.5 px-2 text-slate-700 max-w-[180px] truncate" title={String(v)}>{String(v)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {allRowsRef.current.length > 4 && (
                <p className="text-xs text-slate-400 text-center">…and {allRowsRef.current.length - 4} more rows</p>
              )}
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setXlOpen(false); setXlResult(null); }} className="rounded-xl">
              {xlResult ? 'Close' : 'Cancel'}
            </Button>
            {!xlResult && (
              <Button onClick={handleXlImport} disabled={xlLoading || allRowsRef.current.length === 0}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                <Upload className="h-4 w-4" />
                {xlLoading ? 'Importing…' : `Import ${allRowsRef.current.length} Questions`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
