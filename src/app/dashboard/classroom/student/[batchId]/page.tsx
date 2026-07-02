'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/mock-db';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Megaphone, BookOpen, ClipboardList, BarChart2,
  Send, Loader2, MessageSquare, ChevronDown, ChevronUp,
  FileText, ExternalLink, Paperclip, X, CheckCircle2, Clock,
} from 'lucide-react';

// ── Types (same as teacher page, re-declared for isolation) ────────────────────
interface Attachment  { name: string; url: string; mimeType: string; size: number }
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
interface Comment     { _id: string; userId: string; userName: string; role: string; content: string; createdAt: string }
interface Submission  { _id: string; content: string; attachments: Attachment[]; submittedAt: string; grade?: number; feedback?: string; status: string }
interface Batch       { _id: string; name: string; program: string; year: number; section: string; subject: string }

// ── Helpers ────────────────────────────────────────────────────────────────────
const TYPE_META = {
  announcement: { label: 'Announcement', icon: Megaphone,    color: 'bg-blue-500',   light: 'bg-blue-50 text-blue-700 border-blue-200'     },
  material:     { label: 'Material',     icon: BookOpen,      color: 'bg-purple-500', light: 'bg-purple-50 text-purple-700 border-purple-200' },
  assignment:   { label: 'Assignment',   icon: ClipboardList, color: 'bg-orange-500', light: 'bg-orange-50 text-orange-700 border-orange-200' },
  poll:         { label: 'Poll',         icon: BarChart2,     color: 'bg-pink-500',   light: 'bg-pink-50 text-pink-700 border-pink-200'       },
};

function fmtSize(bytes: number) {
  if (bytes < 1024)    return `${bytes} B`;
  if (bytes < 1024**2) return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1024**2).toFixed(1)} MB`;
}
function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}
function fmtDate(iso: string) {
  try { return new Intl.DateTimeFormat('en-GB').format(new Date(iso)); } catch { return '—'; }
}
function isPast(iso?: string) { return iso ? new Date(iso) < new Date() : false; }

// ── File uploader (student) ────────────────────────────────────────────────────
function FileUploader({ onUploaded }: { onUploaded: (a: Attachment) => void }) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res  = await fetch('/api/classroom/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUploaded(data);
    } catch (err: any) { alert(err.message); }
    finally { setUploading(false); if (ref.current) ref.current.value = ''; }
  };
  return (
    <label className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 cursor-pointer transition-colors">
      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
      {uploading ? 'Uploading…' : 'Attach file'}
      <input ref={ref} type="file" className="hidden" onChange={handleFile} disabled={uploading} />
    </label>
  );
}

// ── Post card (student view) ───────────────────────────────────────────────────
function PostCard({ post, userId, userName, rollNumber, batchId }: {
  post: Post; userId: string; userName: string; rollNumber: string; batchId: string;
}) {
  const { toast }  = useToast();
  const meta        = TYPE_META[post.type];
  const Icon        = meta.icon;

  const [comments, setComments]         = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText]   = useState('');
  const [posting, setPosting]           = useState(false);
  const [submission, setSubmission]     = useState<Submission | null>(null);
  const [showSubmit, setShowSubmit]     = useState(false);
  const [subContent, setSubContent]     = useState('');
  const [subAttachments, setSubAttachments] = useState<Attachment[]>([]);
  const [submitting, setSubmitting]     = useState(false);
  const [pollState, setPollState]       = useState<PollOption[]>(post.pollOptions || []);
  const [myVote, setMyVote]             = useState<string | null>(null);
  const [voting, setVoting]             = useState(false);

  // Determine my vote
  useEffect(() => {
    for (const opt of pollState) {
      if (opt.voterIds.includes(userId)) { setMyVote(opt._id); break; }
    }
  }, [pollState, userId]);

  // Load my submission for assignments
  useEffect(() => {
    if (post.type !== 'assignment') return;
    fetch(`/api/classroom/posts/${post._id}/submissions?studentId=${userId}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d) && d.length > 0) setSubmission(d[0]); });
  }, [post._id, post.type, userId]);

  const loadComments = async () => {
    const d = await fetch(`/api/classroom/posts/${post._id}/comments`).then(r => r.json());
    setComments(Array.isArray(d) ? d : []);
  };

  const postComment = async () => {
    if (!commentText.trim()) return;
    setPosting(true);
    await fetch(`/api/classroom/posts/${post._id}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, userName, role: 'student', content: commentText }),
    });
    setCommentText('');
    await loadComments();
    setPosting(false);
  };

  const castVote = async (optionId: string) => {
    if (voting || isPast(post.pollClosedAt)) return;
    setVoting(true);
    try {
      const res  = await fetch(`/api/classroom/posts/${post._id}/vote`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, optionId }),
      });
      const data = await res.json();
      if (res.ok) { setPollState(data.pollOptions); setMyVote(optionId); }
    } catch { /* silent */ }
    finally { setVoting(false); }
  };

  const submitAssignment = async () => {
    if (!subContent.trim() && subAttachments.length === 0) {
      toast({ title: 'Add some content or attach a file', variant: 'destructive' }); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/classroom/posts/${post._id}/submissions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId, studentId: userId, studentName: userName, rollNumber, content: subContent, attachments: subAttachments }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSubmission(data);
      setShowSubmit(false);
      toast({ title: 'Assignment submitted!' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  const totalVotes = pollState.reduce((s, o) => s + o.voterIds.length, 0);
  const pollClosed = isPast(post.pollClosedAt);

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
        </div>

        {/* Content */}
        {post.content && <p className="text-sm text-slate-700 whitespace-pre-wrap">{post.content}</p>}

        {/* Assignment meta + status */}
        {post.type === 'assignment' && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              {post.dueDate    && <span className={`flex items-center gap-1 ${isPast(post.dueDate) ? 'text-red-500 font-semibold' : ''}`}><Clock className="h-3 w-3" /> Due: {fmtDate(post.dueDate)}</span>}
              {post.totalMarks && <span>⭐ {post.totalMarks} marks</span>}
            </div>

            {submission ? (
              <div className={`rounded-xl border p-3 space-y-1 ${submission.status === 'graded' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`h-4 w-4 ${submission.status === 'graded' ? 'text-green-600' : 'text-blue-500'}`} />
                  <span className="text-sm font-semibold text-slate-800">
                    {submission.status === 'graded' ? `Graded: ${submission.grade}/${post.totalMarks}` : 'Submitted — awaiting grade'}
                  </span>
                </div>
                {submission.feedback && <p className="text-sm text-slate-600 italic pl-6">"{submission.feedback}"</p>}
                <button onClick={() => setShowSubmit(s => !s)} className="text-xs text-blue-600 hover:underline pl-6">
                  {showSubmit ? 'Hide' : 'Update submission'}
                </button>
              </div>
            ) : (
              <Button size="sm" onClick={() => setShowSubmit(s => !s)}
                className="gap-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white">
                <ClipboardList className="h-3.5 w-3.5" /> Submit Assignment
              </Button>
            )}

            {showSubmit && (
              <div className="space-y-3 border border-slate-200 rounded-xl p-4 bg-slate-50">
                <textarea
                  rows={4}
                  placeholder="Write your answer here…"
                  value={subContent}
                  onChange={e => setSubContent(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                />
                <div className="space-y-2">
                  <FileUploader onUploaded={a => setSubAttachments(p => [...p, a])} />
                  {subAttachments.map((a, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 w-fit">
                      <FileText className="h-3 w-3 text-slate-400" />
                      <span className="max-w-[140px] truncate">{a.name}</span>
                      <button onClick={() => setSubAttachments(p => p.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button onClick={submitAssignment} disabled={submitting} size="sm"
                  className="rounded-xl gap-1.5 bg-green-600 hover:bg-green-700 text-white">
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {submission ? 'Update' : 'Submit'}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Poll */}
        {post.type === 'poll' && pollState.length > 0 && (
          <div className="space-y-2">
            {pollClosed && <p className="text-xs text-red-500 font-medium">Poll closed</p>}
            {pollState.map(opt => {
              const pct      = totalVotes ? Math.round((opt.voterIds.length / totalVotes) * 100) : 0;
              const isMyVote = myVote === opt._id;
              return (
                <button key={opt._id} disabled={pollClosed || voting}
                  onClick={() => castVote(opt._id)}
                  className={`w-full text-left rounded-xl border p-3 transition-all ${isMyVote ? 'border-pink-400 bg-pink-50' : 'border-slate-200 bg-slate-50 hover:border-pink-300 hover:bg-pink-50/40'} ${pollClosed ? 'cursor-default' : 'cursor-pointer'}`}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className={`font-medium ${isMyVote ? 'text-pink-700' : 'text-slate-700'}`}>
                      {isMyVote && '✓ '}{opt.text}
                    </span>
                    <span className="text-slate-400 text-xs">{opt.voterIds.length} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className={`h-1.5 rounded-full transition-all ${isMyVote ? 'bg-pink-500' : 'bg-slate-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                </button>
              );
            })}
            <p className="text-xs text-slate-400">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</p>
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

        {/* Comments */}
        {post.allowComments && (
          <div>
            <button
              onClick={() => { setShowComments(s => !s); if (!showComments) loadComments(); }}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
            >
              <MessageSquare className="h-4 w-4" /> Comments
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
                  <Input placeholder="Ask a question…" value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && postComment()}
                    className="rounded-xl text-sm" />
                  <Button size="icon" onClick={postComment} disabled={posting} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 flex-shrink-0">
                    {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function StudentBatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = use(params);
  const router       = useRouter();
  const user         = getCurrentUser() as any;
  const userId       = user?._id || user?.id || '';
  const userName     = user?.name || '';
  const rollNumber   = user?.rollNumber || '';

  const [batch, setBatch]   = useState<Batch | null>(null);
  const [posts, setPosts]   = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');

  const loadPosts = async () => {
    const res  = await fetch(`/api/classroom/posts?batchId=${batchId}${filterType !== 'all' ? `&type=${filterType}` : ''}`);
    const data = await res.json();
    setPosts(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [bRes, pRes] = await Promise.all([
        fetch(`/api/classroom/batches/${batchId}`),
        fetch(`/api/classroom/posts?batchId=${batchId}`),
      ]);
      if (bRes.ok)  setBatch(await bRes.json());
      if (pRes.ok)  setPosts(await pRes.json());
      setLoading(false);
    };
    load();
  }, [batchId]);

  useEffect(() => { loadPosts(); }, [filterType]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>;

  return (
    <div className="space-y-5 pb-12">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl mt-0.5 flex-shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{batch?.name}</h1>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {batch?.program && <Badge variant="outline" className="text-[10px]">{batch.program}</Badge>}
            {batch?.year    && <Badge variant="outline" className="text-[10px]">Year {batch.year}</Badge>}
            {batch?.section && <Badge variant="outline" className="text-[10px]">Section {batch.section}</Badge>}
            {batch?.subject && <Badge variant="outline" className="text-[10px]">{batch.subject}</Badge>}
          </div>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'announcement', 'material', 'assignment', 'poll'].map(f => (
          <button key={f} onClick={() => setFilterType(f)}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all capitalize
              ${filterType === f ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
            {f === 'all' ? 'All' : TYPE_META[f as keyof typeof TYPE_META]?.label}
          </button>
        ))}
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nothing posted yet in this classroom.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <PostCard key={post._id} post={post}
              userId={userId} userName={userName} rollNumber={rollNumber} batchId={batchId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
