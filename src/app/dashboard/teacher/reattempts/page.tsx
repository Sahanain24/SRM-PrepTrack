'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  RotateCcw, Loader2, ThumbsUp, ThumbsDown,
  CheckCircle2, XCircle, Clock, RefreshCw, BarChart2, CalendarClock,
} from 'lucide-react';

interface FlatRequest {
  _id: string;
  userId: string;
  userName: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'declined';
  note: string;
  examId: string;
  examTitle: string;
  examSubject: string;
}

function timeAgo(iso: string) {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function ReAttemptsPage() {
  const router    = useRouter();
  const { toast } = useToast();
  const toastRef  = useRef(toast);
  toastRef.current = toast;

  const [requests, setRequests]     = useState<FlatRequest[]>([]);
  const [loading, setLoading]       = useState(true);
  const [acting, setActing]         = useState<string | null>(null); // key = examId:userId
  const [filter, setFilter]         = useState<'pending' | 'approved' | 'declined' | 'all'>('pending');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res  = await fetch('/api/teacher/reattempt-requests', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setRequests(Array.isArray(data.requests) ? data.requests : []);
      setLastUpdated(new Date());
    } catch (e: any) {
      if (!silent) toastRef.current({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (req: FlatRequest, action: 'approve' | 'decline') => {
    const key = `${req.examId}:${req.userId}`;
    setActing(key);
    try {
      const res = await fetch(`/api/exams/ai-schedule/${req.examId}/reattempt-request`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId: req.userId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toastRef.current({
        title:       action === 'approve' ? '✓ Approved' : 'Declined',
        description: action === 'approve'
          ? `${req.userName} can now re-attempt "${req.examTitle}".`
          : `${req.userName}'s request declined.`,
      });
      // Optimistic update — change status locally then reload
      setRequests(prev =>
        prev.map(r =>
          r.userId === req.userId && r.examId === req.examId
            ? { ...r, status: action === 'approve' ? 'approved' : 'declined' }
            : r
        )
      );
      load(); // refresh from server
    } catch (e: any) {
      toastRef.current({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setActing(null);
    }
  };

  const filtered = requests
    .filter(r => filter === 'all' || r.status === filter)
    .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

  const count = (s: string) => requests.filter(r => r.status === s).length;

  const TABS = [
    { key: 'pending',  label: 'Pending',  badge: count('pending'),  active: 'bg-amber-100 text-amber-700 border-amber-300 ring-2 ring-amber-400 ring-offset-1', idle: 'bg-white text-slate-600 border-slate-200' },
    { key: 'approved', label: 'Approved', badge: count('approved'), active: 'bg-green-100 text-green-700 border-green-300 ring-2 ring-green-400 ring-offset-1',  idle: 'bg-white text-slate-600 border-slate-200' },
    { key: 'declined', label: 'Declined', badge: count('declined'), active: 'bg-red-50 text-red-600 border-red-300 ring-2 ring-red-400 ring-offset-1',           idle: 'bg-white text-slate-600 border-slate-200' },
    { key: 'all',      label: 'All',      badge: requests.length,   active: 'bg-slate-100 text-slate-700 border-slate-300 ring-2 ring-slate-400 ring-offset-1',   idle: 'bg-white text-slate-600 border-slate-200' },
  ] as const;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-200">
            <RotateCcw className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Re-attempt Requests</h1>
            <p className="text-slate-500 text-sm">Students requesting to re-attempt scheduled AI placement tests</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-slate-400 hidden sm:block">
              Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Button variant="outline" onClick={() => load()} disabled={loading} className="rounded-xl gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
              filter === t.key ? t.active : t.idle + ' hover:border-slate-300'
            }`}
          >
            {t.label}
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
              filter === t.key ? 'bg-white/70' : 'bg-slate-100 text-slate-500'
            }`}>
              {t.badge}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <RotateCcw className="h-12 w-12 text-slate-200" />
            <p className="font-semibold text-slate-500">
              {filter === 'pending' ? 'No pending requests' : `No ${filter} requests`}
            </p>
            <p className="text-sm text-slate-400">
              {filter === 'pending'
                ? 'When a student requests a re-attempt it will appear here.'
                : 'Switch to "All" to see every request.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => {
            const key       = `${req.examId}:${req.userId}`;
            const busy      = acting === key;
            const isPending  = req.status === 'pending';
            const isApproved = req.status === 'approved';

            return (
              <Card
                key={key}
                className={`border shadow-sm ${
                  isPending  ? 'border-amber-200 bg-amber-50/40' :
                  isApproved ? 'border-green-200 bg-green-50/20' :
                               'border-slate-200 bg-white'
                }`}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-4 flex-wrap">
                    {/* Icon */}
                    <div className={`mt-0.5 p-2 rounded-xl flex-shrink-0 ${
                      isPending  ? 'bg-amber-100' :
                      isApproved ? 'bg-green-100' : 'bg-red-50'
                    }`}>
                      {isPending  ? <RotateCcw    className="h-4 w-4 text-amber-600" /> :
                       isApproved ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
                                    <XCircle      className="h-4 w-4 text-red-500"   />}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900">{req.userName}</span>
                        <Badge className={`text-[10px] capitalize border font-semibold ${
                          isPending  ? 'bg-amber-100 text-amber-700 border-amber-200' :
                          isApproved ? 'bg-green-100 text-green-700 border-green-200' :
                                       'bg-red-50 text-red-600 border-red-200'
                        }`}>
                          {req.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-slate-600">
                        <CalendarClock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                        <span className="font-medium truncate max-w-xs">{req.examTitle}</span>
                        {req.examSubject && <span className="text-slate-400 text-xs">· {req.examSubject}</span>}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Clock className="h-3 w-3" />
                        {timeAgo(req.requestedAt)} ·{' '}
                        {new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(req.requestedAt))}
                      </div>
                      {req.note && (
                        <p className="text-xs text-slate-500 italic pl-2 border-l-2 border-slate-200 mt-1">
                          &ldquo;{req.note}&rdquo;
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/dashboard/teacher/schedule-exam/results/${req.examId}`)}
                        className="rounded-xl gap-1.5 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                      >
                        <BarChart2 className="h-3 w-3" /> View Results
                      </Button>

                      {isPending && (
                        busy ? (
                          <Loader2 className="h-4 w-4 animate-spin text-slate-400 mx-2" />
                        ) : (
                          <>
                            <button
                              onClick={() => handleAction(req, 'approve')}
                              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg px-3 py-1.5 transition-colors shadow-sm"
                            >
                              <ThumbsUp className="h-3.5 w-3.5" /> Approve
                            </button>
                            <button
                              onClick={() => handleAction(req, 'decline')}
                              className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg px-3 py-1.5 transition-colors"
                            >
                              <ThumbsDown className="h-3.5 w-3.5" /> Decline
                            </button>
                          </>
                        )
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
