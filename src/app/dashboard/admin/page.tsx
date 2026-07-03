'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getCurrentUser } from '@/lib/mock-db';
import { format } from 'date-fns';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Users, UserCog, ShieldCheck, ShieldAlert, ClipboardList,
  RefreshCw, History, ArrowRight, Loader2, BarChart2, LineChart, Wrench, Trash2,
} from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  student:     'Students',
  teacher:     'Teachers',
  hod:         'HODs',
  dean:        'Deans',
  deputy_dean: 'Deputy Deans',
  pro_vc:      'Pro Vice Chancellors',
  admin:       'Admins',
};

export default function AdminOverviewPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData]       = useState<any>(null);
  const [perf, setPerf]       = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Maintenance — keep first attempt only
  const [maintOpen, setMaintOpen]         = useState(false);
  const [maintSearch, setMaintSearch]     = useState('Data Structure');
  const [maintRunning, setMaintRunning]   = useState(false);
  const [maintResult, setMaintResult]     = useState<any>(null);

  const runKeepFirstAttempt = async () => {
    setMaintRunning(true);
    setMaintResult(null);
    try {
      const res = await fetch('/api/admin/maintenance/keep-first-attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titleSearch: maintSearch.trim() }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setMaintResult(result);
      toast({
        title: 'Cleanup complete',
        description: `Removed ${result.totalDeleted} extra attempt(s) across ${result.examsProcessed} exam(s).`,
      });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setMaintRunning(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [overviewRes, perfRes] = await Promise.all([
        fetch('/api/admin/overview'),
        fetch('/api/analytics/performance'),
      ]);
      setData(await overviewRes.json());
      setPerf(await perfRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const user = getCurrentUser() as any;
    if (!user || user.role !== 'admin') { router.push('/dashboard'); return; }
    load();
  }, []);

  if (loading || !data) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
    </div>
  );

  const kpis = [
    { label: 'Total Users',    value: data.totalUsers,        icon: Users,       color: 'bg-blue-50 text-blue-600' },
    { label: 'Active Accounts', value: data.activeUsers,       icon: ShieldCheck, color: 'bg-green-50 text-green-600' },
    { label: 'Inactive Accounts', value: data.inactiveUsers,   icon: ShieldAlert, color: 'bg-red-50 text-red-600' },
    { label: 'Self-Assessments', value: data.totalAssessments, icon: ClipboardList, color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Exam Pass Rate', value: `${perf?.overview?.examPassRate ?? 0}%`, icon: LineChart, color: 'bg-rose-50 text-rose-600' },
  ];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-headline font-bold text-slate-900">Admin Panel</h1>
          <p className="text-slate-500 mt-1">System overview, user management and audit trail.</p>
        </div>
        <Button variant="outline" onClick={load} className="rounded-xl gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {kpis.map(k => (
          <Card key={k.label} className="border-slate-200 shadow-sm">
            <CardContent className="pt-5 pb-5 flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${k.color}`}>
                <k.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{k.value}</p>
                <p className="text-xs text-slate-500">{k.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/dashboard/admin/students">
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow h-full">
            <CardContent className="pt-5 pb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600"><Users className="h-5 w-5" /></div>
                <div>
                  <p className="font-semibold text-slate-900">Student Management</p>
                  <p className="text-xs text-slate-500">Register, import & manage students</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/admin/staff">
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow h-full">
            <CardContent className="pt-5 pb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-violet-50 text-violet-600"><UserCog className="h-5 w-5" /></div>
                <div>
                  <p className="font-semibold text-slate-900">Staff & Roles</p>
                  <p className="text-xs text-slate-500">Manage teachers, HOD, dean & leadership accounts</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/admin/audit-logs">
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow h-full">
            <CardContent className="pt-5 pb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600"><History className="h-5 w-5" /></div>
                <div>
                  <p className="font-semibold text-slate-900">Audit Logs</p>
                  <p className="text-xs text-slate-500">Track activity across the platform</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Role breakdown + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart2 className="h-5 w-5" /> Accounts by Role</CardTitle>
            <CardDescription>Total vs. active accounts for every role in the system.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.roleCounts.map((r: any) => (
              <div key={r.role} className="flex items-center justify-between text-sm">
                <span className="text-slate-700 font-medium">{ROLE_LABELS[r.role] || r.role}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{r.total} total</Badge>
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{r.active} active</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Recent Activity</CardTitle>
            <CardDescription>Latest 10 audit log entries.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentLogs.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No activity recorded yet.</p>
            ) : data.recentLogs.map((log: any) => (
              <div key={log._id} className="flex items-start justify-between text-sm border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                <div>
                  <p className="text-slate-800 font-medium">{log.action}</p>
                  <p className="text-xs text-slate-500">{log.userName || 'System'} {log.userRole ? `(${log.userRole})` : ''}</p>
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {log.timestamp ? format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm') : '—'}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recently registered users */}
      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Recently Registered Users</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.recentUsers.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No users yet.</p>
          ) : data.recentUsers.map((u: any) => (
            <div key={u._id} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2 last:border-0 last:pb-0">
              <div>
                <p className="text-slate-800 font-medium">{u.name}</p>
                <p className="text-xs text-slate-500">{u.email || u.rollNumber}</p>
              </div>
              <Badge variant="outline" className="capitalize">{u.role}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Maintenance ── */}
      <Card className="border-red-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-red-700 flex items-center gap-2">
            <Wrench className="h-5 w-5" /> Maintenance
          </CardTitle>
          <CardDescription>One-time data cleanup operations. Use with caution — these actions are irreversible.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-xl border border-red-100 bg-red-50">
            <div>
              <p className="font-medium text-slate-800 text-sm">Remove Extra Attempts (Keep Attempt 1 Only)</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Find exams by title and delete attempts 2, 3, … for every student — keeping only their first attempt.
                Use this to clear demo data before analysing real student performance.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setMaintResult(null); setMaintOpen(true); }}
              className="ml-4 flex-shrink-0 rounded-xl border-red-300 text-red-600 hover:bg-red-100 gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" /> Run Cleanup
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Maintenance dialog */}
      <Dialog open={maintOpen} onOpenChange={open => { if (!maintRunning) setMaintOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Wrench className="h-5 w-5" /> Keep Attempt 1 Only
            </DialogTitle>
            <DialogDescription>
              All exams whose title contains the search term will be processed. Attempts 2, 3, and beyond will be permanently deleted for every student. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Exam Title Search</label>
              <Input
                value={maintSearch}
                onChange={e => setMaintSearch(e.target.value)}
                placeholder="e.g. Data Structure"
                className="rounded-xl"
                disabled={maintRunning}
              />
              <p className="text-xs text-slate-400">Case-insensitive partial match — e.g. "data structure" matches "Data Structures Placement Mock Test".</p>
            </div>

            {maintResult && (
              <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-sm space-y-1">
                <p className="font-semibold text-green-700">Cleanup complete</p>
                <p className="text-slate-600">Exams processed: <strong>{maintResult.examsProcessed}</strong></p>
                <p className="text-slate-600">Extra attempts deleted: <strong>{maintResult.totalDeleted}</strong></p>
                {maintResult.summary?.map((s: any) => (
                  <p key={s.examId} className="text-xs text-slate-500">• {s.title} — {s.deleted} deleted</p>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setMaintOpen(false)} disabled={maintRunning} className="rounded-xl">
              {maintResult ? 'Close' : 'Cancel'}
            </Button>
            {!maintResult && (
              <Button
                onClick={runKeepFirstAttempt}
                disabled={maintRunning || !maintSearch.trim()}
                className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
              >
                {maintRunning
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running…</>
                  : <><Trash2 className="h-4 w-4 mr-2" /> Delete Extra Attempts</>}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
