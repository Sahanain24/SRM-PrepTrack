'use client';

import { useState, useEffect } from 'react';
import { getCurrentUser } from '@/lib/mock-db';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Briefcase, Plus, Loader2, RefreshCw, Building2, CalendarClock, Search, ChevronDown,
} from 'lucide-react';

interface Student {
  _id: string; name: string; rollNumber: string; program: string; year: number; section: string;
}

interface PlacementUpdate {
  _id: string;
  studentName: string; rollNumber: string; program: string; year: number; section: string;
  status: string; companyName: string; role: string; packageLPA?: number; notes?: string;
  reportedByName: string; createdAt: string;
}

const STATUS_OPTIONS = [
  { value: 'shortlisted',     label: 'Shortlisted' },
  { value: 'offer_received',  label: 'Offer Received' },
  { value: 'placed',          label: 'Placed' },
  { value: 'not_placed',      label: 'Not Placed' },
];

const STATUS_STYLE: Record<string, string> = {
  shortlisted:    'bg-blue-100 text-blue-700',
  offer_received: 'bg-amber-100 text-amber-700',
  placed:         'bg-green-100 text-green-700',
  not_placed:     'bg-slate-100 text-slate-600',
};

function fmtDt(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

export default function PlacementUpdatesPage() {
  const { toast } = useToast();
  const user   = getCurrentUser() as any;
  const userId = user?._id || user?.id;

  const [students, setStudents] = useState<Student[]>([]);
  const [updates,  setUpdates]  = useState<PlacementUpdate[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  const [form, setForm] = useState({
    studentId: '', status: 'shortlisted', companyName: '', role: '', packageLPA: '', notes: '',
  });

  const [studentQuery, setStudentQuery]   = useState('');
  const [studentOpen,  setStudentOpen]    = useState(false);

  const filteredStudents = studentQuery.trim()
    ? students.filter(s =>
        s.name?.toLowerCase().includes(studentQuery.toLowerCase()) ||
        s.rollNumber?.toLowerCase().includes(studentQuery.toLowerCase()))
    : students;

  const selectedStudent = students.find(s => s._id === form.studentId);

  const load = async () => {
    setLoading(true);
    const [sRes, pRes] = await Promise.all([
      fetch('/api/users?role=student'),
      fetch('/api/placements'),
    ]);
    const sData = await sRes.json();
    const pData = await pRes.json();
    setStudents(Array.isArray(sData) ? sData : []);
    setUpdates(Array.isArray(pData) ? pData : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.studentId || !form.companyName) return;
    setSaving(true);
    try {
      const student = students.find(s => s._id === form.studentId);
      const res = await fetch('/api/placements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId:   form.studentId,
          studentName: student?.name,
          rollNumber:  student?.rollNumber,
          program:     student?.program,
          year:        student?.year,
          section:     student?.section || '',
          status:      form.status,
          companyName: form.companyName,
          role:        form.role,
          packageLPA:  form.packageLPA,
          notes:       form.notes,
          reportedById:   userId,
          reportedByName: user?.name,
          reportedByRole: user?.role,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: 'Update sent', description: 'Dean, Deputy Dean and Pro-VC have been notified.' });
      setForm({ studentId: '', status: 'shortlisted', companyName: '', role: '', packageLPA: '', notes: '' });
      load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg">
            <Briefcase className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Placement Updates</h1>
            <p className="text-slate-500 text-sm">Report a student's placement status to the Dean, Deputy Dean and Pro-VC</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5 rounded-xl">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Report form */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-5 pb-5">
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <Label>Status *</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Company *</Label>
                <Input placeholder="e.g. TCS, Infosys" value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} className="rounded-xl" required />
              </div>
              <div className="space-y-1.5">
                <Label>Role / Designation</Label>
                <Input placeholder="e.g. Software Engineer" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Package (LPA)</Label>
                <Input type="number" step="0.1" placeholder="e.g. 6.5" value={form.packageLPA} onChange={e => setForm(f => ({ ...f, packageLPA: e.target.value }))} className="rounded-xl" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea placeholder="Additional details for management..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="rounded-xl" />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving} className="gap-2 rounded-xl bg-amber-600 hover:bg-amber-700">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Send Update
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Recent updates */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Recent Updates</h2>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-amber-500" /></div>
        ) : updates.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200 shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-14 text-center gap-2">
              <Briefcase className="h-12 w-12 text-slate-300" />
              <p className="text-sm text-slate-400">No placement updates reported yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {updates.map(u => (
              <Card key={u._id} className="border-slate-200 shadow-sm">
                <CardContent className="pt-4 pb-4 flex items-start gap-4 flex-wrap">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-base flex-shrink-0">
                    {u.studentName?.[0] || 'S'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900">{u.studentName}</p>
                      <span className="text-xs text-slate-400">{u.rollNumber}</span>
                      <Badge variant="outline" className="text-[10px]">{u.program} Y{u.year}{u.section ? ` §${u.section}` : ''}</Badge>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLE[u.status]}`}>{u.status.replace('_',' ')}</span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1 flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" /> {u.companyName}{u.role ? ` · ${u.role}` : ''}{u.packageLPA ? ` · ${u.packageLPA} LPA` : ''}
                    </p>
                    {u.notes && <p className="text-xs text-slate-500 mt-1">{u.notes}</p>}
                    <div className="flex flex-wrap gap-3 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />{fmtDt(u.createdAt)}</span>
                      <span>Reported by {u.reportedByName}</span>
                    </div>
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
