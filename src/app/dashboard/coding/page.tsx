'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getCurrentUser } from '@/lib/mock-db';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { GenerateCodingProblemOutput } from '@/ai/flows/generate-coding-problem-flow';
import { LANGUAGES, type Language } from '@/lib/coding-constants';
import type { EvaluateCodeOutput } from '@/ai/flows/evaluate-code-flow';
import {
  Code2, Sparkles, Loader2, Play, Eye, EyeOff, Lightbulb,
  ChevronRight, RotateCcw, CheckCircle2, XCircle, AlertTriangle,
  Clock, Trophy, BookOpen, Target, Zap, ChevronDown, ChevronUp,
  Copy, Check,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Arrays', 'Strings', 'Two Pointers', 'Sliding Window',
  'Hashing', 'Sorting', 'Binary Search', 'Recursion',
  'Linked Lists', 'Stack/Queue', 'Trees', 'Graphs',
  'Dynamic Programming', 'Greedy', 'Math', 'Bit Manipulation',
];

const DIFFICULTY_META = {
  easy:   { label: 'Easy',   color: 'text-green-600 bg-green-50 border-green-200' },
  medium: { label: 'Medium', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  hard:   { label: 'Hard',   color: 'text-red-600 bg-red-50 border-red-200'   },
};

const VERDICT_META: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
  'Accepted':            { color: 'text-green-600 bg-green-50 border-green-200', icon: CheckCircle2  },
  'Partial':             { color: 'text-amber-600 bg-amber-50 border-amber-200', icon: AlertTriangle },
  'Wrong Answer':        { color: 'text-red-600 bg-red-50 border-red-200',       icon: XCircle       },
  'Runtime Error':       { color: 'text-red-600 bg-red-50 border-red-200',       icon: XCircle       },
  'Compilation Error':   { color: 'text-red-600 bg-red-50 border-red-200',       icon: XCircle       },
  'Time Limit Exceeded': { color: 'text-orange-600 bg-orange-50 border-orange-200', icon: AlertTriangle },
};

// ── Timer ──────────────────────────────────────────────────────────────────────

function useTimer() {
  const [secs, setSecs]     = useState(0);
  const [running, setRunning] = useState(false);
  const ref = useRef<NodeJS.Timeout | null>(null);

  const start  = useCallback(() => { setRunning(true); }, []);
  const stop   = useCallback(() => { setRunning(false); }, []);
  const reset  = useCallback(() => { setSecs(0); setRunning(false); }, []);

  useEffect(() => {
    if (running) ref.current = setInterval(() => setSecs(s => s + 1), 1000);
    else if (ref.current) clearInterval(ref.current);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running]);

  const fmt = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  return { fmt, secs, start, stop, reset };
}

// ── Code editor with line numbers ──────────────────────────────────────────────

function CodeEditor({ value, onChange, language }: {
  value: string; onChange: (v: string) => void; language: Language;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const linesRef    = useRef<HTMLDivElement>(null);

  const lines     = value.split('\n').length;
  const lineNums  = Array.from({ length: lines }, (_, i) => i + 1);

  // Sync scroll
  const syncScroll = () => {
    if (textareaRef.current && linesRef.current) {
      linesRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Tab support
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta    = textareaRef.current!;
      const start = ta.selectionStart;
      const end   = ta.selectionEnd;
      const newVal = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newVal);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  };

  return (
    <div className="relative flex overflow-hidden rounded-b-xl bg-[#1e1e2e] font-mono text-sm flex-1">
      {/* Line numbers */}
      <div
        ref={linesRef}
        className="select-none text-right text-[#4a4a6a] py-4 px-3 overflow-hidden"
        style={{ minWidth: 44, userSelect: 'none', lineHeight: '1.6rem' }}
      >
        {lineNums.map(n => <div key={n}>{n}</div>)}
      </div>
      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onScroll={syncScroll}
        spellCheck={false}
        className="flex-1 bg-transparent text-[#cdd6f4] outline-none resize-none py-4 pr-4 leading-[1.6rem] caret-[#cba6f7]"
        style={{ lineHeight: '1.6rem' }}
      />
    </div>
  );
}

// ── Copy button ────────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="p-1 rounded text-slate-400 hover:text-slate-200 transition-colors">
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// ── Score ring ─────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r   = 28;
  const circ = 2 * Math.PI * r;
  const pct  = (score / 100) * circ;
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={72} height={72} className="flex-shrink-0">
      <circle cx={36} cy={36} r={r} stroke="#1e1e2e" strokeWidth={6} fill="none" />
      <circle cx={36} cy={36} r={r} stroke={color} strokeWidth={6} fill="none"
        strokeDasharray={circ} strokeDashoffset={circ - pct}
        strokeLinecap="round" transform="rotate(-90 36 36)" />
      <text x={36} y={41} textAnchor="middle" fontSize={14} fontWeight={700} fill={color}>{score}</text>
    </svg>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

type Phase = 'setup' | 'generating' | 'coding' | 'evaluating' | 'result';

interface HistoryEntry {
  title: string; difficulty: string; language: string;
  score: number; verdict: string; timestamp: string;
}

export default function CodingLabPage() {
  const { toast } = useToast();
  const timer     = useTimer();

  // ── Setup state
  const [topic,      setTopic]      = useState('');
  const [difficulty, setDifficulty] = useState<'easy'|'medium'|'hard'>('medium');
  const [language,   setLanguage]   = useState<Language>('Python');

  // ── Problem / result
  const [problem,    setProblem]    = useState<GenerateCodingProblemOutput | null>(null);
  const [code,       setCode]       = useState('');
  const [evaluation, setEvaluation] = useState<EvaluateCodeOutput | null>(null);
  const [phase,      setPhase]      = useState<Phase>('setup');

  // ── UI helpers
  const [hintIdx,      setHintIdx]      = useState(0);
  const [showHints,    setShowHints]    = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [showResult,   setShowResult]   = useState(true);
  const [history,      setHistory]      = useState<HistoryEntry[]>([]);

  // Load history from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('coding_history');
      if (raw) setHistory(JSON.parse(raw));
    } catch { /* silent */ }
  }, []);

  const saveHistory = (entry: HistoryEntry) => {
    const next = [entry, ...history].slice(0, 10);
    setHistory(next);
    localStorage.setItem('coding_history', JSON.stringify(next));
  };

  // ── Generate problem
  const handleGenerate = async (topicOverride?: string) => {
    const t = topicOverride || topic;
    if (!t.trim()) return;
    setTopic(t);
    setPhase('generating');
    setProblem(null);
    setEvaluation(null);
    setHintIdx(0);
    setShowHints(false);
    setShowSolution(false);
    timer.reset();
    try {
      const res = await fetch('/api/ai/generate-coding-problem', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: t, difficulty, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setProblem(data);
      setCode(data.template);
      setPhase('coding');
      timer.start();
    } catch (e: any) {
      toast({ title: 'Generation failed', description: e.message, variant: 'destructive' });
      setPhase('setup');
    }
  };

  // ── Evaluate code
  const handleEvaluate = async () => {
    if (!problem || !code.trim()) return;
    setPhase('evaluating');
    timer.stop();
    try {
      const evalRes = await fetch('/api/ai/evaluate-code', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemTitle:       problem.title,
          problemDescription: problem.description,
          constraints:        problem.constraints,
          examples:           problem.examples,
          language, code,
          referenceSolution:  problem.solution,
        }),
      });
      const result: EvaluateCodeOutput = await evalRes.json();
      if (!evalRes.ok) throw new Error((result as any).error || 'Evaluation failed');
      setEvaluation(result);
      setPhase('result');
      setShowResult(true);

      // Save to history
      const user = getCurrentUser() as any;
      saveHistory({
        title:      problem.title,
        difficulty: problem.difficulty,
        language,
        score:      result.score,
        verdict:    result.verdict,
        timestamp:  new Date().toISOString(),
      });

      // Save submission to DB
      if (user) {
        const userId = user._id || user.id;
        if (userId) {
          const { db } = await import('@/lib/mock-db');
          await db.createCodingSubmission({
            userId,
            problemId: problem.title,
            code,
            result: result.passed ? 'passed' : 'failed',
            date: new Date().toISOString(),
          }).catch(() => {});
        }
      }
    } catch (e: any) {
      toast({ title: 'Evaluation failed', description: e.message, variant: 'destructive' });
      setPhase('coding');
      timer.start();
    }
  };

  // ── Reset
  const reset = () => {
    setProblem(null); setCode(''); setEvaluation(null);
    setPhase('setup'); timer.reset();
    setHintIdx(0); setShowHints(false); setShowSolution(false);
  };

  // ── Retry (keep problem, clear evaluation)
  const retry = () => {
    if (!problem) return;
    setCode(problem.template);
    setEvaluation(null);
    setPhase('coding');
    setShowSolution(false);
    timer.reset(); timer.start();
  };

  // ── Reveal next hint
  const revealHint = () => {
    if (!problem) return;
    if (!showHints) { setShowHints(true); return; }
    if (hintIdx < problem.hints.length - 1) setHintIdx(i => i + 1);
  };

  // ──────────────────────────────────────────────────────────────────────────────
  // SETUP SCREEN
  // ──────────────────────────────────────────────────────────────────────────────
  if (phase === 'setup') return (
    <div className="min-h-[80vh] flex flex-col gap-8 items-center justify-center pb-12">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg mb-2">
          <Code2 className="h-10 w-10" />
        </div>
        <h1 className="text-4xl font-bold text-slate-900">Coding Lab</h1>
        <p className="text-slate-500 max-w-md">AI-generated challenges with real code evaluation, hints, and feedback</p>
      </div>

      <div className="w-full max-w-2xl space-y-6">
        {/* Language */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">Language</p>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map(l => (
              <button key={l} onClick={() => setLanguage(l)}
                className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all
                  ${language === l ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'border-slate-200 text-slate-600 hover:border-indigo-300 bg-white'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">Difficulty</p>
          <div className="flex gap-2">
            {(['easy','medium','hard'] as const).map(d => (
              <button key={d} onClick={() => setDifficulty(d)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold capitalize transition-all
                  ${difficulty === d ? `${DIFFICULTY_META[d].color} border-current shadow` : 'border-slate-200 text-slate-500 bg-white hover:border-slate-300'}`}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Topic input */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">Topic or algorithm</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Binary Search, Two Sum, Fibonacci..."
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGenerate()}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <Button onClick={() => handleGenerate()} disabled={!topic.trim()}
              className="rounded-xl px-6 bg-indigo-600 hover:bg-indigo-700 gap-2">
              <Sparkles className="h-4 w-4" /> Generate
            </Button>
          </div>
        </div>

        {/* Category quick picks */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">Or pick a category</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => handleGenerate(cat)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50 bg-white transition-all">
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">Recent</p>
            <div className="space-y-1.5">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${DIFFICULTY_META[h.difficulty as keyof typeof DIFFICULTY_META]?.color}`}>{h.difficulty}</span>
                  <span className="flex-1 font-medium text-slate-700 truncate">{h.title}</span>
                  <span className="text-xs text-slate-400">{h.language}</span>
                  <span className={`text-xs font-bold ${h.score >= 70 ? 'text-green-600' : 'text-red-500'}`}>{h.score}/100</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ──────────────────────────────────────────────────────────────────────────────
  // GENERATING
  // ──────────────────────────────────────────────────────────────────────────────
  if (phase === 'generating') return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-indigo-100 flex items-center justify-center">
          <Code2 className="h-10 w-10 text-indigo-600" />
        </div>
        <div className="absolute inset-0 rounded-2xl border-4 border-indigo-500 border-t-transparent animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-xl font-semibold text-slate-800">Crafting your challenge…</p>
        <p className="text-slate-500 text-sm mt-1">{difficulty} · {language} · {topic}</p>
      </div>
    </div>
  );

  // ──────────────────────────────────────────────────────────────────────────────
  // CODING + RESULT (IDE layout)
  // ──────────────────────────────────────────────────────────────────────────────
  if (!problem) return null;

  const dm = DIFFICULTY_META[problem.difficulty];
  const isEvaluating = phase === 'evaluating';

  return (
    <div className="flex flex-col gap-0 h-[calc(100vh-4rem)] md:h-[calc(100vh-7rem)]">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-[#1e1e2e] text-white rounded-t-xl flex-shrink-0">
        <button onClick={reset} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
          <RotateCcw className="h-3.5 w-3.5" /> New Problem
        </button>
        <div className="h-4 w-px bg-slate-700" />
        <span className="text-sm font-semibold text-slate-200 flex-1 truncate">{problem.title}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${dm.color}`}>{dm.label}</span>
        <Badge className="bg-slate-700 text-slate-300 border-none text-[10px]">{problem.category}</Badge>
        <Badge className="bg-slate-700 text-slate-300 border-none text-[10px]">{language}</Badge>
        {/* Timer */}
        <div className="flex items-center gap-1 text-xs text-slate-400 ml-2">
          <Clock className="h-3.5 w-3.5" /> {timer.fmt}
        </div>
      </div>

      {/* ── Main split ── */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden gap-0 border-x border-b border-slate-200 rounded-b-xl">

        {/* ── LEFT: Problem panel ── */}
        <div className="md:w-[42%] flex-shrink-0 overflow-y-auto bg-white border-b md:border-b-0 md:border-r border-slate-200 p-4 md:p-5 space-y-5 max-h-56 md:max-h-none">

          {/* Description */}
          <div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{problem.description}</p>
          </div>

          {/* Constraints */}
          {problem.constraints.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Constraints</p>
              <ul className="space-y-1">
                {problem.constraints.map((c, i) => (
                  <li key={i} className="text-xs text-slate-600 font-mono bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5">{c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Examples */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Examples</p>
            <div className="space-y-3">
              {problem.examples.map((ex, i) => (
                <div key={i} className="rounded-xl border border-slate-200 overflow-hidden text-sm">
                  <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500">Example {i + 1}</div>
                  <div className="p-3 space-y-1 font-mono text-xs">
                    <div><span className="text-slate-400">Input:  </span><span className="text-slate-800">{ex.input}</span></div>
                    <div><span className="text-slate-400">Output: </span><span className="text-green-700 font-semibold">{ex.output}</span></div>
                    {ex.explanation && <div className="text-slate-500 font-sans mt-1 text-[11px]">{ex.explanation}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Complexity */}
          <div className="flex gap-4">
            <div className="flex-1 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-center">
              <p className="text-[10px] text-blue-500 font-semibold">TIME</p>
              <p className="text-sm font-bold text-blue-700 font-mono">{problem.timeComplexity}</p>
            </div>
            <div className="flex-1 bg-purple-50 border border-purple-100 rounded-xl px-3 py-2 text-center">
              <p className="text-[10px] text-purple-500 font-semibold">SPACE</p>
              <p className="text-sm font-bold text-purple-700 font-mono">{problem.spaceComplexity}</p>
            </div>
          </div>

          {/* Hints */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Hints</p>
              {showHints && hintIdx < problem.hints.length - 1 && (
                <button onClick={revealHint} className="text-xs text-amber-600 hover:underline">Next hint →</button>
              )}
            </div>
            {!showHints ? (
              <button onClick={revealHint}
                className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700 border border-amber-200 bg-amber-50 hover:bg-amber-100 rounded-xl px-3 py-2 w-full transition-colors">
                <Lightbulb className="h-4 w-4" /> Show Hint 1
              </button>
            ) : (
              <div className="space-y-2">
                {problem.hints.slice(0, hintIdx + 1).map((h, i) => (
                  <div key={i} className="flex gap-2 text-sm text-slate-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                    <span className="text-amber-500 font-bold text-xs mt-0.5 flex-shrink-0">H{i+1}</span>
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Solution reveal */}
          <div>
            <button onClick={() => setShowSolution(s => !s)}
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition-colors">
              {showSolution ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showSolution ? 'Hide Solution' : 'Reveal Solution (spoiler)'}
            </button>
            {showSolution && (
              <div className="mt-2 rounded-xl bg-[#1e1e2e] overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-700">
                  <span className="text-xs text-slate-400">Reference Solution</span>
                  <CopyBtn text={problem.solution} />
                </div>
                <pre className="text-xs text-[#cdd6f4] p-4 overflow-x-auto leading-relaxed">{problem.solution}</pre>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Editor + output ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e2e]">
          {/* Editor toolbar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2a3e] flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-xs text-slate-400 ml-1">solution.{language === 'Python' ? 'py' : language === 'JavaScript' ? 'js' : language === 'Java' ? 'java' : 'cpp'}</span>
            </div>
            <div className="flex items-center gap-2">
              <CopyBtn text={code} />
              <button onClick={() => setCode(problem.template)} title="Reset to template"
                className="text-slate-500 hover:text-slate-300 transition-colors">
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Code editor */}
          <CodeEditor value={code} onChange={setCode} language={language} />

          {/* Run bar */}
          <div className="flex items-center gap-3 px-4 py-3 bg-[#181825] border-t border-[#2a2a3e] flex-shrink-0">
            {phase === 'result' && (
              <button onClick={retry} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors">
                <RotateCcw className="h-3.5 w-3.5" /> Retry
              </button>
            )}
            <div className="flex-1" />
            <Button onClick={handleEvaluate} disabled={isEvaluating || !code.trim()}
              className="gap-2 rounded-xl bg-green-600 hover:bg-green-700 text-white h-9 px-5">
              {isEvaluating
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Evaluating…</>
                : <><Play className="h-4 w-4" /> Run & Submit</>}
            </Button>
          </div>

          {/* ── Result panel ── */}
          {evaluation && phase === 'result' && (
            <div className="bg-[#181825] border-t border-[#2a2a3e] overflow-y-auto" style={{ maxHeight: '42%' }}>
              {/* Result header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2a3e]">
                <div className="flex items-center gap-3">
                  <ScoreRing score={evaluation.score} />
                  <div>
                    <div className={`inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1 rounded-full border ${VERDICT_META[evaluation.verdict]?.color}`}>
                      {(() => { const Icon = VERDICT_META[evaluation.verdict]?.icon || CheckCircle2; return <Icon className="h-3.5 w-3.5" />; })()}
                      {evaluation.verdict}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{evaluation.summary}</p>
                  </div>
                </div>
                <button onClick={() => setShowResult(s => !s)} className="text-slate-500 hover:text-slate-300">
                  {showResult ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </button>
              </div>

              {showResult && (
                <div className="p-4 space-y-4 text-sm">
                  {/* Test results */}
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Test Cases</p>
                    <div className="space-y-1.5">
                      {evaluation.testResults.map((t, i) => (
                        <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs font-mono
                          ${t.status === 'pass' ? 'bg-green-900/30 text-green-300' : t.status === 'fail' ? 'bg-red-900/30 text-red-300' : 'bg-slate-800 text-slate-400'}`}>
                          <span className="flex-shrink-0">{t.status === 'pass' ? '✓' : t.status === 'fail' ? '✗' : '?'}</span>
                          <span>Input: {t.input} → Expected: {t.expected}</span>
                          {t.note && <span className="ml-auto text-[10px] opacity-70 font-sans">{t.note}</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Strengths */}
                    {evaluation.strengths.length > 0 && (
                      <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-green-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Strengths
                        </p>
                        <ul className="space-y-1">
                          {evaluation.strengths.map((s, i) => <li key={i} className="text-xs text-green-300">• {s}</li>)}
                        </ul>
                      </div>
                    )}

                    {/* Improvements */}
                    {evaluation.improvements.length > 0 && (
                      <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                          <Target className="h-3 w-3" /> Improve
                        </p>
                        <ul className="space-y-1">
                          {evaluation.improvements.map((s, i) => <li key={i} className="text-xs text-amber-300">• {s}</li>)}
                        </ul>
                      </div>
                    )}

                    {/* Optimisations */}
                    {evaluation.optimizationTips.length > 0 && (
                      <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                          <Zap className="h-3 w-3" /> Optimise
                        </p>
                        <ul className="space-y-1">
                          {evaluation.optimizationTips.map((s, i) => <li key={i} className="text-xs text-blue-300">• {s}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Corrected code */}
                  {evaluation.correctedCode && (
                    <div className="rounded-xl bg-[#1e1e2e] border border-green-800/40 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-700">
                        <span className="text-xs text-green-400 font-semibold">Suggested Fix</span>
                        <div className="flex gap-2">
                          <CopyBtn text={evaluation.correctedCode} />
                          <button onClick={() => setCode(evaluation.correctedCode!)}
                            className="text-xs text-green-400 hover:text-green-300 transition-colors">Apply</button>
                        </div>
                      </div>
                      <pre className="text-xs text-[#cdd6f4] p-3 overflow-x-auto leading-relaxed">{evaluation.correctedCode}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
