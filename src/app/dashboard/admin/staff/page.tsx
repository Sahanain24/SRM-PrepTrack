'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { getCurrentUser } from '@/lib/mock-db';
import {
  UserPlus, Search, RefreshCw, Trash2, KeyRound,
  CheckCircle2, AlertTriangle, UserCog, Power,
} from 'lucide-react';

const ROLES = [
  { value: 'teacher',     label: 'Teacher' },
  { value: 'hod',         label: 'HOD' },
  { value: 'dean',        label: 'Dean' },
  { value: 'deputy_dean', label: 'Deputy Dean' },
  { value: 'pro_vc',      label: 'Pro Vice Chancellor' },
  { value: 'admin',       label: 'Administrator' },
];

const ROLE_EMAILS: Record<string, string> = {
  hod:          'hod@srmist.edu.in',
  dean:         'dean@srmist.edu.in',
  deputy_dean:  'deputydean@srmist.edu.in',
  pro_vc:       'provc@srmist.edu.in',
  admin:        'admin@srmist.edu.in',
};

interface Staff {
  _id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  isActive: boolean;
}

const BLANK_STAFF = { name: '', email: '', role: 'teacher', department: '' };
const blankWithRole = (role: string) => ({ name: '', email: ROLE_EMAILS[role] ?? '', role, department: '' });

export default function StaffManagementPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [staff, setStaff]       = useState<Staff[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterRole, setFilterRole] = useState('');

  const [addOpen, setAddOpen]       = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newStaff, setNewStaff]     = useState(BLANK_STAFF);

  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterRole) params.set('role', filterRole);
      const res  = await fetch(`/api/admin/staff?${params}`);
      const data = await res.json();
      setStaff(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast({ title: 'Failed to load staff', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [filterRole, toast]);

  useEffect(() => {
    const user = getCurrentUser() as any;
    if (!user || user.role !== 'admin') { router.push('/dashboard'); return; }
    loadStaff();
  }, [loadStaff]);

  const FSH_ROLES = ['hod', 'dean', 'deputy_dean', 'pro_vc', 'admin'];

  const handleAddStaff = async () => {
    const email = newStaff.email.trim().toLowerCase();
    if (!newStaff.name.trim() || !email) {
      toast({ title: 'Name and email are required', variant: 'destructive' });
      return;
    }
    if (!/^[a-zA-Z0-9._%+-]+@srmist\.edu\.in$/i.test(email)) {
      toast({ title: 'Email must be a valid @srmist.edu.in address', variant: 'destructive' });
      return;
    }
    setAddLoading(true);
    try {
      const res  = await fetch('/api/admin/staff', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(newStaff),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add staff member');
      toast({ title: `${newStaff.name} added. Default password: ${newStaff.email.split('@')[0]}` });
      setAddOpen(false);
      setNewStaff(BLANK_STAFF);
      loadStaff();
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setAddLoading(false);
    }
  };

  const callAction = async (id: string, action: string) => {
    await fetch(`/api/admin/staff/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action }),
    });
  };

  const resetPassword = async (s: Staff) => {
    const res  = await fetch(`/api/admin/staff/${s._id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'reset-password' }),
    });
    const data = await res.json();
    toast({ title: data.message || `Password reset for ${s.name}` });
  };

  const toggleActive = async (s: Staff) => {
    const next = s.isActive ? 'deactivate' : 'activate';
    if (s.isActive && !confirm(`Deactivate ${s.name}? They will not be able to log in.`)) return;
    await callAction(s._id, next);
    toast({ title: `${s.name} ${next}d` });
    loadStaff();
  };

  const deleteStaff = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/staff/${deleteTarget._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      toast({ title: `${deleteTarget.name} has been removed.` });
      setDeleteTarget(null);
      loadStaff();
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const changeRole = async (s: Staff, role: string) => {
    await fetch(`/api/admin/staff/${s._id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ role }),
    });
    toast({ title: `${s.name}'s role changed to ${ROLES.find(r => r.value === role)?.label}` });
    loadStaff();
  };

  const filtered = staff.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = [
    { label: 'Total Staff',  value: staff.length, color: 'text-blue-600' },
    { label: 'Active',       value: staff.filter(s => s.isActive).length, color: 'text-green-600' },
    { label: 'Inactive',     value: staff.filter(s => !s.isActive).length, color: 'text-red-600' },
    { label: 'Admins',       value: staff.filter(s => s.role === 'admin').length, color: 'text-indigo-600' },
  ];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-slate-900">Staff & Role Management</h1>
          <p className="text-slate-500 mt-1">Manage teacher, HOD, dean, deputy dean, pro-VC and admin accounts.</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
          <UserPlus className="h-4 w-4" /> Add Staff Member
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label} className="border-slate-200 shadow-sm">
            <CardContent className="pt-5 pb-5">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-5">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search name or email…"
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              value={filterRole}
              onChange={e => setFilterRole(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white"
            >
              <option value="">All Roles</option>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <Button variant="outline" onClick={loadStaff} className="rounded-xl" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Staff Table */}
      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" /> Staff ({filtered.length})
          </CardTitle>
          <CardDescription>
            Default password for new accounts is the part of the email before "@". Use the key icon to reset.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-slate-400">Loading staff…</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                      No staff found. Use "Add Staff Member" to register an account.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(member => (
                    <TableRow key={member._id}>
                      <TableCell className="font-medium text-slate-900">{member.name}</TableCell>
                      <TableCell className="text-sm text-slate-600">{member.email}</TableCell>
                      <TableCell>
                        <select
                          value={member.role}
                          onChange={e => changeRole(member, e.target.value)}
                          className="px-2 py-1 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white"
                        >
                          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">{member.department || '—'}</TableCell>
                      <TableCell>
                        {member.isActive ? (
                          <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-red-500 font-semibold">
                            <AlertTriangle className="h-3.5 w-3.5" /> Inactive
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost" size="sm"
                            title="Reset password"
                            onClick={() => resetPassword(member)}
                            className="text-slate-400 hover:text-blue-600"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            title={member.isActive ? 'Deactivate' : 'Activate'}
                            onClick={() => toggleActive(member)}
                            className={member.isActive ? 'text-slate-400 hover:text-red-600' : 'text-slate-400 hover:text-green-600'}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                          {member.role !== 'admin' && (
                            <Button
                              variant="ghost" size="sm"
                              title="Remove staff member"
                              onClick={() => setDeleteTarget(member)}
                              className="text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" /> Remove Staff Member
            </DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email}) from the system. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="rounded-xl">Cancel</Button>
            <Button
              onClick={deleteStaff}
              disabled={deleteLoading}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteLoading ? 'Removing…' : 'Yes, Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Staff Dialog */}
      <Dialog open={addOpen} onOpenChange={open => { setAddOpen(open); if (!open) setNewStaff(BLANK_STAFF); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
            <DialogDescription>
              Default password will be the part of the email before "@". The account must log in and change it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">
                Full Name *
                {FSH_ROLES.includes(newStaff.role) && (
                  <span className="ml-1 text-slate-400">("FSH" will be appended automatically)</span>
                )}
              </Label>
              <Input
                placeholder={FSH_ROLES.includes(newStaff.role) ? `HOD FSH` : 'Dr. Anitha Rao'}
                value={newStaff.name}
                onChange={e => setNewStaff(p => ({ ...p, name: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Email * <span className="text-slate-400">(@srmist.edu.in only)</span></Label>
              <Input
                type="email"
                placeholder="anitha.rao@srmist.edu.in"
                value={newStaff.email}
                readOnly={!!ROLE_EMAILS[newStaff.role]}
                onChange={e => setNewStaff(p => ({ ...p, email: e.target.value.toLowerCase() }))}
                className={`rounded-xl ${ROLE_EMAILS[newStaff.role] ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
              />
              {newStaff.email && !/^[a-zA-Z0-9._%+-]+@srmist\.edu\.in$/i.test(newStaff.email) && (
                <p className="text-[11px] text-red-500">Must be @srmist.edu.in</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Role</Label>
              <select
                value={newStaff.role}
                onChange={e => {
                  const role = e.target.value;
                  setNewStaff(p => ({ ...p, role, email: ROLE_EMAILS[role] ?? p.email }));
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              >
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Department</Label>
              <Input
                placeholder="Computer Science"
                value={newStaff.department}
                onChange={e => setNewStaff(p => ({ ...p, department: e.target.value }))}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} className="rounded-xl">Cancel</Button>
            <Button
              onClick={handleAddStaff}
              disabled={addLoading}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {addLoading ? 'Adding…' : 'Add Staff Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
