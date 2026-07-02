'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/mock-db';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Briefcase, Loader2, RefreshCw, Building2, CalendarClock,
} from 'lucide-react';

const ALLOWED = ['dean', 'deputy_dean', 'pro_vc', 'hod', 'admin'];

interface PlacementUpdate {
  _id: string;
  studentName: string; rollNumber: string; program: string; year: number; section: string;
  status: string; companyName: string; role: string; packageLPA?: number; notes?: string;
  reportedByName: string; reportedByRole?: string; createdAt: string;
}

const STATUS_STYLE: Record<string, string> = {
  shortlisted:    'bg-blue-100 text-blue-700',
  offer_received: 'bg-amber-100 text-amber-700',
  placed:         'bg-green-100 text-green-700',
  not_placed:     'bg-slate-100 text-slate-600',
};

function fmtDt(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

export default function DeanPlacementsPage() {
  const router = useRouter();
  const [updates, setUpdates] = useState<PlacementUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [status,  setStatus]  = useState('all');

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) { router.push('/auth'); return; }
    if (!ALLOWED.includes((user as any).role)) { router.push('/dashboard'); return; }
    load();
  }, [router]);

  const load = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/placements');
      const data = await res.json();
      setUpdates(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const shown = status === 'all' ? updates : updates.filter(u => u.status === status);

  const counts = {
    placed:         updates.filter(u => u.status === 'placed').length,
    offer_received: updates.filter(u => u.status === 'offer_received').length,
    shortlisted:    updates.filter(u => u.status === 'shortlisted').length,
    not_placed:     updates.filter(u => u.status === 'not_placed').length,
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
            <p className="text-slate-500 text-sm">Reported by teachers and HODs across departments</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5 rounded-xl">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Placed',         value: counts.placed,         color: 'text-green-600 bg-green-50' },
          { label: 'Offers Received', value: counts.offer_received, color: 'text-amber-600 bg-amber-50' },
          { label: 'Shortlisted',     value: counts.shortlisted,     color: 'text-blue-600 bg-blue-50' },
          { label: 'Not Placed',      value: counts.not_placed,      color: 'text-slate-600 bg-slate-50' },
        ].map(s => (
          <Card key={s.label} className="border-slate-200 shadow-sm">
            <CardContent className="pt-5 pb-5 flex flex-col items-center text-center gap-1">
              <p className={`text-2xl font-black ${s.color.split(' ')[0]}`}>{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="w-48">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="shortlisted">Shortlisted</SelectItem>
            <SelectItem value="offer_received">Offer Received</SelectItem>
            <SelectItem value="placed">Placed</SelectItem>
            <SelectItem value="not_placed">Not Placed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div>
      ) : shown.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center gap-2">
            <Briefcase className="h-12 w-12 text-slate-300" />
            <p className="text-sm text-slate-400">No placement updates yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {shown.map(u => (
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
                    <span className="capitalize">Reported by {u.reportedByName} ({u.reportedByRole?.replace('_',' ')})</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
