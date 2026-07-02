'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Users, Trophy, Clock, Target, TrendingUp,
  CheckCircle2, XCircle, Loader2, BarChart2, FileText,
  ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight,
  Minus, RefreshCw, RotateCcw, ShieldCheck, ShieldX, AlertTriangle,
  Calendar, CalendarClock,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Result {
  _id: string;
  userId: string;
  userName: string;
  subjectName: string;
  score: number;
  total: number;
  percentage: number;
  timeTaken: number;
  answers: number[];
  correctAnswers: number[];
  questions: any[];
  tabViolations: number;
  date: string;
  createdAt: string;
}

interface StudentGroup {
  userId: string;
  userName: string;
  attempts: Result[];      // chronological
  best: Result;            // highest percentage
  latest: Result;
  trend: 'up' | 'down' | 'same' | 'single';
}

interface ReAttemptPermission {
  userId: string;
  userName: string;
  grantedAt: string;
  used: boolean;
}

interface ExamInfo {
  _id: string;
  title: string;
  subject: string;
  totalQuestions: number;
  totalMarks: number;
  passingMarks: number;
  durationMins: number;
  examDate:     string;
  startTime:    string;
  deadlineDate: string;
  deadlineTime: string;
  reAttemptPermissions: ReAttemptPermission[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(secs: number) {
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}m ${s}s`;
}

function shortDate(iso: string) {
  try { return new Intl.DateTimeFormat('en-GB').format(new Date(iso)); } catch { return '—'; }
}

function shortDateTime(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

const SECTIONS = ['technical', 'aptitude', 'reasoning', 'verbal'] as const;
const SECTION_LABELS: Record<string, string> = {
  technical: 'Technical', aptitude: 'Aptitude', reasoning: 'Reasoning', verbal: 'Verbal',
};
const SECTION_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  technical: { bg: 'bg-blue-50',   text: 'text-blue-700',   bar: 'bg-blue-500'   },
  aptitude:  { bg: 'bg-amber-50',  text: 'text-amber-700',  bar: 'bg-amber-500'  },
  reasoning: { bg: 'bg-purple-50', text: 'text-purple-700', bar: 'bg-purple-500' },
  verbal:    { bg: 'bg-green-50',  text: 'text-green-700',  bar: 'bg-green-500'  },
};

function getSectionStats(result: Result) {
  const stats: Record<string, { correct: number; total: number; pct: number }> = {};
  for (const sec of SECTIONS) {
    const qs = result.questions.filter(q => q.section === sec);
    if (qs.length === 0) continue;
    const correct = qs.filter(q => {
      const qi = result.questions.indexOf(q);
      const correctIdx = q.correctIndex ?? q.options?.findIndex((o: any) => o.isCorrect);
      return result.answers[qi] === correctIdx;
    }).length;
    stats[sec] = { correct, total: qs.length, pct: Math.round((correct / qs.length) * 100) };
  }
  return stats;
}

function groupByStudent(results: Result[]): StudentGroup[] {
  const map = new Map<string, Result[]>();
  for (const r of results) {
    if (!map.has(r.userId)) map.set(r.userId, []);
    map.get(r.userId)!.push(r);
  }
  return Array.from(map.entries()).map(([userId, attempts]) => {
    const sorted = [...attempts].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const best   = sorted.reduce((b, r) => r.percentage > b.percentage ? r : b, sorted[0]);
    const latest = sorted[sorted.length - 1];
    let trend: StudentGroup['trend'] = 'single';
    if (sorted.length > 1) {
      const diff = sorted[sorted.length - 1].percentage - sorted[sorted.length - 2].percentage;
      trend = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
    }
    return { userId, userName: attempts[0].userName, attempts: sorted, best, latest, trend };
  }).sort((a, b) => b.best.percentage - a.best.percentage);
}

// ── Score trend sparkline ──────────────────────────────────────────────────────

function ScoreSparkline({ attempts }: { attempts: Result[] }) {
  if (attempts.length < 2) return null;
  const max = 100;
  const W = 80, H = 28, pad = 4;
  const pts = attempts.map((r, i) => {
    const x = pad + (i / (attempts.length - 1)) * (W - 2 * pad);
    const y = H - pad - ((r.percentage / max) * (H - 2 * pad));
    return `${x},${y}`;
  });
  const lastPct = attempts[attempts.length - 1].percentage;
  return (
    <svg width={W} height={H} className="flex-shrink-0">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={lastPct >= 40 ? '#22c55e' : '#ef4444'}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {attempts.map((r, i) => {
        const [x, y] = pts[i].split(',').map(Number);
        return <circle key={i} cx={x} cy={y} r="2.5" fill={r.percentage >= 40 ? '#22c55e' : '#ef4444'} />;
      })}
    </svg>
  );
}

// ── Student list row ───────────────────────────────────────────────────────────

function StudentRow({
  group, rank, onCompare, permission, onGrant, onRevoke, grantLoading,
}: {
  group: StudentGroup;
  rank: number;
  onCompare: () => void;
  permission: ReAttemptPermission | undefined;
  onGrant: () => void;
  onRevoke: () => void;
  grantLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const passed = group.best.percentage >= 40;

  const TrendIcon =
    group.trend === 'up'   ? ArrowUpRight :
    group.trend === 'down' ? ArrowDownRight : Minus;
  const trendColor =
    group.trend === 'up'   ? 'text-green-600' :
    group.trend === 'down' ? 'text-red-500' : 'text-slate-400';

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Row header */}
      <div className="flex items-center gap-3 px-5 py-4">
        {/* Rank badge */}
        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
          ${rank === 1 ? 'bg-yellow-400 text-white' :
            rank === 2 ? 'bg-slate-300 text-slate-700' :
            rank === 3 ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
          {rank}
        </span>

        {/* Name + attempts */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-900 truncate">{group.userName}</p>
            {group.attempts.length > 1 && (
              <span className="text-[10px] font-bold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">
                {group.attempts.length} attempts
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">{shortDateTime(group.latest.createdAt)}</p>
        </div>

        {/* Sparkline */}
        <ScoreSparkline attempts={group.attempts} />

        {/* Trend */}
        {group.trend !== 'single' && (
          <TrendIcon className={`h-4 w-4 flex-shrink-0 ${trendColor}`} />
        )}

        {/* Tab violations (latest attempt) */}
        {group.latest.tabViolations > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 border border-red-200 flex-shrink-0"
            title={`${group.latest.tabViolations} tab switch violation${group.latest.tabViolations > 1 ? 's' : ''} in latest attempt`}>
            <AlertTriangle className="h-3 w-3 text-red-500" />
            <span className="text-xs font-bold text-red-600">{group.latest.tabViolations}</span>
          </div>
        )}

        {/* Best score */}
        <div className="text-right flex-shrink-0 min-w-[64px]">
          <p className="font-bold text-slate-900">{group.best.score}/{group.best.total}</p>
          <p className={`text-xs font-semibold ${passed ? 'text-green-600' : 'text-red-500'}`}>
            {group.best.percentage}% {passed ? '✓' : '✗'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {group.attempts.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); onCompare(); }}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 hover:border-indigo-400 rounded-lg px-2.5 py-1.5 transition-colors"
            >
              <BarChart2 className="h-3 w-3" /> Compare
            </button>
          )}

          {/* Re-attempt control */}
          {grantLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          ) : permission && !permission.used ? (
            <button
              onClick={(e) => { e.stopPropagation(); onRevoke(); }}
              title="Revoke re-attempt permission"
              className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium border border-amber-200 hover:border-amber-400 rounded-lg px-2.5 py-1.5 transition-colors"
            >
              <ShieldX className="h-3 w-3" /> Revoke
            </button>
          ) : permission && permission.used ? (
            <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium bg-green-50 border border-green-200 rounded-lg px-2 py-1">
              <RotateCcw className="h-3 w-3" /> Re-attempt used
            </span>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onGrant(); }}
              title="Grant one re-attempt"
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-700 font-medium border border-slate-200 hover:border-indigo-300 rounded-lg px-2.5 py-1.5 transition-colors"
            >
              <ShieldCheck className="h-3 w-3" /> Re-attempt
            </button>
          )}

          <button
            onClick={() => setOpen(o => !o)}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </button>
        </div>
      </div>

      {/* Latest attempt detail */}
      {open && group.latest.questions?.length > 0 && (
        <div className="border-t border-slate-100 px-5 py-4 bg-slate-50 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Latest attempt — {shortDateTime(group.latest.createdAt)} · {fmt(group.latest.timeTaken)}
            </p>
            {group.latest.tabViolations > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                <AlertTriangle className="h-3 w-3" />
                {group.latest.tabViolations} tab violation{group.latest.tabViolations > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Section breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SECTIONS.map(sec => {
              const stats = getSectionStats(group.latest)[sec];
              if (!stats) return null;
              const c = SECTION_COLORS[sec];
              return (
                <div key={sec} className={`${c.bg} rounded-xl p-3 text-center`}>
                  <p className={`text-xs font-semibold ${c.text}`}>{SECTION_LABELS[sec]}</p>
                  <p className={`text-lg font-bold ${c.text}`}>{stats.correct}/{stats.total}</p>
                  <p className={`text-xs ${c.text} opacity-80`}>{stats.pct}%</p>
                </div>
              );
            })}
          </div>

          {/* Questions */}
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {group.latest.questions.map((q: any, i: number) => {
              const studentIdx  = group.latest.answers[i];
              const correctIdx  = q.correctIndex ?? q.options?.findIndex((o: any) => o.isCorrect);
              const isRight     = studentIdx === correctIdx;
              return (
                <div key={i} className={`bg-white rounded-lg border p-3 text-sm ${isRight ? 'border-slate-200' : 'border-red-100'}`}>
                  <p className="font-medium text-slate-800 mb-1.5">
                    <span className="text-slate-400 mr-1.5">Q{i + 1}.</span>
                    {q.questionText || q.question}
                    {q.section && <span className="ml-2 text-[10px] font-bold uppercase text-slate-400">[{q.section}]</span>}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {(q.options || []).map((opt: any, oi: number) => {
                      const optText      = typeof opt === 'string' ? opt : opt.text;
                      const isCorrectOpt = oi === correctIdx;
                      const isChosen     = oi === studentIdx;
                      return (
                        <div key={oi} className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5
                          ${isCorrectOpt ? 'bg-green-50 border border-green-200 text-green-800 font-medium' :
                            isChosen ? 'bg-red-50 border border-red-200 text-red-700' :
                            'bg-slate-50 text-slate-500'}`}>
                          {isCorrectOpt ? <CheckCircle2 className="h-3 w-3 text-green-600 flex-shrink-0" /> :
                           isChosen     ? <XCircle      className="h-3 w-3 text-red-500   flex-shrink-0" /> :
                           <span className="w-3" />}
                          {String.fromCharCode(65 + oi)}. {optText}
                          {isChosen && !isCorrectOpt && <span className="ml-auto text-red-400 text-[10px]">student</span>}
                        </div>
                      );
                    })}
                  </div>
                  {!isRight && q.explanation && (
                    <p className="mt-2 text-xs text-slate-500 italic border-l-2 border-slate-200 pl-2">{q.explanation}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Attempt comparison modal ───────────────────────────────────────────────────

function CompareModal({ group, onClose }: { group: StudentGroup; onClose: () => void }) {
  const attempts = group.attempts;
  const questions = attempts[0].questions; // same questions across attempts

  // Per-attempt section stats
  const attemptStats = attempts.map(r => getSectionStats(r));

  // Per-question correctness matrix: matrix[qIdx][attemptIdx] = boolean
  const matrix = questions.map((q: any, qi: number) => {
    const correctIdx = q.correctIndex ?? q.options?.findIndex((o: any) => o.isCorrect);
    return attempts.map(r => r.answers[qi] === correctIdx);
  });

  // Per-question improvement: did the student get it right in the latest attempt but wrong in the first?
  const improved  = matrix.filter(row => !row[0] && row[row.length - 1]).length;
  const regressed = matrix.filter(row =>  row[0] && !row[row.length - 1]).length;
  const consistent_right = matrix.filter(row => row.every(Boolean)).length;
  const consistent_wrong = matrix.filter(row => row.every(v => !v)).length;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <BarChart2 className="h-5 w-5 text-indigo-500" />
            Attempt Comparison — {group.userName}
          </DialogTitle>
          <DialogDescription>
            {attempts.length} attempts · Best score: {group.best.percentage}%
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">

          {/* ── Score timeline ── */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Score Timeline</h3>
            <div className="flex items-end gap-3 overflow-x-auto pb-2">
              {attempts.map((r, i) => {
                const prev = i > 0 ? attempts[i - 1].percentage : null;
                const delta = prev !== null ? r.percentage - prev : null;
                const passed = r.percentage >= 40;
                return (
                  <div key={r._id} className="flex flex-col items-center gap-1.5 min-w-[72px]">
                    {/* Delta badge */}
                    {delta !== null && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
                        ${delta > 0 ? 'bg-green-100 text-green-700' : delta < 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                        {delta > 0 ? `+${delta}` : delta}%
                      </span>
                    )}
                    {/* Bar */}
                    <div className="relative w-12 bg-slate-100 rounded-t-lg overflow-hidden" style={{ height: 80 }}>
                      <div
                        className={`absolute bottom-0 w-full rounded-t-lg transition-all ${passed ? 'bg-indigo-500' : 'bg-red-400'}`}
                        style={{ height: `${r.percentage}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white drop-shadow">
                        {r.percentage}%
                      </span>
                    </div>
                    {/* Attempt label */}
                    <p className="text-[10px] font-semibold text-slate-600">A{i + 1}</p>
                    <p className="text-[10px] text-slate-400 text-center leading-tight">{shortDate(r.createdAt)}</p>
                    <p className="text-[10px] text-slate-400">{fmt(r.timeTaken)}</p>
                    <span className={`text-[10px] font-bold ${passed ? 'text-green-600' : 'text-red-500'}`}>
                      {r.score}/{r.total}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Section breakdown per attempt ── */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Section-wise Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-3 py-2 text-slate-500 font-medium text-xs rounded-tl-lg">Section</th>
                    {attempts.map((r, i) => (
                      <th key={r._id} className="text-center px-3 py-2 text-slate-500 font-medium text-xs">
                        Attempt {i + 1}
                        <span className="block text-[10px] font-normal text-slate-400">{shortDate(r.createdAt)}</span>
                      </th>
                    ))}
                    <th className="text-center px-3 py-2 text-slate-500 font-medium text-xs rounded-tr-lg">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {SECTIONS.map(sec => {
                    const rows = attemptStats.map(s => s[sec]);
                    if (rows.every(r => !r)) return null;
                    const c = SECTION_COLORS[sec];
                    const first = rows.find(r => r);
                    const last  = rows.filter(r => r).pop();
                    const delta = first && last ? last.pct - first.pct : 0;
                    return (
                      <tr key={sec} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <span className={`text-xs font-semibold ${c.text}`}>{SECTION_LABELS[sec]}</span>
                        </td>
                        {rows.map((stats, i) => (
                          <td key={i} className="px-3 py-2 text-center">
                            {stats ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-sm font-bold text-slate-800">{stats.correct}/{stats.total}</span>
                                <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div className={`${c.bar} h-1.5 rounded-full`} style={{ width: `${stats.pct}%` }} />
                                </div>
                                <span className="text-[10px] text-slate-500">{stats.pct}%</span>
                              </div>
                            ) : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-center">
                          <span className={`text-xs font-bold
                            ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                            {delta > 0 ? `+${delta}%` : delta < 0 ? `${delta}%` : '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Improvement summary ── */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Question-level Analysis (Attempt 1 → Latest)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Improved',          count: improved,          color: 'bg-green-50 border-green-200 text-green-700', desc: 'Wrong → Right' },
                { label: 'Regressed',         count: regressed,         color: 'bg-red-50 border-red-200 text-red-600',       desc: 'Right → Wrong' },
                { label: 'Consistently ✓',   count: consistent_right,  color: 'bg-blue-50 border-blue-200 text-blue-700',    desc: 'Right every time' },
                { label: 'Consistently ✗',   count: consistent_wrong,  color: 'bg-slate-50 border-slate-200 text-slate-500', desc: 'Wrong every time' },
              ].map(s => (
                <div key={s.label} className={`rounded-xl border p-3 text-center ${s.color}`}>
                  <p className="text-2xl font-bold">{s.count}</p>
                  <p className="text-xs font-semibold">{s.label}</p>
                  <p className="text-[10px] opacity-70">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Question-by-question comparison grid ── */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Per-question Comparison</h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-3 py-2 text-slate-500 font-medium sticky left-0 bg-slate-50 min-w-[200px]">Question</th>
                    <th className="px-2 py-2 text-slate-400 font-medium text-center">Section</th>
                    {attempts.map((r, i) => (
                      <th key={r._id} className="px-3 py-2 text-center text-slate-500 font-medium min-w-[64px]">
                        A{i + 1}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-center text-slate-500 font-medium">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q: any, qi: number) => {
                    const row     = matrix[qi];
                    const changed = row[0] !== row[row.length - 1];
                    const gotBetter = !row[0] && row[row.length - 1];
                    const gotWorse  = row[0] && !row[row.length - 1];
                    return (
                      <tr key={qi} className={`border-t border-slate-100 hover:bg-slate-50 ${gotBetter ? 'bg-green-50/40' : gotWorse ? 'bg-red-50/40' : ''}`}>
                        <td className="px-3 py-2 sticky left-0 bg-inherit min-w-[200px] max-w-[260px]">
                          <p className="truncate text-slate-700 font-medium">
                            Q{qi + 1}. {q.questionText || q.question}
                          </p>
                          {q.topic && <p className="text-[10px] text-slate-400 truncate">{q.topic}</p>}
                        </td>
                        <td className="px-2 py-2 text-center">
                          {q.section && (
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full
                              ${SECTION_COLORS[q.section]?.bg} ${SECTION_COLORS[q.section]?.text}`}>
                              {q.section.slice(0, 3)}
                            </span>
                          )}
                        </td>
                        {row.map((correct, ai) => (
                          <td key={ai} className="px-3 py-2 text-center">
                            {correct
                              ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                              : <XCircle      className="h-4 w-4 text-red-400   mx-auto" />}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-center">
                          {!changed
                            ? <Minus className="h-3.5 w-3.5 text-slate-300 mx-auto" />
                            : gotBetter
                              ? <ArrowUpRight   className="h-3.5 w-3.5 text-green-500 mx-auto" />
                              : <ArrowDownRight className="h-3.5 w-3.5 text-red-400   mx-auto" />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ExamResultsPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = use(params);
  const router     = useRouter();
  const { toast }  = useToast();

  const [exam, setExam]               = useState<ExamInfo | null>(null);
  const [results, setResults]         = useState<Result[]>([]);
  const [groups, setGroups]           = useState<StudentGroup[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [comparing, setComparing]         = useState<StudentGroup | null>(null);
  const [grantLoading, setGrantLoading]   = useState<string | null>(null); // userId being acted on
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newDate, setNewDate]             = useState('');
  const [newTime, setNewTime]             = useState('');
  const [rescheduling, setRescheduling]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [examRes, resultsRes] = await Promise.all([
        fetch(`/api/exams/ai-schedule/${examId}?withPermissions=1`),
        fetch(`/api/exam-results?courseId=${examId}`),
      ]);
      if (examRes.ok) setExam(await examRes.json());
      if (resultsRes.ok) {
        const data: Result[] = await resultsRes.json();
        setResults(Array.isArray(data) ? data : []);
        setGroups(groupByStudent(Array.isArray(data) ? data : []));
      }
    } catch {
      setError('Failed to load results');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  const handleGrant = async (group: StudentGroup) => {
    setGrantLoading(group.userId);
    try {
      const res = await fetch(`/api/exams/ai-schedule/${examId}/reattempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: group.userId, userName: group.userName }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: 'Re-attempt granted', description: `${group.userName} can now re-attempt this exam.` });
      // Refresh exam to get updated permissions
      const examRes = await fetch(`/api/exams/ai-schedule/${examId}?withPermissions=1`);
      if (examRes.ok) setExam(await examRes.json());
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setGrantLoading(null);
    }
  };

  const handleRevoke = async (group: StudentGroup) => {
    setGrantLoading(group.userId);
    try {
      const res = await fetch(`/api/exams/ai-schedule/${examId}/reattempt`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: group.userId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: 'Permission revoked', description: `${group.userName}'s re-attempt permission has been removed.` });
      const examRes = await fetch(`/api/exams/ai-schedule/${examId}?withPermissions=1`);
      if (examRes.ok) setExam(await examRes.json());
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setGrantLoading(null);
    }
  };



  const handleReschedule = async () => {
    if (!newDate && !newTime) return;
    setRescheduling(true);
    try {
      const res = await fetch(`/api/exams/ai-schedule/${examId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examDate: newDate || undefined, startTime: newTime || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: 'Exam rescheduled', description: `New date/time saved.` });
      setRescheduleOpen(false);
      const examRes = await fetch(`/api/exams/ai-schedule/${examId}?withPermissions=1`);
      if (examRes.ok) setExam(await examRes.json());
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setRescheduling(false);
    }
  };

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-500">
      <p>{error}</p>
      <Button variant="outline" onClick={() => router.back()}>Go back</Button>
    </div>
  );

  const totalAttempts  = results.length;
  const totalStudents  = groups.length;
  const passed         = groups.filter(g => g.best.percentage >= 40).length;
  const avgScore       = totalStudents ? Math.round(groups.reduce((s, g) => s + g.best.percentage, 0) / totalStudents) : 0;
  const topScore       = totalStudents ? Math.max(...groups.map(g => g.best.percentage)) : 0;
  const multiAttempt   = groups.filter(g => g.attempts.length > 1).length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="mt-0.5 rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 truncate">{exam?.title || 'Exam Results'}</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {exam?.subject && <span className="mr-3">{exam.subject}</span>}
            {exam?.examDate && <span>📅 {new Intl.DateTimeFormat('en-GB').format(new Date(exam.examDate))}</span>}
            {exam?.startTime && <span className="ml-2">🕐 {exam.startTime}</span>}
            {exam?.deadlineDate && (
              <span className="ml-3 text-red-500">
                ⏰ Deadline: {new Intl.DateTimeFormat('en-GB').format(new Date(exam.deadlineDate))} {exam.deadlineTime || ''}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge className={totalStudents > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}>
            {totalStudents} student{totalStudents !== 1 ? 's' : ''}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setNewDate(exam?.examDate || ''); setNewTime(exam?.startTime || ''); setRescheduleOpen(true); }}
            className="rounded-xl gap-1.5 border-violet-200 text-violet-600 hover:bg-violet-50"
          >
            <CalendarClock className="h-3.5 w-3.5" /> Reschedule
          </Button>
          <Button variant="outline" size="sm" onClick={load} className="rounded-xl gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {totalStudents > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { icon: Users,    color: 'text-indigo-500', value: totalStudents,  label: 'Students'    },
            { icon: FileText, color: 'text-violet-500', value: totalAttempts,  label: 'Total Attempts' },
            { icon: Trophy,   color: 'text-yellow-500', value: `${topScore}%`, label: 'Top Score'   },
            { icon: BarChart2,color: 'text-blue-500',   value: `${avgScore}%`, label: 'Class Avg'   },
            { icon: Target,   color: 'text-green-500',  value: `${passed}/${totalStudents}`, label: 'Passed (≥40%)' },
          ].map(({ icon: Icon, color, value, label }) => (
            <Card key={label} className="border-slate-200 shadow-sm">
              <CardContent className="pt-5 pb-5 text-center">
                <Icon className={`h-6 w-6 ${color} mx-auto mb-1.5`} />
                <p className="text-2xl font-bold text-slate-900">{value}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Multi-attempt callout */}
      {multiAttempt > 0 && (
        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 text-sm text-indigo-700">
          <BarChart2 className="h-4 w-4 flex-shrink-0" />
          <span><strong>{multiAttempt}</strong> student{multiAttempt > 1 ? 's have' : ' has'} multiple attempts — click <strong>Compare</strong> on their row to see attempt-wise progress.</span>
        </div>
      )}

      {/* Score distribution */}
      {totalStudents > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-500" /> Score Distribution (best attempt per student)
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            {[
              { label: '80–100%', min: 80, max: 101, color: 'bg-green-500' },
              { label: '60–79%',  min: 60, max: 80,  color: 'bg-blue-500'  },
              { label: '40–59%',  min: 40, max: 60,  color: 'bg-amber-500' },
              { label: '0–39%',   min: 0,  max: 40,  color: 'bg-red-400'   },
            ].map(band => {
              const count = groups.filter(g => g.best.percentage >= band.min && g.best.percentage < band.max).length;
              const pct   = totalStudents ? Math.round((count / totalStudents) * 100) : 0;
              return (
                <div key={band.label} className="flex items-center gap-3 mb-2">
                  <span className="text-xs text-slate-500 w-16 flex-shrink-0">{band.label}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div className={`${band.color} h-3 rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}


      {/* Student list */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Users className="h-4 w-4" /> Students — ranked by best score
        </h2>

        {totalStudents === 0 ? (
          <Card className="border-dashed border-2 border-slate-200 shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <Users className="h-12 w-12 text-slate-300" />
              <p className="font-semibold text-slate-600">No submissions yet</p>
              <p className="text-sm text-slate-400">Students haven't attempted this exam yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {groups.map((group, i) => {
              const permission = (exam?.reAttemptPermissions || []).find(
                p => p.userId === group.userId
              );
              return (
                <StudentRow
                  key={group.userId}
                  group={group}
                  rank={i + 1}
                  onCompare={() => setComparing(group)}
                  permission={permission}
                  onGrant={() => handleGrant(group)}
                  onRevoke={() => handleRevoke(group)}
                  grantLoading={grantLoading === group.userId}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Reschedule dialog */}
      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <CalendarClock className="h-5 w-5 text-violet-500" /> Reschedule Exam
            </DialogTitle>
            <DialogDescription>Update the exam date and/or start time. Students will see the new schedule.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-date">New Date</Label>
              <Input id="new-date" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-time">New Start Time</Label>
              <Input id="new-time" type="time" value={newTime} onChange={e => setNewTime(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRescheduleOpen(false)} className="rounded-xl">Cancel</Button>
            <Button
              onClick={handleReschedule}
              disabled={rescheduling || (!newDate && !newTime)}
              className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white"
            >
              {rescheduling ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : 'Save Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comparison modal */}
      {comparing && (
        <CompareModal group={comparing} onClose={() => setComparing(null)} />
      )}
    </div>
  );
}
