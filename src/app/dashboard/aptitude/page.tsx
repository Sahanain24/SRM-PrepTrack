'use client';
/**
 * Aptitude Arena — two modes:
 *   1. Single Topic  : practise one specific topic
 *   2. Mixed Test    : teacher-style assessment across multiple topics
 *
 * Single overall countdown timer. Step-by-step solutions after results.
 * Copy/paste blocked. Sidebar hidden (layout.tsx handles this).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getCurrentUser } from '@/lib/mock-db';
import { generateAptitudeFlow, GenerateAptitudeOutput } from '@/ai/flows/generate-aptitude-flow';
import {
  Brain, Timer, Target, CheckCircle2, XCircle, ChevronRight, ChevronLeft,
  RotateCcw, Loader2, Lightbulb, Flag, AlertTriangle, TrendingUp,
  ListOrdered, ArrowLeft, Shuffle, BookOpen,
} from 'lucide-react';

const SECONDS_PER_QUESTION = 90;
const COUNTS = [5, 10, 15, 20];

// All placement aptitude topics
const APTITUDE_TOPICS = [
  { category: 'Quantitative',
    topics: ['Time & Work','Time, Speed & Distance','Pipes & Cisterns','Profit & Loss',
              'Simple & Compound Interest','Percentages','Ratio & Proportion','Averages',
              'Mixtures & Alligations','Number Systems','Permutation & Combination','Probability'] },
  { category: 'Logical',
    topics: ['Blood Relations','Seating Arrangements','Syllogisms','Coding & Decoding',
              'Series Completion','Analogies','Direction Sense','Clocks & Calendars',
              'Puzzles','Data Sufficiency'] },
  { category: 'Verbal',
    topics: ['Reading Comprehension','Sentence Completion','Error Spotting',
              'Para Jumbles','Synonyms & Antonyms','Idioms & Phrases'] },
  { category: 'Data Interpretation',
    topics: ['Bar Charts','Pie Charts','Line Graphs','Tables & Caselets'] },
];

// Preset mixed test categories for teacher-assessment mode
const MIXED_PRESETS = [
  {
    label: 'Full Placement Mock',
    description: 'Covers all major categories — ideal for final placement prep',
    topics: ['Time & Work','Time, Speed & Distance','Profit & Loss','Percentages',
              'Blood Relations','Syllogisms','Coding & Decoding','Series Completion',
              'Synonyms & Antonyms','Data Interpretation — Bar Charts'],
    color: 'from-indigo-500 to-violet-600',
  },
  {
    label: 'Quant + Logical',
    description: 'Core quantitative and logical reasoning',
    topics: ['Time & Work','Profit & Loss','Percentages','Ratio & Proportion',
              'Blood Relations','Seating Arrangements','Syllogisms','Direction Sense'],
    color: 'from-blue-500 to-cyan-600',
  },
  {
    label: 'Verbal + Data',
    description: 'English and data interpretation combined',
    topics: ['Reading Comprehension','Sentence Completion','Error Spotting',
              'Para Jumbles','Bar Charts','Pie Charts','Line Graphs','Tables & Caselets'],
    color: 'from-emerald-500 to-teal-600',
  },
  {
    label: 'Custom Mix',
    description: 'Pick any combination of topics yourself',
    topics: [],
    color: 'from-orange-500 to-rose-600',
  },
];

type Phase = 'setup' | 'generating' | 'exam' | 'results';
type Mode  = 'single' | 'mixed';

function fmt(s: number) {
  const safe = Math.max(0, Math.floor(s));
  return `${Math.floor(safe / 60).toString().padStart(2, '0')}:${(safe % 60).toString().padStart(2, '0')}`;
}

// ── Setup ─────────────────────────────────────────────────────────────────────
function SetupScreen({ onStart }: {
  onStart: (topic: string, count: number, topics?: string[]) => void;
}) {
  const [mode, setMode]                         = useState<Mode>('single');
  const [selectedTopic, setSelectedTopic]       = useState('');
  const [selectedPreset, setSelectedPreset]     = useState<number | null>(null);
  const [customTopics, setCustomTopics]         = useState<string[]>([]);
  const [count, setCount]                       = useState(10);

  const activeTopics = selectedPreset !== null
    ? (MIXED_PRESETS[selectedPreset].topics.length > 0
        ? MIXED_PRESETS[selectedPreset].topics
        : customTopics)
    : [];

  const canStart = mode === 'single' ? !!selectedTopic : activeTopics.length >= 2;
  const totalMins = Math.ceil((count * SECONDS_PER_QUESTION) / 60);

  const handleStart = () => {
    if (mode === 'single') {
      onStart(selectedTopic, count);
    } else {
      onStart('Mixed', count, activeTopics);
    }
  };

  const toggleCustomTopic = (t: string) => {
    setCustomTopics(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pt-4 pb-12">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-600 text-white shadow-lg">
          <Brain className="h-10 w-10" />
        </div>
        <h1 className="text-4xl font-headline font-bold text-slate-900">Aptitude Arena</h1>
        <p className="text-slate-500">Placement-level practice. <strong>90s per question total time.</strong> Step-by-step solutions after.</p>
      </div>

      {/* Mode selector */}
      <Tabs value={mode} onValueChange={v => { setMode(v as Mode); setSelectedTopic(''); setSelectedPreset(null); setCustomTopics([]); }}>
        <TabsList className="bg-slate-100 rounded-xl w-full">
          <TabsTrigger value="single" className="flex-1 rounded-lg flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Single Topic Practice
          </TabsTrigger>
          <TabsTrigger value="mixed" className="flex-1 rounded-lg flex items-center gap-2">
            <Shuffle className="h-4 w-4" /> Mixed Topic Test
          </TabsTrigger>
        </TabsList>

        {/* ── Single Topic ── */}
        <TabsContent value="single" className="space-y-5 mt-4">
          <p className="text-sm text-slate-500">Pick one topic to focus on and practise deeply.</p>
          {APTITUDE_TOPICS.map(cat => (
            <div key={cat.category} className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">{cat.category}</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {cat.topics.map(t => (
                  <button key={t} onClick={() => setSelectedTopic(t)}
                    className={`text-left px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all
                      ${selectedTopic === t
                        ? 'border-orange-500 bg-orange-50 text-orange-800 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-orange-300 hover:bg-orange-50/40'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </TabsContent>

        {/* ── Mixed Topic ── */}
        <TabsContent value="mixed" className="space-y-5 mt-4">
          <p className="text-sm text-slate-500">
            A single test covering <strong>multiple topics</strong> — ideal for overall placement assessment.
            Questions are distributed across all selected topics.
          </p>

          {/* Presets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MIXED_PRESETS.map((preset, idx) => (
              <button key={idx} onClick={() => { setSelectedPreset(idx); setCustomTopics([]); }}
                className={`text-left p-4 rounded-2xl border-2 transition-all duration-200
                  ${selectedPreset === idx
                    ? 'border-indigo-500 bg-indigo-50 shadow-md'
                    : 'border-slate-200 bg-white hover:border-indigo-300'}`}>
                <div className={`inline-flex p-1.5 rounded-lg bg-gradient-to-br ${preset.color} text-white mb-2`}>
                  <Shuffle className="h-4 w-4" />
                </div>
                <p className="font-semibold text-slate-900 text-sm">{preset.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{preset.description}</p>
                {preset.topics.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {preset.topics.slice(0, 4).map(t => (
                      <span key={t} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{t}</span>
                    ))}
                    {preset.topics.length > 4 && <span className="text-[10px] text-slate-400">+{preset.topics.length - 4} more</span>}
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Custom topic selector — shown when "Custom Mix" is selected */}
          {selectedPreset === 3 && (
            <div className="space-y-3 bg-slate-50 rounded-2xl border border-slate-200 p-4">
              <Label className="text-sm font-semibold text-slate-700">
                Select topics for your custom mix
                {customTopics.length > 0 && <span className="ml-2 text-xs text-orange-600 font-normal">{customTopics.length} selected</span>}
              </Label>
              {APTITUDE_TOPICS.map(cat => (
                <div key={cat.category} className="space-y-1.5">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{cat.category}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {cat.topics.map(t => (
                      <button key={t} onClick={() => toggleCustomTopic(t)}
                        className={`text-left px-2.5 py-2 rounded-lg border text-xs font-medium transition-all
                          ${customTopics.includes(t)
                            ? 'border-orange-500 bg-orange-100 text-orange-800'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-orange-300'}`}>
                        {customTopics.includes(t) && <CheckCircle2 className="inline h-3 w-3 mr-1 text-orange-600" />}
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {customTopics.length < 2 && (
                <p className="text-xs text-red-500">Please select at least 2 topics.</p>
              )}
            </div>
          )}

          {/* Show selected topics for non-custom presets */}
          {selectedPreset !== null && selectedPreset !== 3 && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-indigo-700 mb-2">Topics in this test:</p>
              <div className="flex flex-wrap gap-1.5">
                {MIXED_PRESETS[selectedPreset].topics.map(t => (
                  <span key={t} className="text-xs bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">{t}</span>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Question count + start — shown when selection is valid */}
      {canStart && (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-3">
          <Label className="text-sm font-semibold text-slate-700">Number of Questions</Label>
          <div className="grid grid-cols-4 gap-3">
            {COUNTS.map(n => (
              <button key={n} onClick={() => setCount(n)}
                className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-all
                  ${count === n ? 'bg-orange-500 text-white border-orange-500' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                {n}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400">
            ⏱ Total time: <strong>{fmt(count * SECONDS_PER_QUESTION)}</strong> ({totalMins} min)
            {mode === 'mixed' && ` across ${activeTopics.length} topics`}
          </p>
        </div>
      )}

      {canStart && (
        <Button onClick={handleStart}
          className="w-full h-12 bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white rounded-xl shadow-lg text-base font-semibold">
          {mode === 'single'
            ? `Start — ${selectedTopic}`
            : `Start Mixed Test (${activeTopics.length} topics)`}
          <ChevronRight className="h-5 w-5 ml-1" />
        </Button>
      )}
    </div>
  );
}

// ── Exam Screen ───────────────────────────────────────────────────────────────
function ExamScreen({ examData, totalSeconds, onComplete }: {
  examData: GenerateAptitudeOutput;
  totalSeconds: number;
  onComplete: (answers: number[], timeTaken: number) => void;
}) {
  const [idx, setIdx]           = useState(0);
  const [answers, setAnswers]   = useState<(number | null)[]>(Array(examData.questions.length).fill(null));
  const [flagged, setFlagged]   = useState<boolean[]>(Array(examData.questions.length).fill(false));
  const [timeLeft, setTimeLeft] = useState(totalSeconds);
  const startedAt               = useRef(Date.now());
  const timerRef                = useRef<NodeJS.Timeout | null>(null);

  const q        = examData.questions[idx];
  const answered = answers.filter(a => a !== null).length;

  const submitExam = useCallback((currentAnswers: (number | null)[]) => {
    clearInterval(timerRef.current!);
    const elapsed = Math.round((Date.now() - startedAt.current) / 1000);
    onComplete(currentAnswers.map(a => a ?? -1), elapsed);
  }, [onComplete]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setAnswers(latest => { submitExam(latest); return latest; });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, []);

  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    document.addEventListener('copy', block);
    document.addEventListener('cut', block);
    document.addEventListener('contextmenu', block);
    return () => {
      document.removeEventListener('copy', block);
      document.removeEventListener('cut', block);
      document.removeEventListener('contextmenu', block);
    };
  }, []);

  // ── Tab-switch / focus-loss detection ──────────────────────────────────────
  const [tabSwitches, setTabSwitches] = useState(0);
  const MAX_TAB_SWITCHES = 3;

  useEffect(() => {
    const handleViolation = () => {
      setTabSwitches(prev => {
        const next = prev + 1;
        if (next >= MAX_TAB_SWITCHES) {
          setAnswers(latest => { submitExam(latest); return latest; });
        } else {
          alert(
            `Warning ${next}/${MAX_TAB_SWITCHES}: Switching tabs or leaving the exam window is not allowed.\n` +
            `The exam will be auto-submitted after ${MAX_TAB_SWITCHES} violations.`
          );
        }
        return next;
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) handleViolation();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleViolation);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleViolation);
    };
  }, [submitExam]);

  // ── Calculator ────────────────────────────────────────────────────────────
  const [calcOpen,    setCalcOpen]    = useState(false);
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcPrev,    setCalcPrev]    = useState('');
  const [calcOp,      setCalcOp]      = useState('');
  const [calcFresh,   setCalcFresh]   = useState(true);

  const calcPress = (val: string) => {
    if (val === 'C') {
      setCalcDisplay('0'); setCalcPrev(''); setCalcOp(''); setCalcFresh(true); return;
    }
    if (val === '⌫') {
      setCalcDisplay(d => d.length > 1 ? d.slice(0, -1) : '0'); return;
    }
    if (['+', '−', '×', '÷'].includes(val)) {
      setCalcPrev(calcDisplay); setCalcOp(val); setCalcFresh(true); return;
    }
    if (val === '=') {
      if (!calcOp || !calcPrev) return;
      const a = parseFloat(calcPrev), b = parseFloat(calcDisplay);
      const res = calcOp === '+' ? a + b : calcOp === '−' ? a - b : calcOp === '×' ? a * b : b !== 0 ? a / b : 'Error';
      setCalcDisplay(typeof res === 'number' ? parseFloat(res.toFixed(10)).toString() : 'Error');
      setCalcPrev(''); setCalcOp(''); setCalcFresh(true); return;
    }
    if (val === '.' && calcDisplay.includes('.')) return;
    setCalcDisplay(d => calcFresh ? (val === '.' ? '0.' : val) : (d === '0' && val !== '.' ? val : d + val));
    setCalcFresh(false);
  };

  const CALC_KEYS = [
    ['C', '⌫', '÷', '×'],
    ['7', '8', '9', '−'],
    ['4', '5', '6', '+'],
    ['1', '2', '3', '='],
    ['.', '0'],
  ];

  const warn    = timeLeft <= 60;
  const timePct = (timeLeft / totalSeconds) * 100;

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-12 select-none" onCopy={e => e.preventDefault()}>
      {/* Top bar */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-3 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 text-sm">{examData.title}</span>
          <span className="text-xs text-slate-400">{answered}/{examData.questions.length} answered</span>
          {tabSwitches > 0 && (
            <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              Tab switches: {tabSwitches}/{MAX_TAB_SWITCHES}
            </span>
          )}
        </div>
        <div className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono font-bold text-base transition-all duration-300
          ${warn ? 'bg-red-100 text-red-600 ring-2 ring-red-400 animate-pulse scale-110' : 'bg-slate-100 text-slate-700'}`}>
          <Timer className="h-5 w-5" />
          {fmt(timeLeft)}
          {warn && <span className="text-xs ml-1 font-normal">Hurry up!</span>}
        </div>
      </div>

      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-1000 ${warn ? 'bg-red-500' : 'bg-orange-500'}`}
          style={{ width: `${timePct}%` }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider text-orange-500">Q{idx + 1} / {examData.questions.length}</span>
                    <Badge variant="outline" className="text-xs font-normal text-slate-500">{q.topic}</Badge>
                    {flagged[idx] && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1"><Flag className="h-3 w-3" />Flagged</span>}
                  </div>
                  <CardTitle className="text-lg font-semibold text-slate-900 leading-snug">{q.question}</CardTitle>
                </div>
                <button onClick={() => setFlagged(f => { const n = [...f]; n[idx] = !n[idx]; return n; })}
                  className={`p-2 rounded-xl transition-all flex-shrink-0 ${flagged[idx] ? 'bg-amber-100 text-amber-600' : 'bg-slate-50 text-slate-400 hover:bg-amber-50 hover:text-amber-500'}`}>
                  <Flag className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="pt-5 space-y-3">
              {q.options.map((opt, oidx) => {
                const sel = answers[idx] === oidx;
                return (
                  <button key={oidx}
                    onClick={() => setAnswers(a => { const n = [...a]; n[idx] = oidx; return n; })}
                    className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all
                      ${sel ? 'border-orange-500 bg-orange-50 shadow-sm' : 'border-slate-200 bg-white hover:border-orange-300 hover:bg-orange-50/50'}`}>
                    <span className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold
                      ${sel ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {['A', 'B', 'C', 'D'][oidx]}
                    </span>
                    <span className={`text-sm font-medium leading-relaxed ${sel ? 'text-orange-900' : 'text-slate-700'}`}>{opt}</span>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setIdx(i => i - 1)} disabled={idx === 0} className="rounded-xl">
              <ChevronLeft className="h-4 w-4 mr-1" />Previous
            </Button>
            {idx === examData.questions.length - 1 ? (
              <Button onClick={() => submitExam(answers)} className="rounded-xl px-6 bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle2 className="h-4 w-4 mr-2" />Submit
              </Button>
            ) : (
              <Button onClick={() => setIdx(i => i + 1)} className="rounded-xl px-6 bg-orange-500 hover:bg-orange-600 text-white">
                Next<ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>

        {/* Navigator */}
        <div className="lg:col-span-1">
          <Card className="border-slate-200 shadow-sm sticky top-4">
            <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm font-semibold text-slate-700">Navigator</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-5 gap-1.5">
                {examData.questions.map((_, i) => (
                  <button key={i} onClick={() => setIdx(i)}
                    className={`w-full aspect-square rounded-lg text-xs font-bold transition-all
                      ${i === idx ? 'bg-orange-500 text-white ring-2 ring-orange-300' :
                        flagged[i] ? 'bg-amber-100 text-amber-700 border border-amber-300' :
                        answers[i] !== null ? 'bg-green-100 text-green-700 border border-green-300' :
                        'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                    {i + 1}
                  </button>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <Progress value={(answered / examData.questions.length) * 100} className="h-2 mb-1" />
                <p className="text-xs text-center text-slate-500">{answered} of {examData.questions.length} answered</p>
              </div>
            </CardContent>
          </Card>

          {/* Calculator */}
          <Card className="border-slate-200 shadow-sm mt-3">
            <button
              type="button"
              onClick={() => setCalcOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
            >
              <span className="flex items-center gap-2">🧮 Calculator</span>
              <span className="text-slate-400 text-xs">{calcOpen ? '▲' : '▼'}</span>
            </button>
            {calcOpen && (
              <CardContent className="pt-0 pb-3 px-3">
                {/* Display */}
                <div className="bg-slate-900 text-white rounded-xl px-4 py-3 mb-3 text-right">
                  {calcOp && <p className="text-[10px] text-slate-400">{calcPrev} {calcOp}</p>}
                  <p className="text-2xl font-mono font-bold tracking-tight overflow-hidden text-ellipsis">{calcDisplay}</p>
                </div>
                {/* Keys */}
                <div className="space-y-1.5">
                  {CALC_KEYS.map((row, ri) => (
                    <div key={ri} className="flex gap-1.5">
                      {row.map(k => {
                        const isOp  = ['+', '−', '×', '÷'].includes(k);
                        const isEq  = k === '=';
                        const isCl  = k === 'C';
                        const isWide = row.length < 4;
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => calcPress(k)}
                            className={`${isWide ? 'flex-1' : 'flex-1'} py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95
                              ${isCl  ? 'bg-red-100 text-red-700 hover:bg-red-200' :
                                isEq  ? 'bg-orange-500 text-white hover:bg-orange-600' :
                                isOp  ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' :
                                        'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}
                          >
                            {k}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Results ───────────────────────────────────────────────────────────────────
function ResultsScreen({ examData, answers, score, timeTaken, onRestart }: {
  examData: GenerateAptitudeOutput; answers: number[]; score: number; timeTaken: number; onRestart: () => void;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<number | null>(null);
  const pct     = Math.round((score / examData.questions.length) * 100);
  const letters = ['A', 'B', 'C', 'D'];
  const gradBg  = pct >= 80 ? 'from-green-500 to-emerald-600' : pct >= 60 ? 'from-yellow-500 to-orange-500' : 'from-red-500 to-rose-600';
  const verdict = pct >= 90 ? 'Outstanding! 🏆' : pct >= 80 ? 'Excellent! ⭐' : pct >= 70 ? 'Good Job! 👍' : pct >= 60 ? 'Pass 📘' : 'Keep Practising 💪';

  // For mixed tests — show topic-wise breakdown
  const topicMap: Record<string, { correct: number; total: number }> = {};
  examData.questions.forEach((q, i) => {
    if (!topicMap[q.topic]) topicMap[q.topic] = { correct: 0, total: 0 };
    topicMap[q.topic].total++;
    if (answers[i] === q.correctIndex) topicMap[q.topic].correct++;
  });
  const uniqueTopics = Object.keys(topicMap);
  const isMixed = uniqueTopics.length > 1;

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12 pt-4">
      <h2 className="text-2xl font-headline font-bold text-slate-900">Aptitude Results</h2>

      <Card className="overflow-hidden border-0 shadow-xl">
        <div className={`bg-gradient-to-br ${gradBg} p-5 sm:p-8 text-white text-center`}>
          <p className="text-lg font-medium opacity-90 mb-1">{verdict}</p>
          <div className="text-7xl font-black my-3">{pct}%</div>
          <p className="text-white/80">{score} correct out of {examData.questions.length}</p>
        </div>
        <CardContent className="py-5">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Score',    value: `${score}/${examData.questions.length}`, icon: Target,    color: 'text-orange-600' },
              { label: 'Accuracy', value: `${pct}%`,                               icon: TrendingUp, color: pct >= 60 ? 'text-green-600' : 'text-red-500' },
              { label: 'Time',     value: fmt(timeTaken),                           icon: Timer,      color: 'text-slate-600' },
            ].map(s => (
              <div key={s.label} className="flex flex-col items-center gap-1 p-3 bg-slate-50 rounded-xl">
                <s.icon className={`h-5 w-5 ${s.color}`} />
                <span className={`text-xl font-bold ${s.color}`}>{s.value}</span>
                <span className="text-xs text-slate-500">{s.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Topic-wise breakdown — shown for mixed tests */}
      {isMixed && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700">Topic-wise Performance</CardTitle>
            <CardDescription className="text-xs">Breakdown of your score by topic</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {uniqueTopics.map(topic => {
                const { correct, total } = topicMap[topic];
                const tpct = Math.round((correct / total) * 100);
                return (
                  <div key={topic} className="flex items-center gap-3">
                    <span className="text-sm text-slate-700 w-48 flex-shrink-0 truncate">{topic}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${tpct >= 80 ? 'bg-green-500' : tpct >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${tpct}%` }}
                      />
                    </div>
                    <span className={`text-sm font-bold w-16 text-right ${tpct >= 80 ? 'text-green-600' : tpct >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>
                      {correct}/{total} ({tpct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step-by-step review */}
      <p className="font-semibold text-slate-800 text-lg">Step-by-Step Solutions</p>
      <div className="space-y-3">
        {examData.questions.map((q, i) => {
          const ua = answers[i], ok = ua === q.correctIndex, skip = ua === -1, open = expanded === i;
          return (
            <Card key={i} className={`border-2 shadow-sm ${skip ? 'border-slate-200' : ok ? 'border-green-200' : 'border-red-200'}`}>
              <button className="w-full text-left" onClick={() => setExpanded(open ? null : i)}>
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center ${skip ? 'bg-slate-200' : ok ? 'bg-green-100' : 'bg-red-100'}`}>
                      {skip ? <AlertTriangle className="h-4 w-4 text-slate-500" /> : ok ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-bold text-slate-400">Q{i + 1}</span>
                        <Badge variant="outline" className="text-xs font-normal text-slate-500">{q.topic}</Badge>
                        <span className={`text-xs font-semibold ${skip ? 'text-slate-500' : ok ? 'text-green-600' : 'text-red-600'}`}>
                          {skip ? 'Skipped' : ok ? 'Correct' : 'Incorrect'}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-800 leading-snug">{q.question}</p>
                    </div>
                    <ChevronRight className={`h-4 w-4 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
                  </div>
                </CardHeader>
              </button>
              {open && (
                <CardContent className="pt-0 space-y-4 border-t border-slate-100">
                  <div className="space-y-2 mt-3">
                    {q.options.map((opt, oi) => {
                      const isUser = ua === oi, isCorrect = q.correctIndex === oi;
                      return (
                        <div key={oi} className={`flex items-start gap-3 p-3 rounded-xl border
                          ${isCorrect ? 'bg-green-50 border-green-300' : isUser && !isCorrect ? 'bg-red-50 border-red-300' : 'bg-slate-50 border-slate-200'}`}>
                          <span className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold
                            ${isCorrect ? 'bg-green-600 text-white' : isUser ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                            {letters[oi]}
                          </span>
                          <span className={`text-sm ${isCorrect ? 'text-green-800 font-medium' : isUser ? 'text-red-800' : 'text-slate-600'}`}>{opt}</span>
                          {isCorrect && <CheckCircle2 className="h-4 w-4 text-green-600 ml-auto flex-shrink-0 mt-0.5" />}
                          {isUser && !isCorrect && <XCircle className="h-4 w-4 text-red-500 ml-auto flex-shrink-0 mt-0.5" />}
                        </div>
                      );
                    })}
                  </div>
                  {q.stepByStep?.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <ListOrdered className="h-4 w-4 text-blue-600" />
                        <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Step-by-Step Solution</p>
                      </div>
                      <ol className="space-y-2">
                        {q.stepByStep.map((step: string, si: number) => (
                          <li key={si} className="text-sm text-blue-900 leading-relaxed flex gap-2">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-xs font-bold">{si + 1}</span>
                            <span>{step.replace(/^Step \d+:\s*/i, '')}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                    <Lightbulb className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">Key Insight</p>
                      <p className="text-sm text-amber-900 leading-relaxed">{q.explanation}</p>
                      {q.formula && <p className="text-xs text-amber-700 mt-1 font-mono bg-amber-100 px-2 py-1 rounded-lg inline-block">{q.formula}</p>}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
        <div className="flex justify-center gap-3 pt-2 flex-wrap">
          <Button onClick={onRestart} className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-8">
            <RotateCcw className="h-4 w-4 mr-2" />Practice Another
          </Button>
          <Button onClick={() => router.push('/dashboard')} variant="outline" className="rounded-xl px-6">
            <ArrowLeft className="h-4 w-4 mr-2" />Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AptitudePage() {
  const { toast } = useToast();

  const signalExamActive = (active: boolean) => {
    window.dispatchEvent(new CustomEvent('examActiveChange', { detail: active }));
  };

  const [phase, setPhase] = useState<Phase>('setup');
  const [examData, setExamData] = useState<GenerateAptitudeOutput | null>(null);
  const [topic, setTopic]       = useState('');
  const [count, setCount]       = useState(10);
  const [answers, setAnswers]   = useState<number[]>([]);
  const [score, setScore]       = useState(0);
  const [timeTaken, setTimeTaken] = useState(0);

  const handleStart = async (t: string, n: number, topics?: string[]) => {
    setTopic(topics ? `Mixed (${topics.length} topics)` : t);
    setCount(n);
    setPhase('generating');
    try {
      const data = await generateAptitudeFlow(
        topics && topics.length > 0
          ? { topic: 'Mixed', topics, count: n }
          : { topic: t, count: n }
      );
      setExamData(data);
      setPhase('exam');
      signalExamActive(true);
    } catch (err) {
      console.error(err);
      toast({ title: 'Failed to generate questions. Please try again.', variant: 'destructive' });
      setPhase('setup');
    }
  };

  const handleComplete = async (userAnswers: number[], time: number) => {
    if (!examData) return;
    const correct = examData.questions.reduce((acc, q, i) => acc + (q.correctIndex === userAnswers[i] ? 1 : 0), 0);
    const pct = Math.round((correct / examData.questions.length) * 100);
    setAnswers(userAnswers); setScore(correct); setTimeTaken(time); setPhase('results');
    signalExamActive(false);
    try {
      const user = getCurrentUser();
      if (user) {
        await fetch('/api/aptitude-results', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user._id || user.id, userName: user.name,
            topic, score: correct, total: examData.questions.length, percentage: pct,
            timeTaken: time, answers: userAnswers,
            correctAnswers: examData.questions.map(q => q.correctIndex),
            questions: examData.questions, date: new Date().toISOString(),
          }),
        });
      }
    } catch (e) { console.error('Save failed:', e); }
  };

  const handleRestart = () => { signalExamActive(false); setPhase('setup'); setExamData(null); };

  if (phase === 'generating') return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center">
          <Brain className="h-10 w-10 text-orange-500" />
        </div>
        <div className="absolute inset-0 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-xl font-semibold text-slate-800">Generating Questions…</p>
        <p className="text-slate-500 text-sm">AI is preparing {topic} questions with step-by-step solutions</p>
      </div>
    </div>
  );

  if (phase === 'exam' && examData)
    return <ExamScreen examData={examData} totalSeconds={count * SECONDS_PER_QUESTION} onComplete={handleComplete} />;

  if (phase === 'results' && examData)
    return <ResultsScreen examData={examData} answers={answers} score={score} timeTaken={timeTaken} onRestart={handleRestart} />;

  return <SetupScreen onStart={handleStart} />;
}