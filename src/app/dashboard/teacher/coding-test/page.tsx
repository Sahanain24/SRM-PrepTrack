'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/mock-db';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Code2, Plus, Trash2, Loader2, Users, RefreshCw, ArrowRight, Sparkles,
} from 'lucide-react';

const PROGRAMS = ['BCA', 'BCA(DS)', 'BCom', 'MSc(ADS)', 'MCom', 'MCA', 'MCA GenAI'];
const YEARS    = [1, 2, 3, 4];
const SECTIONS = ['A','B','C','D','E','F','G','H','I','J'];
const LANGUAGES = ['javascript', 'python', 'java', 'cpp', 'c'];

interface TestCase { input: string; expectedOutput: string; hidden: boolean; }
interface Problem {
  problemId: string; title: string; description: string;
  difficulty: 'easy'|'medium'|'hard'; language: string;
  starterCode: string; marks: number; testCases: TestCase[];
}

interface CodingTestSummary {
  _id: string; title: string; durationMins: number; problems: { problemId: string }[];
  createdAt: string; examDate?: string; startTime?: string;
  targetPrograms: string[]; targetYears: number[]; targetSections: string[];
}

function emptyProblem(): Problem {
  return {
    problemId: `p${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: '', description: '', difficulty: 'medium', language: 'javascript',
    starterCode: '', marks: 10,
    testCases: [{ input: '', expectedOutput: '', hidden: false }],
  };
}

export default function TeacherCodingTestPage() {
  const router = useRouter();
  const { toast } = useToast();
  const user = getCurrentUser() as any;
  const teacherId   = user?._id || user?.id;
  const teacherName = user?.name || 'Teacher';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [examDate,     setExamDate]     = useState('');
  const [startTime,    setStartTime]    = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('23:59');
  const [durationMins, setDurationMins] = useState(60);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [problems, setProblems] = useState<Problem[]>([emptyProblem()]);
  const [saving, setSaving] = useState(false);

  const [tests, setTests] = useState<CodingTestSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // AI generation
  const [aiTopic, setAiTopic] = useState('');
  const [aiDifficulty, setAiDifficulty] = useState<'easy'|'medium'|'hard'>('medium');
  const [aiLanguage, setAiLanguage] = useState('python');
  const [aiNumProblems, setAiNumProblems] = useState(3);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/coding-tests?teacherId=${teacherId}`);
    const data = await res.json();
    setTests(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleProgram = (p: string) =>
    setSelectedPrograms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  const toggleYear = (y: number) =>
    setSelectedYears(prev => prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y]);
  const toggleSection = (s: string) =>
    setSelectedSections(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const toggleAllSections = () =>
    setSelectedSections(prev => prev.length === SECTIONS.length ? [] : [...SECTIONS]);

  const updateProblem = (idx: number, patch: Partial<Problem>) =>
    setProblems(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p));

  const addProblem = () => setProblems(prev => [...prev, emptyProblem()]);
  const removeProblem = (idx: number) => setProblems(prev => prev.filter((_, i) => i !== idx));

  const updateTestCase = (pIdx: number, tIdx: number, patch: Partial<TestCase>) =>
    setProblems(prev => prev.map((p, i) => i === pIdx
      ? { ...p, testCases: p.testCases.map((t, j) => j === tIdx ? { ...t, ...patch } : t) }
      : p));
  const addTestCase = (pIdx: number) =>
    setProblems(prev => prev.map((p, i) => i === pIdx
      ? { ...p, testCases: [...p.testCases, { input: '', expectedOutput: '', hidden: false }] }
      : p));
  const removeTestCase = (pIdx: number, tIdx: number) =>
    setProblems(prev => prev.map((p, i) => i === pIdx
      ? { ...p, testCases: p.testCases.filter((_, j) => j !== tIdx) }
      : p));

  const resetForm = () => {
    setTitle(''); setDescription(''); setExamDate(''); setStartTime('');
    setDurationMins(60); setSelectedPrograms([]); setSelectedYears([]); setSelectedSections([]);
    setProblems([emptyProblem()]);
  };

  const generateWithAI = async () => {
    if (!aiTopic.trim()) {
      toast({ title: 'Topic required', description: 'Enter a topic for the AI to generate problems on.', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/generate-coding-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: aiTopic.trim(), difficulty: aiDifficulty, language: aiLanguage, numProblems: aiNumProblems }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Generation failed');
      const output = await res.json();

      const generated: Problem[] = output.problems.map(p => ({
        problemId: `p${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: p.title, description: p.description, difficulty: p.difficulty,
        language: aiLanguage, starterCode: p.starterCode, marks: p.marks,
        testCases: p.testCases.map(tc => ({ input: tc.input, expectedOutput: tc.expectedOutput, hidden: tc.hidden })),
      }));

      setProblems(generated);
      if (!title.trim()) setTitle(output.title);
      toast({ title: 'Problems generated!', description: 'Review, edit or remove problems below before scheduling.' });
    } catch (e: any) {
      toast({ title: 'Generation failed', description: e.message, variant: 'destructive' });
    } finally { setGenerating(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || problems.some(p => !p.title.trim() || !p.description.trim() || p.testCases.some(t => !t.expectedOutput.trim()))) {
      toast({ title: 'Incomplete form', description: 'Fill in all problem titles, descriptions and expected outputs.', variant: 'destructive' });
      return;
    }
    if (selectedPrograms.length === 0 && selectedYears.length === 0 && selectedSections.length === 0) {
      toast({ title: 'No target selected', description: 'Select at least one program, year, or section so the right students can see this test.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/coding-tests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId, teacherName, title: title.trim(), description: description.trim(),
          examDate, startTime, deadlineDate, deadlineTime, durationMins,
          targetPrograms: selectedPrograms, targetYears: selectedYears, targetSections: selectedSections,
          problems,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: 'Coding test scheduled!', description: 'Students will now see this test.' });
      resetForm();
      load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg">
            <Code2 className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Schedule Coding Test</h1>
            <p className="text-slate-500 text-sm">Create a LeetCode-style coding test for students</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5 rounded-xl">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-5 pb-5">
          <form onSubmit={submit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Test Title (shown to students) *</Label>
                <Input placeholder="e.g. Arrays & Strings Practice" value={title} onChange={e => setTitle(e.target.value)} className="rounded-xl" required />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input placeholder="Optional short description" value={description} onChange={e => setDescription(e.target.value)} className="rounded-xl" />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Duration (mins)</Label>
                <Input type="number" min={10} value={durationMins} onChange={e => setDurationMins(Number(e.target.value))} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-red-700">Deadline Date</Label>
                <Input type="date" value={deadlineDate} onChange={e => setDeadlineDate(e.target.value)} className="rounded-xl border-red-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-red-700">Deadline Time</Label>
                <Input type="time" value={deadlineTime} onChange={e => setDeadlineTime(e.target.value)} className="rounded-xl border-red-200" />
              </div>
            </div>

            {/* AI generation */}
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-3">
              <Label className="text-slate-700 font-medium flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-emerald-500" /> Generate Problems with AI
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Subject / Prompt * <span className="text-slate-400 font-normal">(private — not shown to students)</span></Label>
                  <textarea
                    value={aiTopic}
                    onChange={e => setAiTopic(e.target.value)}
                    placeholder={"e.g. Arrays and Strings – focus on two-pointer and sliding window problems\n\nOr simply: Recursion, Dynamic Programming, Graph BFS/DFS"}
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300 placeholder:text-slate-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Difficulty</Label>
                  <Select value={aiDifficulty} onValueChange={v => setAiDifficulty(v as any)}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Language</Label>
                  <Select value={aiLanguage} onValueChange={setAiLanguage}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">No. of Problems</Label>
                  <Input type="number" min={1} max={10} value={aiNumProblems} onChange={e => setAiNumProblems(Number(e.target.value))} className="rounded-xl w-28" />
                </div>
                <Button type="button" onClick={generateWithAI} disabled={generating} className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 mt-5">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Generate Problems
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-slate-700 font-medium flex items-center gap-1.5">
                <Users className="h-4 w-4 text-emerald-500" /> Target Audience
              </Label>
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Programs</p>
                  <div className="flex flex-wrap gap-2">
                    {PROGRAMS.map(p => (
                      <button type="button" key={p} onClick={() => toggleProgram(p)}
                        className={`px-3 py-1 rounded-full text-sm font-medium border transition-all ${
                          selectedPrograms.includes(p) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400'
                        }`}>{p}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Years</p>
                  <div className="flex gap-2">
                    {YEARS.map(y => (
                      <button type="button" key={y} onClick={() => toggleYear(y)}
                        className={`w-10 h-10 rounded-xl text-sm font-bold border transition-all ${
                          selectedYears.includes(y) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400'
                        }`}>{y}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Sections</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={toggleAllSections}
                      className={`px-3 py-1 rounded-full text-sm font-medium border transition-all ${
                        selectedSections.length === SECTIONS.length
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400'
                      }`}>All</button>
                    {SECTIONS.map(s => (
                      <button type="button" key={s} onClick={() => toggleSection(s)}
                        className={`w-9 h-9 rounded-xl text-sm font-bold border transition-all ${
                          selectedSections.includes(s) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400'
                        }`}>{s}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Problems */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-slate-700 font-medium">Problems</Label>
                <Button type="button" size="sm" variant="outline" onClick={addProblem} className="gap-1.5 rounded-xl">
                  <Plus className="h-3.5 w-3.5" /> Add Problem
                </Button>
              </div>

              {problems.map((p, pIdx) => (
                <Card key={p.problemId} className="border-slate-200">
                  <CardContent className="pt-4 pb-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">Problem {pIdx + 1}</Badge>
                      {problems.length > 1 && (
                        <Button type="button" size="icon" variant="ghost" onClick={() => removeProblem(pIdx)} className="h-7 w-7 text-red-500 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Problem Title *</Label>
                        <Input placeholder="e.g. Two Sum" value={p.title} onChange={e => updateProblem(pIdx, { title: e.target.value })} className="rounded-xl" required />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1.5">
                          <Label>Difficulty</Label>
                          <Select value={p.difficulty} onValueChange={v => updateProblem(pIdx, { difficulty: v as any })}>
                            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="easy">Easy</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="hard">Hard</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Language</Label>
                          <Select value={p.language} onValueChange={v => updateProblem(pIdx, { language: v })}>
                            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Marks</Label>
                          <Input type="number" min={1} value={p.marks} onChange={e => updateProblem(pIdx, { marks: Number(e.target.value) })} className="rounded-xl" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Problem Statement *</Label>
                      <Textarea placeholder="Describe the problem, input/output format, constraints..." value={p.description} onChange={e => updateProblem(pIdx, { description: e.target.value })} className="rounded-xl min-h-24" required />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Starter Code</Label>
                      <Textarea placeholder="Optional starter code template for students" value={p.starterCode} onChange={e => updateProblem(pIdx, { starterCode: e.target.value })} className="rounded-xl min-h-20 font-mono text-sm" />
                    </div>

                    {/* Test cases */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Test Cases *</Label>
                        <Button type="button" size="sm" variant="outline" onClick={() => addTestCase(pIdx)} className="gap-1 rounded-xl h-7 text-xs">
                          <Plus className="h-3 w-3" /> Add Test Case
                        </Button>
                      </div>
                      {p.testCases.map((tc, tIdx) => (
                        <div key={tIdx} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2 items-start p-2 rounded-xl bg-slate-50 border border-slate-200">
                          <div className="space-y-1">
                            <Label className="text-xs">Input (stdin)</Label>
                            <Textarea value={tc.input} onChange={e => updateTestCase(pIdx, tIdx, { input: e.target.value })} className="rounded-lg min-h-16 font-mono text-xs" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Expected Output *</Label>
                            <Textarea value={tc.expectedOutput} onChange={e => updateTestCase(pIdx, tIdx, { expectedOutput: e.target.value })} className="rounded-lg min-h-16 font-mono text-xs" required />
                          </div>
                          <label className="flex items-center gap-1.5 text-xs text-slate-500 pt-6 whitespace-nowrap">
                            <input type="checkbox" checked={tc.hidden} onChange={e => updateTestCase(pIdx, tIdx, { hidden: e.target.checked })} />
                            Hidden
                          </label>
                          {p.testCases.length > 1 && (
                            <Button type="button" size="icon" variant="ghost" onClick={() => removeTestCase(pIdx, tIdx)} className="h-7 w-7 mt-5 text-red-500 hover:bg-red-50">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving} className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Schedule Coding Test
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Existing tests */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Scheduled Coding Tests</h2>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>
        ) : tests.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200 shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-14 text-center gap-2">
              <Code2 className="h-12 w-12 text-slate-300" />
              <p className="text-sm text-slate-400">No coding tests scheduled yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tests.map(t => (
              <Card key={t._id} className="border-slate-200 shadow-sm">
                <CardContent className="pt-4 pb-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{t.title}</p>
                      <p className="text-xs text-slate-400">
                        {t.problems?.length || 0} problem(s) · {t.durationMins} min
                        {t.examDate && ` · ${t.examDate}${t.startTime ? ` at ${t.startTime}` : ''}`}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/coding-test/results/${t._id}`)} className="gap-1.5 rounded-xl text-xs">
                      View Results <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                  {/* Scheduled batch info */}
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> Scheduled for:
                    </span>
                    {(t.targetPrograms?.length > 0 ? t.targetPrograms : ['All Programs']).map(p => (
                      <Badge key={p} variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">{p}</Badge>
                    ))}
                    {t.targetYears?.length > 0 && t.targetYears.map(y => (
                      <Badge key={y} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">Year {y}</Badge>
                    ))}
                    {t.targetSections?.length > 0 && t.targetSections.map(s => (
                      <Badge key={s} variant="outline" className="text-xs bg-violet-50 text-violet-700 border-violet-200">Section {s}</Badge>
                    ))}
                    {(!t.targetSections || t.targetSections.length === 0) && (
                      <Badge variant="outline" className="text-xs text-slate-500">All Sections</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
