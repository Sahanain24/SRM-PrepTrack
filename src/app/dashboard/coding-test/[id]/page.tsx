'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/mock-db';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Code2, Loader2, Play, Send, CheckCircle2, XCircle, ArrowLeft, ArrowRight, Timer, Circle, CircleDot, AlertTriangle,
} from 'lucide-react';

interface TestCase { input: string; expectedOutput: string; hidden: boolean; }
interface Problem {
  problemId: string; title: string; description: string;
  difficulty: string; language: string; starterCode: string; marks: number;
  testCases: TestCase[];
}
interface CodingTest {
  _id: string; title: string; description?: string; durationMins: number; problems: Problem[];
}
const LANGUAGE_SKELETONS: Record<string, string> = {
  javascript: `function main() {\n  // your code here\n}\n\nmain();\n`,
  python:     `def main():\n    # your code here\n    pass\n\nmain()\n`,
  java:       `public class Main {\n    public static void main(String[] args) {\n        // your code here\n    }\n}\n`,
  cpp:        `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // your code here\n    return 0;\n}\n`,
  c:          `#include <stdio.h>\n\nint main() {\n    // your code here\n    return 0;\n}\n`,
};

interface Submission {
  _id: string; totalMarks: number; obtainedMarks: number;
  answers: { problemId: string; code: string; passedCount: number; totalCount: number; marksAwarded: number }[];
}

export default function AttemptCodingTestPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const user = getCurrentUser() as any;
  const studentId = user?._id || user?.id;

  const [test, setTest] = useState<CodingTest | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [code, setCode] = useState<Record<string, string>>({});
  const [selectedLang, setSelectedLang] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [runResults, setRunResults] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [violations, setViolations]   = useState(0);
  const [warning, setWarning]         = useState<string | null>(null);
  const MAX_VIOLATIONS = 3;
  const submittingRef = useRef(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [tRes, sRes] = await Promise.all([
        fetch(`/api/coding-tests/${id}`),
        fetch(`/api/coding-tests/${id}/results?studentId=${studentId}`),
      ]);
      const tData = await tRes.json();
      const sData = await sRes.json();
      setTest(tData);

      if (Array.isArray(sData) && sData.length > 0) {
        setSubmission(sData[0]);
      } else {
        const initial: Record<string, string> = {};
        const initialLang: Record<string, string> = {};
        (tData.problems || []).forEach((p: Problem) => {
          const lang = p.language || 'javascript';
          initialLang[p.problemId] = lang;
          initial[p.problemId] = LANGUAGE_SKELETONS[lang] || LANGUAGE_SKELETONS.javascript;
        });
        setCode(initial);
        setSelectedLang(initialLang);

        // Persist a per-student start time so refreshing doesn't reset the timer
        const storageKey = `coding-test-start-${id}-${studentId}`;
        let startedAt = Number(localStorage.getItem(storageKey));
        if (!startedAt) {
          startedAt = Date.now();
          localStorage.setItem(storageKey, String(startedAt));
        }
        const totalSecs = (tData.durationMins || 0) * 60;
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        setSecondsLeft(Math.max(0, totalSecs - elapsed));
      }
      setLoading(false);
    })();
  }, [id]);

  // Countdown timer
  useEffect(() => {
    if (secondsLeft === null || submission) return;
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft(s => (s === null ? null : Math.max(0, s - 1))), 1000);
    return () => clearInterval(t);
  }, [secondsLeft === null, submission]);

  // submitTest must be defined before handleViolation and the auto-submit effects
  const submitTest = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const answers = (test?.problems || []).map((p: Problem) => ({
        problemId: p.problemId, code: code[p.problemId] || '', language: selectedLang[p.problemId] || p.language,
      }));
      const res = await fetch(`/api/coding-tests/${id}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId, studentName: user?.name, rollNumber: user?.rollNumber,
          program: user?.program, year: user?.year, section: user?.section, answers,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSubmission(data);
      localStorage.removeItem(`coding-test-start-${id}-${studentId}`);
      toast({ title: 'Test submitted!', description: `You scored ${data.obtainedMarks}/${data.totalMarks}.` });
    } catch (e: any) {
      submittingRef.current = false;
      toast({ title: 'Submit failed', description: e.message, variant: 'destructive' });
    } finally { setSubmitting(false); }
  }, [test, code, id, studentId, user]);

  // Auto-submit when time runs out
  useEffect(() => {
    if (secondsLeft === 0 && !submission && test) {
      submitTest();
    }
  }, [secondsLeft]);

  // Track violations and auto-submit if limit exceeded
  const handleViolation = useCallback((reason: string) => {
    if (submittingRef.current) return;
    setViolations(prev => {
      const next = prev + 1;
      const remaining = MAX_VIOLATIONS - next;
      if (remaining <= 0) {
        setWarning('Maximum violations reached. Submitting your test automatically.');
        setTimeout(() => submitTest(), 2000);
      } else {
        setWarning(`${reason} Warning ${next}/${MAX_VIOLATIONS}. ${remaining} warning(s) left before auto-submit.`);
      }
      return next;
    });
  }, [submitTest]);

  // Tab-switch detection via visibilitychange
  useEffect(() => {
    if (submission) return;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        handleViolation('Tab switching or minimizing is not allowed.');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [submission, handleViolation]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>;
  }
  if (!test) {
    return <div className="text-center py-20 text-slate-400">Test not found.</div>;
  }

  const problem = test.problems[activeIdx];

  const runCode = async () => {
    setRunning(true);
    try {
      const res = await fetch(`/api/coding-tests/${id}/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId: problem.problemId, code: code[problem.problemId] || '', language: selectedLang[problem.problemId] || problem.language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRunResults(prev => ({ ...prev, [problem.problemId]: data }));
    } catch (e: any) {
      toast({ title: 'Run failed', description: e.message, variant: 'destructive' });
    } finally { setRunning(false); }
  };

  const runResult = runResults[problem?.problemId];

  // Per-question completion status, based on the last "Run" result for that problem
  const questionStatus = (p: Problem): 'completed' | 'partial' | 'not_attempted' => {
    const r = runResults[p.problemId];
    if (!r) return 'not_attempted';
    if (r.totalCount > 0 && r.passedCount === r.totalCount) return 'completed';
    if (r.passedCount > 0) return 'partial';
    return 'not_attempted';
  };

  const completedCount     = test ? test.problems.filter(p => questionStatus(p) === 'completed').length : 0;
  const partialCount       = test ? test.problems.filter(p => questionStatus(p) === 'partial').length : 0;
  const notAttemptedCount  = test ? test.problems.length - completedCount - partialCount : 0;

  const fmtTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };


  // ── Submitted view ──
  if (submission) {
    return (
      <div className="space-y-6 pb-12">
        <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/coding-test')} className="gap-1.5 rounded-xl">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Coding Tests
        </Button>
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg">
            <Code2 className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{test.title}</h1>
            <p className="text-slate-500 text-sm">Score: {submission.obtainedMarks} / {submission.totalMarks}</p>
          </div>
        </div>
        <div className="space-y-3">
          {test.problems.map(p => {
            const a = submission.answers.find(x => x.problemId === p.problemId);
            return (
              <Card key={p.problemId} className="border-slate-200">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="font-semibold text-slate-900">{p.title}</p>
                    <Badge className="bg-emerald-100 text-emerald-700">
                      {a?.marksAwarded ?? 0}/{p.marks} marks · {a?.passedCount ?? 0}/{a?.totalCount ?? p.testCases.length} test cases passed
                    </Badge>
                  </div>
                  <pre className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs overflow-x-auto font-mono">{a?.code}</pre>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // Block clipboard events on the code editor
  const blockClipboard = (e: React.ClipboardEvent) => {
    e.preventDefault();
    handleViolation('Copy/paste is not allowed during the test.');
  };

  // ── Attempt view ──
  return (
    <div className="space-y-6 pb-12">
      {/* Violation warning banner */}
      {warning && (
        <div className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm font-medium border ${
          violations >= MAX_VIOLATIONS
            ? 'bg-red-50 border-red-300 text-red-700'
            : 'bg-amber-50 border-amber-300 text-amber-800'
        }`}>
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{warning}</span>
        </div>
      )}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg">
            <Code2 className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{test.title}</h1>
            <p className="text-slate-500 text-sm">{test.problems.length} problem(s) · {test.durationMins} min</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {secondsLeft !== null && (
            <Badge variant="outline" className={`gap-1.5 text-sm font-bold px-3 py-1.5 ${secondsLeft <= 60 ? 'text-red-600 border-red-300 bg-red-50' : 'text-slate-700'}`}>
              <Timer className="h-4 w-4" /> {fmtTime(secondsLeft)}
            </Badge>
          )}
          <Button onClick={submitTest} disabled={submitting} className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit Test
          </Button>
        </div>
      </div>

      {/* Progress summary */}
      <div className="flex flex-wrap gap-2">
        <Badge className="gap-1.5 bg-green-100 text-green-700"><CheckCircle2 className="h-3.5 w-3.5" /> Completed: {completedCount}</Badge>
        <Badge className="gap-1.5 bg-amber-100 text-amber-700"><CircleDot className="h-3.5 w-3.5" /> Partially correct: {partialCount}</Badge>
        <Badge className="gap-1.5 bg-slate-100 text-slate-600"><Circle className="h-3.5 w-3.5" /> Not attempted: {notAttemptedCount}</Badge>
      </div>

      {/* Problem tabs */}
      <div className="flex gap-2 flex-wrap">
        {test.problems.map((p, idx) => {
          const status = questionStatus(p);
          return (
            <button key={p.problemId} onClick={() => setActiveIdx(idx)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                activeIdx === idx ? 'bg-emerald-600 text-white border-emerald-600 shadow' : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}>
              {status === 'completed' && <CheckCircle2 className={`h-3.5 w-3.5 ${activeIdx === idx ? 'text-white' : 'text-green-600'}`} />}
              {status === 'partial' && <CircleDot className={`h-3.5 w-3.5 ${activeIdx === idx ? 'text-white' : 'text-amber-500'}`} />}
              {status === 'not_attempted' && <Circle className={`h-3.5 w-3.5 ${activeIdx === idx ? 'text-white' : 'text-slate-300'}`} />}
              {idx + 1}. {p.title || 'Untitled'}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Problem statement */}
        <Card className="border-slate-200">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-slate-900">{problem.title}</h2>
              <Badge variant="outline" className="capitalize">{problem.difficulty}</Badge>
              <Badge variant="outline">{problem.marks} marks</Badge>
              <Badge variant="outline">{selectedLang[problem.problemId] || problem.language}</Badge>
            </div>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{problem.description}</p>
            {problem.testCases.filter(tc => !tc.hidden).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500">Sample Test Cases</p>
                {problem.testCases.filter(tc => !tc.hidden).map((tc, i) => (
                  <div key={i} className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono space-y-1">
                    <div><span className="text-slate-400">Input: </span>{tc.input || '(none)'}</div>
                    <div><span className="text-slate-400">Output: </span>{tc.expectedOutput}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Code editor */}
        <Card className="border-slate-200">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-semibold text-slate-700">Code Editor</p>
              <select
                value={selectedLang[problem.problemId] || problem.language}
                onChange={e => {
                  const lang = e.target.value;
                  setSelectedLang(prev => ({ ...prev, [problem.problemId]: lang }));
                  setCode(prev => ({ ...prev, [problem.problemId]: LANGUAGE_SKELETONS[lang] || LANGUAGE_SKELETONS.javascript }));
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                {Object.keys(LANGUAGE_SKELETONS).map(lang => (
                  <option key={lang} value={lang}>{lang.charAt(0).toUpperCase() + lang.slice(1)}</option>
                ))}
              </select>
            </div>
            <Textarea
              value={code[problem.problemId] ?? ''}
              onChange={e => setCode(c => ({ ...c, [problem.problemId]: e.target.value }))}
              onPaste={blockClipboard}
              onCopy={blockClipboard}
              onCut={blockClipboard}
              className="rounded-xl min-h-72 font-mono text-sm"
              placeholder={`Write your ${selectedLang[problem.problemId] || problem.language} code here...`}
            />
            <Button type="button" variant="outline" onClick={runCode} disabled={running} className="gap-2 rounded-xl">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run on Sample Test Cases
            </Button>

            {runResult && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700">
                  {runResult.passedCount}/{runResult.totalCount} sample test case(s) passed
                </p>
                {runResult.details.map((d: any, i: number) => (
                  <div key={i} className={`p-2 rounded-xl border text-xs font-mono space-y-1 ${d.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-1.5 font-semibold">
                      {d.passed ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <XCircle className="h-3.5 w-3.5 text-red-500" />}
                      Test Case {i + 1}
                    </div>
                    <div><span className="text-slate-400">Output: </span>{d.output || '(empty)'}</div>
                    {d.error && <div className="text-red-500">Error: {d.error}</div>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" disabled={activeIdx === 0} onClick={() => { setActiveIdx(i => i - 1); }} className="gap-1.5 rounded-xl">
          <ArrowLeft className="h-3.5 w-3.5" /> Previous
        </Button>
        <Button variant="outline" disabled={activeIdx === test.problems.length - 1} onClick={() => setActiveIdx(i => i + 1)} className="gap-1.5 rounded-xl">
          Next <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
