'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getCurrentUser } from '@/lib/mock-db';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  Users, UserCog, ShieldCheck, ShieldAlert, ClipboardList,
  RefreshCw, History, ArrowRight, Loader2, BarChart2, LineChart,
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
  const [data, setData]       = useState<any>(null);
  const [perf, setPerf]       = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
    </div>
  );
}
