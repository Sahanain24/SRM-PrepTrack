'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/mock-db';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Loader2, Video, Clock, CheckCircle2, XCircle,
  CalendarClock, ArrowRight, RefreshCw, Plus, Search, ChevronDown,
} from 'lucide-react';

interface Session {
  _id: string;
  studentName: string; rollNumber: string; program: string; year: number; section: string;
  scheduledAt: string; durationMins: number; topic: string;
  status: 'requested'|'approved'|'active'|'completed'|'cancelled'|'rejected';
  roomUrl?: string;
}

interface Student {
  _id: string; name: string; rollNumber: string; program: string; year: number; section: string;
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

export default function TeacherMentorPage() {
  const router    = useRouter();
  const { toast } = useToast();
  const user      = getCurrentUser() as any;
  const teacherId   = user?._id || user?.id;
  const teacherName = user?.name || 'Teacher';

  const [sessions,  setSessions]  = useState<Session[]>([]);
  const [students,  setStudents]  = useState<Student[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [acting,    setActing]    = useState<string | null>(null);
  const [tab,       setTab]       = useState<'pending'|'upcoming'|'past'>('pending');
  const [showForm,  setShowForm]  = useState(false);
  const [booking,   setBooking]   = useState(false);

  const [form, setForm] = useState({
    studentId: '', scheduledAt: '', durationMins: '30', topic: '',
  });

  const [studentQuery, setStudentQuery] = useState('');
  const [studentOpen,  setStudentOpen]  = useState(false);

  const filteredStudents = studentQuery.trim()
    ? students.filter(s =>
        s.name?.toLowerCase().includes(studentQuery.toLowerCase()) ||
        s.rollNumber?.toLowerCase().includes(studentQuery.toLowerCase()))
    : students;

  const selectedStudent = students.find(s => s._id === form.studentId);

  const load = async () => {
    setLoading(true);
    const [sRes, uRes] = await Promise.all([
      fetch(`/api/mentor/sessions?teacherId=${teacherId}`),
      fetch('/api/users?role=student'),
    ]);
    const sData = await sRes.json();
    const uData = await uRes.json();
    setSessions(Array.isArray(sData) ? sData : []);
    setStudents(Array.isArray(uData) ? uData : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const act = async (sessionId: string, action: 'approve' | 'reject') => {
    setActing(sessionId);
    const res  = await fetch(`/api/mentor/sessions/${sessionId}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) toast({ title: 'Error', description: data.error, variant: 'destructive' });
    else         toast({ title: action === 'approve' ? 'Session approved' : 'Session rejected' });
    setActing(null);
    load();
  };

  const scheduleSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.studentId || !form.scheduledAt) return;
    setBooking(true);
    try {
      const student = students.find(s => s._id === form.studentId);
      // Teacher-initiated sessions are immediately approved (no approval step needed)
      const res = await fetch('/api/mentor/sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId:   form.studentId,
          studentName: student?.name,
          rollNumber:  student?.rollNumber,
          program:     student?.program,
          year:        student?.year,
          section:     student?.section || '',
          teacherId,
          teacherName,
          scheduledAt:  form.scheduledAt,
          durationMins: Number(form.durationMins),
          topic:        form.topic,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);

      // Auto-approve since teacher initiated it
      const created = await res.json();
      await fetch(`/api/mentor/sessions/${created._id}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });

      toast({ title: 'Session scheduled!', description: `Room created for ${student?.name}.` });
      setShowForm(false);
      setForm({ studentId: '', scheduledAt: '', durationMins: '30', topic: '' });
      load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setBooking(false);
    }
  };

  const pending  = sessions.filter(s => s.status === 'requested');
  const upcoming = sessions.filter(s => s.status === 'approved');
  const past     = sessions.filter(s => ['completed', 'cancelled', 'rejected'].includes(s.status));
  const shown    = tab === 'pending' ? pending : tab === 'upcoming' ? upcoming : past;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg">
            <Video className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Mentor Sessions</h1>
            <p className="text-slate-500 text-sm">One-on-one video sessions with students</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5 rounded-xl">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowForm(true)}
            className="gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-700">
            <Plus className="h-3.5 w-3.5" /> Schedule Session
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'pending',  label: 'Pending Requests', count: pending.length  },
          { key: 'upcoming', label: 'Upcoming',          count: upcoming.length },
          { key: 'past',     label: 'Past Sessions',     count: past.length     },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all
              ${tab === t.key ? 'bg-violet-600 text-white border-violet-600 shadow' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
            {t.label}
            {t.count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-white/20' : 'bg-slate-100'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Session list */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-violet-500" /></div>
      ) : shown.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Video className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No {tab} sessions.</p>
          {tab === 'upcoming' && (
            <button onClick={() => setShowForm(true)}
              className="mt-3 text-sm text-violet-600 hover:underline">
              + Schedule one now
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(session => (
            <Card key={session._id} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-base flex-shrink-0">
                    {session.studentName?.[0] || 'S'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900">{session.studentName}</p>
                      <span className="text-xs text-slate-400">{session.rollNumber}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {session.program} Y{session.year}{session.section ? ` §${session.section}` : ''}
                      </Badge>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLE[session.status]}`}>
                        {session.status}
                      </span>
                    </div>
                    {session.topic && <p className="text-sm text-slate-600 mt-0.5">{session.topic}</p>}
                    <div className="flex flex-wrap gap-3 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />{fmtDt(session.scheduledAt)}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{session.durationMins} min</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {session.status === 'requested' && (
                      <>
                        <Button size="sm" onClick={() => act(session._id, 'approve')} disabled={acting === session._id}
                          className="rounded-xl h-8 gap-1 bg-green-600 hover:bg-green-700 text-white text-xs">
                          {acting === session._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => act(session._id, 'reject')} disabled={acting === session._id}
                          className="rounded-xl h-8 gap-1 text-red-600 border-red-200 hover:bg-red-50 text-xs">
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </Button>
                      </>
                    )}
                    {session.status === 'approved' && (
                      <Button size="sm" onClick={() => router.push(`/dashboard/mentor/call/${session._id}`)}
                        className="rounded-xl h-8 gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs">
                        <Video className="h-3.5 w-3.5" /> Join Call
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/mentor/teacher/${session._id}`)}
                      className="rounded-xl h-8 gap-1.5 text-xs">
                      View <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Schedule session dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule a Demo / Mentor Session</DialogTitle>
          </DialogHeader>
          <form onSubmit={scheduleSession} className="space-y-4 pt-2">
            <div className="space-y-1.5 relative">
              <Label>Student *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Type name or roll number..."
                  className="rounded-xl pl-9 pr-8"
                  value={studentOpen ? studentQuery : (selectedStudent ? `${selectedStudent.name} (${selectedStudent.rollNumber})` : '')}
                  onChange={e => { setStudentQuery(e.target.value); setStudentOpen(true); setForm(f => ({ ...f, studentId: '' })); }}
                  onFocus={() => { setStudentOpen(true); setStudentQuery(''); }}
                  onBlur={() => setTimeout(() => setStudentOpen(false), 150)}
                />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
              {studentOpen && (
                <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                  {filteredStudents.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-slate-400">No students found</div>
                  ) : filteredStudents.map(s => (
                    <button
                      key={s._id}
                      type="button"
                      onClick={() => { setForm(f => ({ ...f, studentId: s._id })); setStudentOpen(false); setStudentQuery(''); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between gap-2"
                    >
                      <span className="font-medium text-slate-800">{s.name}</span>
                      <span className="text-slate-400 text-xs">
                        {s.rollNumber} · {s.program} Y{s.year}{s.section ? ` §${s.section}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Date & Time *</Label>
              <Input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
                className="rounded-xl"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Duration</Label>
              <Select value={form.durationMins} onValueChange={v => setForm(f => ({ ...f, durationMins: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[15, 30, 45, 60].map(d => (
                    <SelectItem key={d} value={String(d)}>{d} minutes</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Topic / Agenda</Label>
              <Input
                placeholder="e.g. Placement prep, project review, doubt clearing"
                value={form.topic}
                onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
                className="rounded-xl"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" disabled={booking || !form.studentId || !form.scheduledAt}
                className="rounded-xl bg-violet-600 hover:bg-violet-700">
                {booking && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Schedule & Create Room
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
