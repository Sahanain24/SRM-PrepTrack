'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/mock-db';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Video, Clock, CalendarClock, ArrowRight, Loader2, RefreshCw,
} from 'lucide-react';

interface Session {
  _id: string; teacherName: string; scheduledAt: string; durationMins: number;
  topic: string; status: string; roomUrl?: string;
}

const STATUS_STYLE: Record<string, string> = {
  requested: 'bg-amber-100 text-amber-700',
  approved:  'bg-blue-100 text-blue-700',
  active:    'bg-green-100 text-green-700',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-100 text-red-500',
  rejected:  'bg-red-100 text-red-500',
};

function fmtDt(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

export default function StudentMentorPage() {
  const router   = useRouter();
  const user     = getCurrentUser() as any;
  const userId   = user?._id || user?.id;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading]   = useState(true);

  const load = async () => {
    setLoading(true);
    const sRes = await fetch(`/api/mentor/sessions?studentId=${userId}`);
    const sData = await sRes.json();
    setSessions(Array.isArray(sData) ? sData : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const upcoming = sessions.filter(s => ['requested','approved'].includes(s.status));
  const past     = sessions.filter(s => ['completed','cancelled','rejected'].includes(s.status));

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg">
            <Video className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Mentor Support</h1>
            <p className="text-slate-500 text-sm">One-on-one video sessions scheduled by your teacher</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5 rounded-xl">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-violet-500" /></div>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Upcoming & Pending</h2>
              <div className="space-y-3">
                {upcoming.map(s => (
                  <Card key={s._id} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-4 pb-4 flex items-start gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900">Session with {s.teacherName}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLE[s.status]}`}>{s.status}</span>
                        </div>
                        {s.topic && <p className="text-sm text-slate-500 mt-0.5">{s.topic}</p>}
                        <div className="flex flex-wrap gap-3 text-xs text-slate-400 mt-1">
                          <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />{fmtDt(s.scheduledAt)}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{s.durationMins} min</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {s.status === 'approved' && (
                          <Button size="sm" onClick={() => router.push(`/dashboard/mentor/call/${s._id}`)}
                            className="rounded-xl h-8 gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs">
                            <Video className="h-3.5 w-3.5" /> Join
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/mentor/student/${s._id}`)}
                          className="rounded-xl h-8 gap-1 text-xs">
                          View <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Past Sessions</h2>
              <div className="space-y-3">
                {past.map(s => (
                  <Card key={s._id} className="border-slate-200 shadow-sm opacity-80 hover:opacity-100 transition-opacity">
                    <CardContent className="pt-4 pb-4 flex items-center gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-700">Session with {s.teacherName}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLE[s.status]}`}>{s.status}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{fmtDt(s.scheduledAt)} · {s.durationMins} min</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/mentor/student/${s._id}`)}
                        className="rounded-xl h-8 gap-1 text-xs">
                        View <ArrowRight className="h-3 w-3" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {sessions.length === 0 && (
            <Card className="border-dashed border-2 border-slate-200 shadow-none">
              <CardContent className="flex flex-col items-center justify-center py-20 text-center gap-3">
                <Video className="h-14 w-14 text-slate-300" />
                <p className="font-semibold text-slate-600">No sessions yet</p>
                <p className="text-sm text-slate-400">Your teacher will schedule a one-on-one session with you</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
