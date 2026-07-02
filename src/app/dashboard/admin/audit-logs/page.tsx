'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { getCurrentUser } from '@/lib/mock-db';
import { format } from 'date-fns';
import { History, RefreshCw, Search } from 'lucide-react';

export default function AuditLogsPage() {
  const router = useRouter();
  const [logs, setLogs]       = useState<any[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filterAction, setFilterAction] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterAction) params.set('action', filterAction);
      if (search)       params.set('search', search);
      const res  = await fetch(`/api/admin/audit-logs?${params}`);
      const data = await res.json();
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setActions(Array.isArray(data.actions) ? data.actions : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterAction, search]);

  useEffect(() => {
    const user = getCurrentUser() as any;
    if (!user || user.role !== 'admin') { router.push('/dashboard'); return; }
    load();
  }, [load]);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-headline font-bold text-slate-900">Audit Logs</h1>
          <p className="text-slate-500 mt-1">A chronological record of activity across the platform.</p>
        </div>
        <Button variant="outline" onClick={load} className="rounded-xl gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-5">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by user name…"
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && load()}
              />
            </div>
            <select
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white"
            >
              <option value="">All Actions</option>
              {actions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <Button onClick={load} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">Apply</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Activity ({logs.length})
          </CardTitle>
          <CardDescription>Most recent 500 entries matching your filters.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-slate-400">Loading…</TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-slate-400">No activity recorded yet.</TableCell>
                  </TableRow>
                ) : (
                  logs.map(log => (
                    <TableRow key={log._id}>
                      <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                        {log.timestamp ? format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss') : '—'}
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">{log.userName || 'System'}</TableCell>
                      <TableCell>
                        {log.userRole ? <Badge variant="outline" className="capitalize">{log.userRole}</Badge> : '—'}
                      </TableCell>
                      <TableCell className="text-sm">{log.action}</TableCell>
                      <TableCell className="text-xs text-slate-400 max-w-xs truncate">
                        {log.details ? JSON.stringify(log.details) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
