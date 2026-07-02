'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { getCurrentUser } from '@/lib/mock-db';
import {
  Plus, BookOpen, Pencil, Trash2, GraduationCap,
  ChevronDown, ChevronRight, Loader2, Trophy,
  Users, BarChart2, Star, Timer, Medal,
} from 'lucide-react';

interface Subject {
  _id?: string;
  name: string;
  syllabus: string;
  topics: string[];
}

interface Course {
  _id: string;
  name: string;
  description: string;
  teacherId: string;
  teacherName: string;
  subjects: Subject[];
  createdAt: string;
}

interface LeaderboardEntry {
  _id: { userId: string; courseId: string; subjectName: string };
  userName: string;
  courseName: string;
  subjectName: string;
  difficulty: string;
  bestScore: number;
  xpEarned: number;
  attempts: number;
}

function formatDate(iso: string) {
  try { return new Intl.DateTimeFormat('en-GB').format(new Date(iso)); } catch { return '—'; }
}

export default function TeacherExamPage() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('courses');

  // Course dialog
  const [courseDialog, setCourseDialog] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseName, setCourseName] = useState('');
  const [courseDesc, setCourseDesc] = useState('');
  const [savingCourse, setSavingCourse] = useState(false);

  // Subject dialog
  const [subjectDialog, setSubjectDialog] = useState(false);
  const [targetCourseId, setTargetCourseId] = useState('');
  const [editingSubjectIdx, setEditingSubjectIdx] = useState<number | null>(null);
  const [subjectName, setSubjectName] = useState('');
  const [subjectSyllabus, setSubjectSyllabus] = useState('');
  const [subjectTopics, setSubjectTopics] = useState('');
  const [savingSubject, setSavingSubject] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const user = getCurrentUser();
      if (!user) return;
      const userId = user._id || user.id;
      const [cRes, lRes] = await Promise.all([
        fetch(`/api/courses?teacherId=${userId}`),
        fetch('/api/exam-results?leaderboard=1'),
      ]);
      const cData = await cRes.json();
      const lData = await lRes.json();
      setCourses(Array.isArray(cData) ? cData : []);
      setLeaderboard(Array.isArray(lData) ? lData : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ── Course CRUD ──────────────────────────────────────────────────────────────

  const openNewCourse = () => {
    setEditingCourse(null);
    setCourseName('');
    setCourseDesc('');
    setCourseDialog(true);
  };

  const openEditCourse = (course: Course) => {
    setEditingCourse(course);
    setCourseName(course.name);
    setCourseDesc(course.description);
    setCourseDialog(true);
  };

  const saveCourse = async () => {
    if (!courseName.trim()) return;
    setSavingCourse(true);
    try {
      const user = getCurrentUser();
      if (!user) return;
      if (editingCourse) {
        await fetch(`/api/courses/${editingCourse._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: courseName, description: courseDesc }),
        });
        toast({ title: 'Course updated' });
      } else {
        await fetch('/api/courses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: courseName,
            description: courseDesc,
            teacherId: user._id || user.id,
            teacherName: user.name,
            subjects: [],
          }),
        });
        toast({ title: 'Course created!' });
      }
      setCourseDialog(false);
      loadData();
    } catch (e) {
      toast({ title: 'Error saving course', variant: 'destructive' });
    } finally {
      setSavingCourse(false);
    }
  };

  const deleteCourse = async (id: string) => {
    if (!confirm('Delete this course? Students will no longer be able to take exams for it.')) return;
    await fetch(`/api/courses/${id}`, { method: 'DELETE' });
    toast({ title: 'Course deleted' });
    loadData();
  };

  // ── Subject CRUD ─────────────────────────────────────────────────────────────

  const openNewSubject = (courseId: string) => {
    setTargetCourseId(courseId);
    setEditingSubjectIdx(null);
    setSubjectName('');
    setSubjectSyllabus('');
    setSubjectTopics('');
    setSubjectDialog(true);
  };

  const openEditSubject = (courseId: string, idx: number, subject: Subject) => {
    setTargetCourseId(courseId);
    setEditingSubjectIdx(idx);
    setSubjectName(subject.name);
    setSubjectSyllabus(subject.syllabus);
    setSubjectTopics(subject.topics.join(', '));
    setSubjectDialog(true);
  };

  const saveSubject = async () => {
    if (!subjectName.trim() || !subjectSyllabus.trim()) return;
    setSavingSubject(true);
    try {
      const course = courses.find(c => c._id === targetCourseId);
      if (!course) return;
      const newSubject: Subject = {
        name: subjectName,
        syllabus: subjectSyllabus,
        topics: subjectTopics.split(',').map(t => t.trim()).filter(Boolean),
      };
      const updatedSubjects = [...course.subjects];
      if (editingSubjectIdx !== null) {
        updatedSubjects[editingSubjectIdx] = newSubject;
      } else {
        updatedSubjects.push(newSubject);
      }
      await fetch(`/api/courses/${targetCourseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjects: updatedSubjects }),
      });
      toast({ title: editingSubjectIdx !== null ? 'Subject updated' : 'Subject added!' });
      setSubjectDialog(false);
      loadData();
    } catch (e) {
      toast({ title: 'Error saving subject', variant: 'destructive' });
    } finally {
      setSavingSubject(false);
    }
  };

  const deleteSubject = async (course: Course, idx: number) => {
    if (!confirm('Remove this subject?')) return;
    const updatedSubjects = course.subjects.filter((_, i) => i !== idx);
    await fetch(`/api/courses/${course._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjects: updatedSubjects }),
    });
    toast({ title: 'Subject removed' });
    loadData();
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold text-slate-900">Exam Management</h1>
          <p className="text-slate-500 mt-1">Create courses, add subjects with syllabi, and track student performance</p>
        </div>
        <Button
          onClick={openNewCourse}
          className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl shadow-lg"
        >
          <Plus className="h-4 w-4 mr-2" /> New Course
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Courses', value: courses.length, icon: BookOpen, color: 'text-indigo-600 bg-indigo-50' },
          { label: 'Total Subjects', value: courses.reduce((a, c) => a + c.subjects.length, 0), icon: GraduationCap, color: 'text-violet-600 bg-violet-50' },
          { label: 'Exam Attempts', value: leaderboard.reduce((a, l) => a + l.attempts, 0), icon: Trophy, color: 'text-amber-600 bg-amber-50' },
        ].map(s => (
          <Card key={s.label} className="border-slate-200 shadow-sm">
            <CardContent className="flex items-center gap-4 pt-5 pb-5">
              <div className={`p-3 rounded-xl ${s.color}`}><s.icon className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                <p className="text-sm text-slate-500">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 rounded-xl p-1">
          <TabsTrigger value="courses" className="rounded-lg">My Courses</TabsTrigger>
          <TabsTrigger value="leaderboard" className="rounded-lg">Leaderboard</TabsTrigger>
        </TabsList>

        {/* ── Courses Tab ── */}
        <TabsContent value="courses" className="space-y-4 mt-4">
          {courses.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200 shadow-none">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <BookOpen className="h-12 w-12 text-slate-300 mb-4" />
                <p className="font-semibold text-slate-600 text-lg">No courses yet</p>
                <p className="text-slate-400 text-sm mt-1 mb-6">Create a course and add subjects with syllabus to let students take AI exams.</p>
                <Button onClick={openNewCourse} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
                  <Plus className="h-4 w-4 mr-2" /> Create First Course
                </Button>
              </CardContent>
            </Card>
          ) : (
            courses.map(course => {
              const isExpanded = expandedCourse === course._id;
              return (
                <Card key={course._id} className="border-slate-200 shadow-sm overflow-hidden">
                  {/* Course header row */}
                  <div
                    className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedCourse(isExpanded ? null : course._id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{course.name}</p>
                        {course.description && <p className="text-xs text-slate-500 mt-0.5">{course.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="text-xs">{course.subjects.length} subject{course.subjects.length !== 1 ? 's' : ''}</Badge>
                      <button onClick={(e) => { e.stopPropagation(); openEditCourse(course); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteCourse(course._id); }} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                    </div>
                  </div>

                  {/* Expanded subjects */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4 space-y-3">
                      {course.subjects.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-4">No subjects yet — add one below.</p>
                      ) : (
                        course.subjects.map((subject, idx) => (
                          <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <p className="font-semibold text-slate-800">{subject.name}</p>
                                {subject.topics.map(t => (
                                  <span key={t} className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full">{t}</span>
                                ))}
                              </div>
                              <p className="text-xs text-slate-500 line-clamp-2">{subject.syllabus}</p>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <button onClick={() => openEditSubject(course._id, idx, subject)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => deleteSubject(course, idx)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                      <Button
                        onClick={() => openNewSubject(course._id)}
                        variant="outline"
                        size="sm"
                        className="w-full rounded-xl border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50"
                      >
                        <Plus className="h-4 w-4 mr-2" /> Add Subject
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ── Leaderboard Tab ── */}
        <TabsContent value="leaderboard" className="mt-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" /> Student Leaderboard
              </CardTitle>
              <CardDescription>Best scores per student per subject (across all exam attempts)</CardDescription>
            </CardHeader>
            <CardContent>
              {leaderboard.length === 0 ? (
                <p className="text-center text-slate-400 py-8">No exam attempts yet. Students haven't taken any exams.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Rank</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Student</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Course</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Best Score</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">XP</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Attempts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((entry, idx) => {
                        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                        return (
                          <tr key={idx} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${idx < 3 ? 'bg-amber-50/30' : ''}`}>
                            <td className="py-3 px-3 font-bold text-slate-700">
                              {medal ? <span className="text-lg">{medal}</span> : <span className="text-slate-400">#{idx + 1}</span>}
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-800">{entry.userName}</td>
                            <td className="py-3 px-3 text-slate-600">{entry.courseName}</td>
                            <td className="py-3 px-3 text-slate-600">{entry.subjectName}</td>
                            <td className="py-3 px-3">
                              <span className={`font-bold ${entry.bestScore >= 80 ? 'text-green-600' : entry.bestScore >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>
                                {Math.round(entry.bestScore)}%
                              </span>
                            </td>
                            <td className="py-3 px-3 text-amber-600 font-semibold">+{entry.xpEarned}</td>
                            <td className="py-3 px-3 text-slate-500">{entry.attempts}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Course Dialog ── */}
      <Dialog open={courseDialog} onOpenChange={setCourseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCourse ? 'Edit Course' : 'Create New Course'}</DialogTitle>
            <DialogDescription>Courses group related subjects together for exam purposes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cname">Course Name <span className="text-red-500">*</span></Label>
              <Input id="cname" placeholder="e.g. B.Tech Computer Science Sem 4" value={courseName} onChange={e => setCourseName(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cdesc">Description <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Input id="cdesc" placeholder="Brief description of the course" value={courseDesc} onChange={e => setCourseDesc(e.target.value)} className="rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCourseDialog(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={saveCourse} disabled={!courseName.trim() || savingCourse} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
              {savingCourse ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingCourse ? 'Save Changes' : 'Create Course'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Subject Dialog ── */}
      <Dialog open={subjectDialog} onOpenChange={setSubjectDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSubjectIdx !== null ? 'Edit Subject' : 'Add Subject'}</DialogTitle>
            <DialogDescription>
              The syllabus you write here is exactly what the AI will use to generate exam questions. Be thorough.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Subject Name <span className="text-red-500">*</span></Label>
              <Input placeholder="e.g. Data Structures, Operating Systems" value={subjectName} onChange={e => setSubjectName(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Topic Tags <span className="text-slate-400 font-normal">(comma separated, optional)</span></Label>
              <Input placeholder="Arrays, Linked Lists, Trees, Sorting" value={subjectTopics} onChange={e => setSubjectTopics(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Syllabus <span className="text-red-500">*</span></Label>
              <p className="text-xs text-slate-500">Write the complete syllabus. The AI will generate questions ONLY from this content. Include definitions, formulas, concepts, and topics covered.</p>
              <Textarea
                placeholder={`Example:\nUnit 1: Arrays and Strings\n- Definition and memory representation of arrays\n- One-dimensional and multi-dimensional arrays\n- String operations: concatenation, reversal, pattern matching\n\nUnit 2: Linked Lists\n- Singly linked list: insertion, deletion, traversal\n- Doubly linked list operations\n- Circular linked lists\n...`}
                value={subjectSyllabus}
                onChange={e => setSubjectSyllabus(e.target.value)}
                className="min-h-[220px] rounded-xl font-mono text-sm"
              />
              <p className="text-xs text-slate-400">{subjectSyllabus.length} characters — more detail = better questions</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubjectDialog(false)} className="rounded-xl">Cancel</Button>
            <Button
              onClick={saveSubject}
              disabled={!subjectName.trim() || !subjectSyllabus.trim() || savingSubject}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {savingSubject ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingSubjectIdx !== null ? 'Save Changes' : 'Add Subject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}