'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles, TrendingUp, TrendingDown, Minus,
  Loader2, RefreshCw, ArrowRight, CalendarDays,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TestSnap {
  examId: string;
  examTitle: string;
  subject: string;
  score: number;
  total: number;
  percentage: number;
  date: string;
}

interface ComparisonRow {
  userId: string;
  userName: string;
  rollNumber: string;
  totalAttempts: number;
  first: TestSnap;
  latest: TestSnap | null;
  improvement: number;
}

function fmt(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ScorePill({ pct }: { pct: number }) {
  const color =
    pct >= 80 ? 'bg-green-100 text-green-700 border-green-200' :
    pct >= 60 ? 'bg-amber-100 text-amber-700 border-amber-200' :
                'bg-red-50 text-red-600 border-red-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${color}`}>
      {pct}%
    </span>
  );
}

function ImprovementBadge({ delta }: { delta: number }) {
  if (delta === 0) return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-400 font-medium">
      <Minus className="h-3 w-3" /> No change
    </span>
  );
  if (delta > 0) return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600">
      <TrendingUp className="h-3.5 w-3.5" /> +{delta}%
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-500">
      <TrendingDown className="h-3.5 w-3.5" /> {delta}%
    </span>
  );
}

export function AITestComparison() {
  const [rows, setRows]       = useState<ComparisonRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/ai-test-results/comparison');
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const improved  = rows.filter(r => r.improvement > 0).length;
  const declined  = rows.filter(r => r.improvement < 0).length;
  const unchanged = rows.filter(r => r.improvement === 0 && r.latest).length;
  const singleAttempt = rows.filter(r => !r.latest).length;

  return (
    <Card className="border-none shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="font-headline text-lg">AI Test Progress Comparison</CardTitle>
              <CardDescription className="text-sm">
                First scheduled AI test score vs most recent — tracks improvement over time.
              </CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="rounded-xl gap-1.5 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {/* Summary pills */}
        {!loading && rows.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {[
              { label: 'Improved',        count: improved,       color: 'bg-green-100 text-green-700 border-green-200' },
              { label: 'Declined',        count: declined,       color: 'bg-red-50 text-red-600 border-red-200' },
              { label: 'No change',       count: unchanged,      color: 'bg-slate-100 text-slate-600 border-slate-200' },
              { label: 'Single attempt',  count: singleAttempt,  color: 'bg-blue-50 text-blue-600 border-blue-200' },
            ].filter(p => p.count > 0).map(p => (
              <span key={p.label} className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${p.color}`}>
                {p.label}: {p.count}
              </span>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-slate-500">No AI test results yet</p>
            <p className="text-sm mt-1">Results will appear here once students complete scheduled AI tests.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Student</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">First AI Test</th>
                  <th className="py-2.5 px-1 text-slate-300"></th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Most Recent AI Test</th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Change</th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Attempts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map(row => (
                  <tr key={row.userId} className="hover:bg-slate-50/60 transition-colors group">
                    {/* Student name */}
                    <td className="py-3 px-3">
                      <p className="font-semibold text-slate-900">{row.userName}</p>
                      {row.rollNumber && (
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">{row.rollNumber}</p>
                      )}
                    </td>

                    {/* First test */}
                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <ScorePill pct={row.first.percentage} />
                          <span className="text-xs text-slate-500">
                            {row.first.score}/{row.first.total}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium truncate max-w-[180px]" title={row.first.examTitle}>
                          {row.first.examTitle}
                        </p>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {fmt(row.first.date)}
                        </p>
                      </div>
                    </td>

                    {/* Arrow */}
                    <td className="py-3 px-1 text-slate-300">
                      <ArrowRight className="h-4 w-4" />
                    </td>

                    {/* Latest test */}
                    <td className="py-3 px-3">
                      {row.latest ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <ScorePill pct={row.latest.percentage} />
                            <span className="text-xs text-slate-500">
                              {row.latest.score}/{row.latest.total}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 font-medium truncate max-w-[180px]" title={row.latest.examTitle}>
                            {row.latest.examTitle}
                          </p>
                          <p className="text-[10px] text-slate-400 flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {fmt(row.latest.date)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Only one attempt</span>
                      )}
                    </td>

                    {/* Improvement */}
                    <td className="py-3 px-3 text-center">
                      {row.latest ? (
                        <ImprovementBadge delta={row.improvement} />
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>

                    {/* Total attempts */}
                    <td className="py-3 px-3 text-center">
                      <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-600 border-indigo-200">
                        {row.totalAttempts}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
