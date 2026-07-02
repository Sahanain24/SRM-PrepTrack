'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/mock-db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  ArrowLeft, Users, Megaphone, BookOpen, ClipboardList, BarChart2,
  Plus, Paperclip, Send, Loader2, Pin, Trash2, MessageSquare,
  ChevronDown, ChevronUp, CheckCircle2, FileText, X, UserPlus,
  ExternalLink, Download, Pencil,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Attachment { name: string; url: string; mimeType: string; size: number }
interface PollOption  { _id: string; text: string; voterIds: string[] }
interface Post {
  _id: string; type: 'announcement'|'material'|'assignment'|'poll';
  title: string; content: string; topic: string;
  attachments: Attachment[];
  dueDate?: string; totalMarks?: number;
  pollOptions?: PollOption[]; pollClosedAt?: string;
  isPinned: boolean; allowComments: boolean;
  teacherName: string; createdAt: string;
}
interface Comment { _id: string; userId: string; userName: string; role: string; content: string; createdAt: string }
interface Submission { _id: string; studentId: string; studentName: string; rollNumber: string; content: string; attachments: Attachment[]; submittedAt: string; grade?: number; feedback?: string; status: string }
interface Student { _id: string; name: string; rollNumber: string; program: string; year: number; section: string }
interface Batch   { _id: string; name: string; program: string; year: number; section: string; subject: string; studentCount: number; students: Student[] }

// ── Helpers ────────────────────────────────────────────────────────────────────
const TYPE_META = {
  announcement: { label: 'Announcement', icon: Megaphone,     color: 'bg-blue-500',   light: 'bg-blue-50 text-blue-700 border-blue-200'   },
  material:     { label: 'Material',     icon: BookOpen,       color: 'bg-purple-500', light: 'bg-purple-50 text-purple-700 border-purple-200' },
  assignment:   { label: 'Assignment',   icon: ClipboardList,  color: 'bg-orange-500', light: 'bg-orange-50 text-orange-700 border-orange-200' },
  poll:         { label: 'Poll',         icon: BarChart2,      color: 'bg-pink-500',   light: 'bg-pink-50 text-pink-700 border-pink-200'     },
};

function fmtSize(bytes: number) {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024**2)    return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1024**2).toFixed(1)} MB`;
}
function fmtDate(iso: string) {
  try { return new Intl.DateTimeFormat('en-GB').format(new Date(iso)); } catch { return '—'; }
}
function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

// ── File uploader ──────────────────────────────────────────────────────────────
function FileUploader({ onUploaded }: { onUploaded: (a: Attachment) => void }) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res  = await fetch('/api/classroom/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUploaded(data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = '';
    }
  };

  return (
    <label className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 cursor-pointer transition-colors">
      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
      {uploading ? 'Uploading…' : 'Attach file'}
      <input ref={ref} type="file" className="hidden" onChange={handleFile} disabled={uploading} />
    </label>
  );
}

// ── Post card ──────────────────────────────────────────────────────────────────
function PostCard({
  post, teacherId, teacherName, batchId, onDelete, onPin,
}: {
  post: Post; teacherId: string; teacherName: string; batchId: string;
  onDelete: () => void; onPin: () => void;
}) {
  const { toast } = useToast();
  const meta    = TYPE_META[post.type];
  const Icon    = meta.icon;

  const [comments, setComments]         = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText]   = useState('');
  const [posting, setPosting]           = useState(false);
  const [submissions, setSubmissions]   = useState<Submission[]>([]);
  const [showSubs, setShowSubs]         = useState(false);
  const [grading, setGrading]           = useState<Submission | null>(null);
  const [gradeVal, setGradeVal]         = useState('');
  const [feedbackVal, setFeedbackVal]   = useState('');
  const [saving, setSaving]             = useState(false);
  const [voted, setVoted]               = useState<Record<string, string>>({}); // postId -> optionId (teacher view)
  const [pollData, setPollData]         = useState<PollOption[]>(post.pollOptions || []);

  const loadComments = async () => {
    const res  = await fetch(`/api/classroom/posts/${post._id}/comments`);
    const data = await res.json();
    setComments(Array.isArray(data) ? data : []);
  };
  const loadSubmissions = async () => {
    const res  = await fetch(`/api/classroom/posts/${post._id}/submissions`);
    const data = await res.json();
    setSubmissions(Array.isArray(data) ? data : []);
  };

  const postComment = async () => {
    if (!commentText.trim()) return;
    setPosting(true);
    await fetch(`/api/classroom/posts/${post._id}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: teacherId, userName: teacherName, role: 'teacher', content: commentText }),
    });
    setCommentText('');
    await loadComments();
    setPosting(false);
  };

  const saveGrade = async () => {
    if (!grading) return;
    setSaving(true);
    await fetch(`/api/classroom/posts/${post._id}/submissions/${grading._id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grade: Number(gradeVal), feedback: feedbackVal, gradedBy: teacherName }),
    });
    toast({ title: 'Grade saved' });
    setGrading(null);
    await loadSubmissions();
    setSaving(false);
  };

  const totalVotes = pollData.reduce((s, o) => s + o.voterIds.length, 0);

  return (
    <Card className={`border-slate-200 shadow-sm ${post.isPinned ? 'border-l-4 border-l-amber-400' : ''}`}>
      <CardContent className="pt-5 pb-5 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-xl ${meta.color} text-white flex-shrink-0`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 ${meta.light}`}>
                {meta.label}
              </span>
              {post.topic && <span className="text-[10px] text-slate-400 border border-slate-200 rounded-full px-2 py-0.5">{post.topic}</span>}
              {post.isPinned && <span className="text-[10px] text-amber-600 font-bold">📌 Pinned</span>}
            </div>
            <h3 className="font-semibold text-slate-900 mt-1">{post.title}</h3>
            <p className="text-xs text-slate-400">{post.teacherName} · {fmtDateTime(post.createdAt)}</p>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={onPin} title={post.isPinned ? 'Unpin' : 'Pin'}
              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-colors">
              <Pin className="h-3.5 w-3.5" />
            </button>
            <button onClick={onDelete}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        {post.content && <p className="text-sm text-slate-700 whitespace-pre-wrap">{post.content}</p>}

        {/* Assignment meta */}
        {post.type === 'assignment' && (
          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            {post.dueDate    && <span>📅 Due: <strong>{fmtDate(post.dueDate)}</strong></span>}
            {post.totalMarks && <span>⭐ {post.totalMarks} marks</span>}
          </div>
        )}

        {/* Poll */}
        {post.type === 'poll' && pollData.length > 0 && (
          <div className="space-y-2">
            {pollData.map(opt => {
              const pct = totalVotes ? Math.round((opt.voterIds.length / totalVotes) * 100) : 0;
              return (
                <div key={opt._id} className="bg-slate-50 rounded-lg p-2.5">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{opt.text}</span>
                    <span className="text-slate-500 text-xs">{opt.voterIds.length} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-2 bg-pink-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-slate-400">{totalVotes} total vote{totalVotes !== 1 ? 's' : ''}</p>
          </div>
        )}

        {/* Attachments */}
        {post.attachments?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.attachments.map((a, i) => (
              <a key={i} href={a.url} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-100 transition-colors">
                <FileText className="h-3.5 w-3.5 text-slate-400" />
                <span className="max-w-[160px] truncate">{a.name}</span>
                <span className="text-slate-400">{fmtSize(a.size)}</span>
                <ExternalLink className="h-3 w-3 text-slate-400 flex-shrink-0" />
              </a>
            ))}
          </div>
        )}

        {/* Submission summary (assignment) */}
        {post.type === 'assignment' && (
          <div>
            <button
              onClick={() => { setShowSubs(s => !s); if (!showSubs) loadSubmissions(); }}
              className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              <ClipboardList className="h-4 w-4" />
              View Submissions
              {showSubs ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {showSubs && (
              <div className="mt-3 space-y-2">
                {submissions.length === 0
                  ? <p className="text-sm text-slate-400">No submissions yet.</p>
                  : submissions.map(sub => (
                    <div key={sub._id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2.5 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate">{sub.studentName}</p>
                        <p className="text-xs text-slate-400">{sub.rollNumber} · {fmtDateTime(sub.submittedAt)}</p>
                        {sub.content && <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">{sub.content}</p>}
                      </div>
                      {sub.status === 'graded' ? (
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-green-600">{sub.grade}/{post.totalMarks}</p>
                          <p className="text-[10px] text-green-500">Graded</p>
                        </div>
                      ) : (
                        <Button size="sm" onClick={() => { setGrading(sub); setGradeVal(''); setFeedbackVal(''); }}
                          className="h-7 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex-shrink-0">
                          Grade
                        </Button>
                      )}
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        )}

        {/* Comments */}
        {post.allowComments && (
          <div>
            <button
              onClick={() => { setShowComments(s => !s); if (!showComments) loadComments(); }}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
            >
              <MessageSquare className="h-4 w-4" />
              Comments
              {showComments ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {showComments && (
              <div className="mt-3 space-y-2">
                {comments.map(c => (
                  <div key={c._id} className="flex gap-2.5 text-sm">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white
                      ${c.role === 'teacher' ? 'bg-indigo-500' : 'bg-slate-400'}`}>
                      {c.userName[0]}
                    </div>
                    <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2">
                      <p className="font-semibold text-slate-700 text-xs">{c.userName} {c.role === 'teacher' && <span className="text-indigo-500">(Teacher)</span>}</p>
                      <p className="text-slate-600">{c.content}</p>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Add a comment…"
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && postComment()}
                    className="rounded-xl text-sm"
                  />
                  <Button size="icon" onClick={postComment} disabled={posting} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 flex-shrink-0">
                    {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Grade dialog */}
      <Dialog open={!!grading} onOpenChange={() => setGrading(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Grade Submission</DialogTitle>
            <DialogDescription>{grading?.studentName} · {grading?.rollNumber}</DialogDescription>
          </DialogHeader>
          {grading?.content && (
            <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 max-h-32 overflow-y-auto">
              {grading.content}
            </div>
          )}
          {grading?.attachments && grading.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {grading.attachments.map((a, i) => (
                <a key={i} href={a.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                  <Download className="h-3 w-3" /> {a.name}
                </a>
              ))}
            </div>
          )}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <Label>Grade (out of {post.totalMarks ?? '—'})</Label>
                <Input type="number" min={0} max={post.totalMarks} value={gradeVal} onChange={e => setGradeVal(e.target.value)} className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Feedback</Label>
              <textarea
                value={feedbackVal}
                onChange={e => setFeedbackVal(e.target.value)}
                rows={3}
                placeholder="Write feedback for the student…"
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setGrading(null)} className="rounded-xl">Cancel</Button>
            <Button onClick={saveGrade} disabled={saving || !gradeVal} className="rounded-xl bg-green-600 hover:bg-green-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Save Grade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── Post composer ──────────────────────────────────────────────────────────────
function PostComposer({ batchId, teacherId, teacherName, onPosted }: {
  batchId: string; teacherId: string; teacherName: string; onPosted: () => void;
}) {
  const { toast } = useToast();
  const [type, setType]               = useState<'announcement'|'material'|'assignment'|'poll'>('announcement');
  const [title, setTitle]             = useState('');
  const [content, setContent]         = useState('');
  const [topic, setTopic]             = useState('');
  const [dueDate, setDueDate]         = useState('');
  const [totalMarks, setTotalMarks]   = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pollOpts, setPollOpts]       = useState(['', '']);
  const [posting, setPosting]         = useState(false);

  const handlePost = async () => {
    if (!title.trim()) { toast({ title: 'Title is required', variant: 'destructive' }); return; }
    if (type === 'poll' && pollOpts.filter(o => o.trim()).length < 2) {
      toast({ title: 'Add at least 2 poll options', variant: 'destructive' }); return;
    }
    setPosting(true);
    try {
      const body: any = { batchId, teacherId, teacherName, type, title, content, topic, attachments };
      if (type === 'assignment') { body.dueDate = dueDate; body.totalMarks = totalMarks; }
      if (type === 'poll')       { body.pollOptions = pollOpts.filter(o => o.trim()); }
      const res = await fetch('/api/classroom/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: 'Posted!' });
      setTitle(''); setContent(''); setTopic(''); setDueDate(''); setTotalMarks('');
      setAttachments([]); setPollOpts(['', '']);
      onPosted();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setPosting(false); }
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="pt-5 pb-5 space-y-4">
        {/* Type selector */}
        <div className="flex gap-2 flex-wrap">
          {(Object.entries(TYPE_META) as [string, typeof TYPE_META['announcement']][]).map(([key, m]) => {
            const Icon = m.icon;
            return (
              <button key={key} onClick={() => setType(key as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border transition-all
                  ${type === key ? `${m.color} text-white border-transparent shadow` : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                <Icon className="h-3.5 w-3.5" /> {m.label}
              </button>
            );
          })}
        </div>

        <Input placeholder="Title *" value={title} onChange={e => setTitle(e.target.value)} className="rounded-xl font-medium" />

        <textarea
          rows={3}
          placeholder={type === 'poll' ? 'Poll description (optional)' : 'Write something…'}
          value={content}
          onChange={e => setContent(e.target.value)}
          className="w-full rounded-xl border border-slate-200 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />

        {/* Topic (material) */}
        {(type === 'material' || type === 'assignment') && (
          <Input placeholder="Topic / Unit (optional)" value={topic} onChange={e => setTopic(e.target.value)} className="rounded-xl" />
        )}

        {/* Assignment fields */}
        {type === 'assignment' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Due Date</Label>
              <Input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Total Marks</Label>
              <Input type="number" min={1} placeholder="e.g. 20" value={totalMarks} onChange={e => setTotalMarks(e.target.value)} className="rounded-xl" />
            </div>
          </div>
        )}

        {/* Poll options */}
        {type === 'poll' && (
          <div className="space-y-2">
            {pollOpts.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder={`Option ${i + 1}`}
                  value={opt}
                  onChange={e => setPollOpts(p => p.map((o, j) => j === i ? e.target.value : o))}
                  className="rounded-xl"
                />
                {pollOpts.length > 2 && (
                  <button onClick={() => setPollOpts(p => p.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            {pollOpts.length < 6 && (
              <button onClick={() => setPollOpts(p => [...p, ''])} className="text-xs text-indigo-600 hover:underline">
                + Add option
              </button>
            )}
          </div>
        )}

        {/* Attachments (not for polls) */}
        {type !== 'poll' && (
          <div className="space-y-2">
            <FileUploader onUploaded={a => setAttachments(prev => [...prev, a])} />
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((a, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                    <FileText className="h-3 w-3 text-slate-400" />
                    <span className="max-w-[120px] truncate">{a.name}</span>
                    <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handlePost} disabled={posting} className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700">
            {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Post
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Students panel ─────────────────────────────────────────────────────────────
function StudentsPanel({ batch, onRefresh }: { batch: Batch; onRefresh: () => void }) {
  const { toast } = useToast();
  const [enrolling, setEnrolling] = useState(false);
  const [removing, setRemoving]   = useState<string | null>(null);

  const autoEnroll = async () => {
    setEnrolling(true);
    try {
      const res = await fetch(`/api/classroom/batches/${batch._id}/students`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollByFilter: { program: batch.program, year: batch.year, section: batch.section } }),
      });
      const { added } = await res.json();
      toast({ title: `Enrolled ${added} students` });
      onRefresh();
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
    finally { setEnrolling(false); }
  };

  const removeStudent = async (studentId: string) => {
    setRemoving(studentId);
    await fetch(`/api/classroom/batches/${batch._id}/students`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId }),
    });
    onRefresh();
    setRemoving(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">{batch.students?.length ?? 0} students enrolled</p>
        <Button size="sm" onClick={autoEnroll} disabled={enrolling} className="gap-1.5 rounded-xl text-xs h-8 bg-emerald-600 hover:bg-emerald-700">
          {enrolling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
          Auto-enroll by {batch.program} Y{batch.year}{batch.section ? ` §${batch.section}` : ''}
        </Button>
      </div>

      {(!batch.students || batch.students.length === 0) ? (
        <p className="text-sm text-slate-400 text-center py-8">No students enrolled yet. Use Auto-enroll to add matching students.</p>
      ) : (
        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
          {batch.students.map(s => (
            <div key={s._id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors group">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm flex-shrink-0">
                {s.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 text-sm truncate">{s.name}</p>
                <p className="text-xs text-slate-400">
                  {s.rollNumber}{s.section ? ` · Sec ${s.section}` : ''}
                </p>
              </div>
              <button
                onClick={() => removeStudent(s._id)}
                disabled={removing === s._id}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"
              >
                {removing === s._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function TeacherBatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = use(params);
  const router      = useRouter();
  const user        = getCurrentUser() as any;
  const teacherId   = user?._id || user?.id || '';
  const teacherName = user?.name || 'Teacher';

  const [batch, setBatch]   = useState<Batch | null>(null);
  const [posts, setPosts]   = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('feed');
  const [filterType, setFilterType] = useState('all');
  const [editingSubject, setEditingSubject] = useState(false);
  const [subjectVal, setSubjectVal] = useState('');
  const [savingSubject, setSavingSubject] = useState(false);
  const { toast } = useToast();

  const saveSubject = async () => {
    setSavingSubject(true);
    try {
      await fetch(`/api/classroom/batches/${batchId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subjectVal }),
      });
      setBatch(b => b ? { ...b, subject: subjectVal } : b);
      setEditingSubject(false);
      toast({ title: 'Subject updated' });
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
    finally { setSavingSubject(false); }
  };

  const loadBatch = async () => {
    const res  = await fetch(`/api/classroom/batches/${batchId}`);
    const data = await res.json();
    setBatch(data);
  };

  const loadPosts = async () => {
    const res  = await fetch(`/api/classroom/posts?batchId=${batchId}${filterType !== 'all' ? `&type=${filterType}` : ''}`);
    const data = await res.json();
    setPosts(Array.isArray(data) ? data : []);
  };

  const load = async () => {
    setLoading(true);
    await Promise.all([loadBatch(), loadPosts()]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [batchId]);
  useEffect(() => { loadPosts(); }, [filterType]);

  const deletePost = async (id: string) => {
    if (!confirm('Delete this post?')) return;
    await fetch(`/api/classroom/posts/${id}`, { method: 'DELETE' });
    setPosts(p => p.filter(x => x._id !== id));
  };

  const togglePin = async (post: Post) => {
    await fetch(`/api/classroom/posts/${post._id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPinned: !post.isPinned }),
    });
    loadPosts();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>;
  if (!batch)  return <p className="text-center py-20 text-slate-400">Batch not found.</p>;

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl mt-0.5 flex-shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-900 truncate">{batch.name}</h1>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <Badge variant="outline" className="text-[10px]">{batch.program}</Badge>
            <Badge variant="outline" className="text-[10px]">Year {batch.year}</Badge>
            {batch.section && <Badge variant="outline" className="text-[10px]">Section {batch.section}</Badge>}
            {batch.subject && <Badge variant="outline" className="text-[10px]">{batch.subject}</Badge>}
            <Badge className="text-[10px] bg-emerald-100 text-emerald-700">{batch.studentCount} students</Badge>
            <button
              onClick={() => { setSubjectVal(batch.subject || ''); setEditingSubject(true); }}
              className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-emerald-600 border border-dashed border-slate-200 hover:border-emerald-300 rounded-full px-2 py-0.5 transition-colors"
            >
              <Pencil className="h-3 w-3" /> {batch.subject ? 'Edit subject' : 'Add subject'}
            </button>
          </div>
        </div>
      </div>

      {/* Edit subject dialog */}
      <Dialog open={editingSubject} onOpenChange={setEditingSubject}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{batch.subject ? 'Edit Subject' : 'Add Subject'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input placeholder="e.g. Data Structures" value={subjectVal} onChange={e => setSubjectVal(e.target.value)} className="rounded-xl" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingSubject(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={saveSubject} disabled={savingSubject} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
              {savingSubject ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-slate-100 rounded-xl w-full sm:w-auto">
          <TabsTrigger value="feed"     className="rounded-lg flex-1 sm:flex-none gap-1.5"><Megaphone className="h-3.5 w-3.5" /> Feed</TabsTrigger>
          <TabsTrigger value="students" className="rounded-lg flex-1 sm:flex-none gap-1.5"><Users className="h-3.5 w-3.5" /> Students</TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="space-y-4 mt-4">
          <PostComposer batchId={batchId} teacherId={teacherId} teacherName={teacherName} onPosted={loadPosts} />

          {/* Filter pills */}
          <div className="flex gap-2 flex-wrap">
            {['all', 'announcement', 'material', 'assignment', 'poll'].map(f => (
              <button key={f} onClick={() => setFilterType(f)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all capitalize
                  ${filterType === f ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                {f === 'all' ? 'All Posts' : TYPE_META[f as keyof typeof TYPE_META]?.label}
              </button>
            ))}
          </div>

          {posts.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No posts yet. Use the composer above to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map(post => (
                <PostCard key={post._id} post={post}
                  teacherId={teacherId} teacherName={teacherName} batchId={batchId}
                  onDelete={() => deletePost(post._id)}
                  onPin={() => togglePin(post)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="students" className="mt-4">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="pt-5 pb-5">
              <StudentsPanel batch={batch} onRefresh={loadBatch} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
