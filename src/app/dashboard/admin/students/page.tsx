'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
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
import {
  Upload, UserPlus, Search, Download, RefreshCw,
  Trash2, KeyRound, CheckCircle2, AlertTriangle,
  Users, FileSpreadsheet, XCircle, Pencil,
} from 'lucide-react';

const PROGRAMS = ['BCA', 'BCA(DS)', 'BCom', 'MSc(ADS)', 'MCom', 'MCA', 'MCA GenAI'];
const YEARS    = [1, 2, 3];

interface Student {
  _id: string;
  name: string;
  rollNumber: string;
  email: string;
  program: string;
  department: string;
  year: number;
  batch: string;
  section: string;
  selfAssessmentCompleted: boolean;
  isActive: boolean;
}

const BLANK_STUDENT = {
  name: '', rollNumber: '', email: '', program: '',
  department: '', year: 1, batch: '', section: '',
};

export default function StudentManagementPage() {
  const { toast } = useToast();
  const fileRef   = useRef<HTMLInputElement>(null);
  // Holds the full parsed rows from the uploaded Excel file
  const allRowsRef = useRef<any[]>([]);

  const [students,      setStudents]      = useState<Student[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [filterProgram, setFilterProgram] = useState('');
  const [filterYear,    setFilterYear]    = useState('');

  // Add single student dialog
  const [addOpen,    setAddOpen]    = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newStudent, setNewStudent] = useState(BLANK_STUDENT);

  // Edit student dialog
  const [editStudent,  setEditStudent]  = useState<Student | null>(null);
  const [editData,     setEditData]     = useState<any>(null);
  const [editLoading,  setEditLoading]  = useState(false);

  // Import dialog
  const [importOpen,    setImportOpen]    = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult,  setImportResult]  = useState<{ created: number; skipped: number; errors: string[] } | null>(null);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterProgram) params.set('program', filterProgram);
      if (filterYear)    params.set('year',    filterYear);
      const res  = await fetch(`/api/admin/students?${params}`);
      const data = await res.json();
      setStudents(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast({ title: 'Failed to load students', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [filterProgram, filterYear, toast]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  // ── Add single student ──────────────────────────────────────────────────────
  const handleAddStudent = async () => {
    const roll  = newStudent.rollNumber.trim();
    const email = newStudent.email.trim();
    if (!newStudent.name.trim() || !roll) {
      toast({ title: 'Name and Roll Number are required', variant: 'destructive' });
      return;
    }
    if (!/^[a-zA-Z0-9]{15}$/.test(roll)) {
      toast({ title: 'Roll number must be exactly 15 alphanumeric characters', variant: 'destructive' });
      return;
    }
    if (email && !/^[a-zA-Z0-9._%+-]+@srmist\.edu\.in$/i.test(email)) {
      toast({ title: 'Email must be a valid @srmist.edu.in address', variant: 'destructive' });
      return;
    }
    setAddLoading(true);
    try {
      const res  = await fetch('/api/admin/students', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(newStudent),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add student');
      toast({ title: `${newStudent.name} added. Default password: ${newStudent.rollNumber.toUpperCase()}` });
      setAddOpen(false);
      setNewStudent(BLANK_STUDENT);
      loadStudents();
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setAddLoading(false); }
  };

  // ── Excel file upload ───────────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb   = XLSX.read(ev.target?.result, { type: 'binary' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws) as any[];
      allRowsRef.current = rows;
      setImportPreview(rows.slice(0, 5));
      setImportResult(null);
      setImportOpen(true);
    };
    reader.readAsBinaryString(file);
    // Reset so the same file can be re-uploaded if needed
    e.target.value = '';
  };

  const handleImport = async () => {
    if (allRowsRef.current.length === 0) return;
    setImportLoading(true);
    try {
      const res  = await fetch('/api/admin/students', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(allRowsRef.current),
      });
      const data = await res.json();
      setImportResult(data);
      loadStudents();
    } catch {
      toast({ title: 'Import failed. Please try again.', variant: 'destructive' });
    } finally {
      setImportLoading(false);
    }
  };

  // ── Per-student actions ─────────────────────────────────────────────────────
  const callAction = async (id: string, action: string) => {
    await fetch(`/api/admin/students/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action }),
    });
  };

  const resetPassword = async (s: Student) => {
    await callAction(s._id, 'reset-password');
    toast({ title: `Password reset to roll number for ${s.name}` });
  };

  const resetAssessment = async (s: Student) => {
    await callAction(s._id, 'reset-assessment');
    toast({ title: `Self-assessment reset for ${s.name}` });
    loadStudents();
  };

  const deactivate = async (s: Student) => {
    if (!confirm(`Deactivate ${s.name}? They will not be able to log in.`)) return;
    await fetch(`/api/admin/students/${s._id}`, { method: 'DELETE' });
    toast({ title: `${s.name} deactivated` });
    loadStudents();
  };

  const openEdit = (s: Student) => {
    setEditStudent(s);
    setEditData({
      name:       s.name,
      rollNumber: s.rollNumber,
      email:      s.email,
      program:    s.program,
      department: s.department,
      year:       s.year,
      batch:      s.batch,
      section:    s.section,
    });
  };

  const handleEditSave = async () => {
    if (!editStudent || !editData) return;
    const roll  = (editData.rollNumber || '').trim().toUpperCase();
    const email = (editData.email || '').trim().toLowerCase();
    if (!editData.name?.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' }); return;
    }
    if (roll && !/^[a-zA-Z0-9]{15}$/.test(roll)) {
      toast({ title: 'Roll number must be exactly 15 alphanumeric characters', variant: 'destructive' }); return;
    }
    if (email && !/^[a-zA-Z0-9._%+-]+@srmist\.edu\.in$/i.test(email)) {
      toast({ title: 'Email must be a valid @srmist.edu.in address', variant: 'destructive' }); return;
    }
    setEditLoading(true);
    try {
      const res  = await fetch(`/api/admin/students/${editStudent._id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...editData, rollNumber: roll, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      toast({ title: `${editData.name} updated successfully` });
      setEditStudent(null);
      setEditData(null);
      loadStudents();
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setEditLoading(false);
    }
  };

  // ── Excel template download ─────────────────────────────────────────────────
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['name', 'rollNumber', 'email', 'program', 'department', 'year', 'batch', 'section'],
      ['Sahan Kumar',  'RA2211003010001', 'sahan@srmist.edu.in',  'BCA',        'Computer Science', 1, '2024-2027', 'A'],
      ['Priya Sharma', 'RA2211003010002', 'priya@srmist.edu.in',  'MCA',        'Computer Science', 2, '2023-2025', 'B'],
      ['Arun Raj',     'RA2211003010003', 'arun@srmist.edu.in',   'BCom',       'Commerce',         1, '2024-2027', 'A'],
      ['Meena Iyer',   'RA2211003010004', 'meena@srmist.edu.in',  'MSc(ADS)',   'Data Science',     1, '2024-2026', 'A'],
    ]);
    ws['!cols'] = [20, 20, 25, 12, 20, 8, 12, 10].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'SRM_Student_Import_Template.xlsx');
  };

  // ── Derived data ────────────────────────────────────────────────────────────
  const filtered = students.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.rollNumber?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  const completed = students.filter(s => s.selfAssessmentCompleted).length;
  const rate      = students.length > 0 ? Math.round((completed / students.length) * 100) : 0;

  const stats = [
    { label: 'Total Students',       value: students.length, color: 'text-blue-600'   },
    { label: 'Assessment Completed', value: completed,        color: 'text-green-600'  },
    { label: 'Pending Assessment',   value: students.length - completed, color: 'text-orange-600' },
    { label: 'Completion Rate',      value: `${rate}%`,      color: 'text-indigo-600' },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-slate-900">Student Management</h1>
          <p className="text-slate-500 mt-1">Register students, manage accounts, and reset passwords.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={downloadTemplate} className="rounded-xl gap-2">
            <Download className="h-4 w-4" /> Excel Template
          </Button>
          <Button variant="outline" onClick={() => window.location.href = '/dashboard/guide'} className="rounded-xl gap-2 border-violet-300 text-violet-700 hover:bg-violet-50">
            <FileSpreadsheet className="h-4 w-4" /> Student Guide (PDF)
          </Button>
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            className="rounded-xl gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            <FileSpreadsheet className="h-4 w-4" /> Import Excel
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
          <Button
            onClick={() => setAddOpen(true)}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
          >
            <UserPlus className="h-4 w-4" /> Add Student
          </Button>
        </div>
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
                placeholder="Search name, roll number, email…"
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              value={filterProgram}
              onChange={e => setFilterProgram(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white"
            >
              <option value="">All Programs</option>
              {PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select
              value={filterYear}
              onChange={e => setFilterYear(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white"
            >
              <option value="">All Years</option>
              {YEARS.map(y => (
                <option key={y} value={y}>
                  {y === 1 ? '1st Year' : y === 2 ? '2nd Year' : '3rd Year'}
                </option>
              ))}
            </select>
            <Button variant="outline" onClick={loadStudents} className="rounded-xl" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Student Table */}
      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Students ({filtered.length})
          </CardTitle>
          <CardDescription>
            Default password for every student is their Roll Number. Use the key icon to reset.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Roll Number</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Assessment</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                      Loading students…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                      No students found. Use "Add Student" or "Import Excel" to register students.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(student => (
                    <TableRow key={student._id}>
                      <TableCell>
                        <div className="font-medium text-slate-900">{student.name}</div>
                        {student.email && (
                          <div className="text-xs text-slate-400">{student.email}</div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{student.rollNumber}</TableCell>
                      <TableCell>
                        {student.program
                          ? <Badge variant="outline">{student.program}</Badge>
                          : <span className="text-slate-400">—</span>}
                      </TableCell>
                      <TableCell>
                        {student.year ? `Year ${student.year}` : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 font-medium">
                        {student.section || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {student.batch || '—'}
                      </TableCell>
                      <TableCell>
                        {student.selfAssessmentCompleted ? (
                          <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-orange-500 font-semibold">
                            <AlertTriangle className="h-3.5 w-3.5" /> Pending
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost" size="sm"
                            title="Edit student details"
                            onClick={() => openEdit(student)}
                            className="text-slate-400 hover:text-indigo-600"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            title="Reset password to roll number"
                            onClick={() => resetPassword(student)}
                            className="text-slate-400 hover:text-blue-600"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            title="Reset self-assessment"
                            onClick={() => resetAssessment(student)}
                            className="text-slate-400 hover:text-orange-600"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            title="Deactivate student"
                            onClick={() => deactivate(student)}
                            className="text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      {/* ── Add Student Dialog ── */}
      <Dialog open={addOpen} onOpenChange={open => { setAddOpen(open); if (!open) setNewStudent(BLANK_STUDENT); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Single Student</DialogTitle>
            <DialogDescription>
              Default password will be set to the Roll Number. Student must log in and complete self-assessment.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Full Name *</Label>
              <Input placeholder="Sahan Kumar" value={newStudent.name}
                onChange={e => setNewStudent(p => ({ ...p, name: e.target.value }))} className="rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Roll Number * <span className="text-slate-400">(alphanumeric, exactly 15)</span></Label>
              <Input
                placeholder="RA2532242020001"
                value={newStudent.rollNumber}
                maxLength={15}
                onChange={e => {
                  const v = e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15).toUpperCase();
                  setNewStudent(p => ({ ...p, rollNumber: v }));
                }}
                className="rounded-xl font-mono"
              />
              {newStudent.rollNumber && newStudent.rollNumber.length !== 15 && (
                <p className="text-[11px] text-red-500">{newStudent.rollNumber.length}/15 characters</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email <span className="text-slate-400">(@srmist.edu.in only)</span></Label>
              <Input
                type="email"
                placeholder="sahan@srmist.edu.in"
                value={newStudent.email}
                onChange={e => setNewStudent(p => ({ ...p, email: e.target.value.toLowerCase() }))}
                className="rounded-xl"
              />
              {newStudent.email && !/^[a-zA-Z0-9._%+-]+@srmist\.edu\.in$/i.test(newStudent.email) && (
                <p className="text-[11px] text-red-500">Must be @srmist.edu.in</p>
              )}
            </div>
            {([
              { label: 'Department', key: 'department', placeholder: 'Computer Science' },
              { label: 'Batch',      key: 'batch',      placeholder: '2024-2027'        },
              { label: 'Section',    key: 'section',    placeholder: 'A'                },
            ] as const).map(f => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Input placeholder={f.placeholder} value={(newStudent as any)[f.key]}
                  onChange={e => setNewStudent(p => ({ ...p, [f.key]: e.target.value }))} className="rounded-xl" />
              </div>
            ))}
            <div className="space-y-1">
              <Label className="text-xs">Program</Label>
              <select
                value={newStudent.program}
                onChange={e => setNewStudent(p => ({ ...p, program: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              >
                <option value="">Select program</option>
                {PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Year of Study</Label>
              <select
                value={newStudent.year}
                onChange={e => setNewStudent(p => ({ ...p, year: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              >
                {YEARS.map(y => (
                  <option key={y} value={y}>
                    {y === 1 ? '1st Year' : y === 2 ? '2nd Year' : '3rd Year'}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleAddStudent}
              disabled={addLoading}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {addLoading ? 'Adding…' : 'Add Student'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Student Dialog ── */}
      <Dialog open={!!editStudent} onOpenChange={open => { if (!open) { setEditStudent(null); setEditData(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Student — {editStudent?.name}</DialogTitle>
            <DialogDescription>Update any field below. Roll number and email validations still apply.</DialogDescription>
          </DialogHeader>
          {editData && (
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Full Name *</Label>
                <Input value={editData.name} onChange={e => setEditData((p: any) => ({ ...p, name: e.target.value }))} className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Roll Number <span className="text-slate-400">(alphanumeric, exactly 15)</span></Label>
                <Input
                  value={editData.rollNumber}
                  maxLength={15}
                  onChange={e => setEditData((p: any) => ({ ...p, rollNumber: e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15).toUpperCase() }))}
                  className="rounded-xl font-mono"
                />
                {editData.rollNumber && editData.rollNumber.length !== 15 && (
                  <p className="text-[11px] text-red-500">{editData.rollNumber.length}/15 characters</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email <span className="text-slate-400">(@srmist.edu.in only)</span></Label>
                <Input
                  type="email"
                  value={editData.email}
                  onChange={e => setEditData((p: any) => ({ ...p, email: e.target.value.toLowerCase() }))}
                  className="rounded-xl"
                />
                {editData.email && !/^[a-zA-Z0-9._%+-]+@srmist\.edu\.in$/i.test(editData.email) && (
                  <p className="text-[11px] text-red-500">Must be @srmist.edu.in</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Department</Label>
                <Input value={editData.department} onChange={e => setEditData((p: any) => ({ ...p, department: e.target.value }))} className="rounded-xl" placeholder="Computer Science" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Batch</Label>
                <Input value={editData.batch} onChange={e => setEditData((p: any) => ({ ...p, batch: e.target.value }))} className="rounded-xl" placeholder="2024-2027" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Section</Label>
                <Input value={editData.section} onChange={e => setEditData((p: any) => ({ ...p, section: e.target.value }))} className="rounded-xl" placeholder="A" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Program</Label>
                <select value={editData.program} onChange={e => setEditData((p: any) => ({ ...p, program: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
                  <option value="">Select program</option>
                  {PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Year of Study</Label>
                <select value={editData.year} onChange={e => setEditData((p: any) => ({ ...p, year: parseInt(e.target.value) }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
                  {[1, 2, 3].map(y => <option key={y} value={y}>{y === 1 ? '1st' : y === 2 ? '2nd' : '3rd'} Year</option>)}
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditStudent(null); setEditData(null); }} className="rounded-xl">Cancel</Button>
            <Button onClick={handleEditSave} disabled={editLoading} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
              {editLoading ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Import Preview Dialog ── */}
      <Dialog open={importOpen} onOpenChange={open => { setImportOpen(open); if (!open) setImportResult(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Students from Excel</DialogTitle>
            <DialogDescription>
              {importResult
                ? 'Import complete.'
                : `Previewing first ${importPreview.length} of ${allRowsRef.current.length} rows. Required columns: name, rollNumber — all others optional.`}
            </DialogDescription>
          </DialogHeader>

          {importResult ? (
            <div className="space-y-4 py-2">
              <div className="flex gap-6">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-bold text-lg">{importResult.created}</span>
                  <span className="text-sm">created</span>
                </div>
                <div className="flex items-center gap-2 text-slate-500">
                  <XCircle className="h-5 w-5" />
                  <span className="font-bold text-lg">{importResult.skipped}</span>
                  <span className="text-sm">skipped (already exist)</span>
                </div>
              </div>
              {importResult.errors?.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 max-h-40 overflow-y-auto">
                  <p className="text-xs font-bold text-red-700 mb-1">Errors ({importResult.errors.length}):</p>
                  {importResult.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600">{e}</p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto py-2 max-h-64">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    {importPreview[0] && Object.keys(importPreview[0]).map(k => (
                      <th key={k} className="text-left py-2 px-2 text-slate-500 font-semibold whitespace-nowrap">
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importPreview.map((row, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                      {Object.values(row).map((v: any, j) => (
                        <td key={j} className="py-2 px-2 text-slate-700 whitespace-nowrap">{String(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {allRowsRef.current.length > 5 && (
                <p className="text-xs text-slate-400 mt-2 text-center">
                  …and {allRowsRef.current.length - 5} more rows
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setImportOpen(false); setImportResult(null); }}
              className="rounded-xl"
            >
              {importResult ? 'Close' : 'Cancel'}
            </Button>
            {!importResult && (
              <Button
                onClick={handleImport}
                disabled={importLoading || allRowsRef.current.length === 0}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
              >
                <Upload className="h-4 w-4" />
                {importLoading ? 'Importing…' : `Import ${allRowsRef.current.length} Students`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
