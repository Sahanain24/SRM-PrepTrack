'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/mock-db';
import { generateSessionSummaryFlow } from '@/ai/flows/generate-session-summary-flow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Video, Save, Sparkles, Loader2, Plus, Trash2,
  CheckCircle2, Circle, Download, RefreshCw, Star, ClipboardList,
  MessageSquare, Lightbulb, Target,
} from 'lucide-react';

interface ActionItem { _id: string; text: string; dueDate?: string; status: 'pending'|'completed'; completedAt?: string }
interface Session {
  _id: string; studentId: string; studentName: string; rollNumber: string; program: string; year: number; section: string;
  teacherId: string; teacherName: string;
  scheduledAt: string; durationMins: number; topic: string; status: string;
  goalForm?: { goals: string; questions: string; mood: number };
  notes: string;
  assessment?: { communication?: number; confidence?: number; technicalClarity?: number; problemSolving?: number; overall?: number; strengths?: string; areasToImprove?: string; remarks?: string };
  actionItems: ActionItem[];
  aiSummary: string; recordingUrl?: string;
  studentReflection?: { sessionRating: number; helpfulness: number; notes: string; submittedAt: string };
}

const CRITERIA = [
  { key: 'communication',    label: 'Communication' },
  { key: 'confidence',       label: 'Confidence' },
  { key: 'technicalClarity', label: 'Technical Clarity' },
  { key: 'problemSolving',   label: 'Problem Solving' },
  { key: 'overall',          label: 'Overall' },
] as const;

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(i => (
        <button key={i} type="button" onClick={() => onChange?.(i)} disabled={!onChange}
          className={`transition-colors ${i <= (value || 0) ? 'text-amber-400' : 'text-slate-200'} ${onChange ? 'hover:text-amber-300' : 'cursor-default'}`}>
          <Star className="h-5 w-5 fill-current" />
        </button>
      ))}
    </div>
  );
}

function fmtDt(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

export default function TeacherSessionDetail({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router         = useRouter();
  const { toast }      = useToast();
  const user           = getCurrentUser() as any;
  const teacherName    = user?.name || 'Teacher';

  const [session, setSession]   = useState<Session | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [genSummary, setGenSummary] = useState(false);
  const [fetchRec, setFetchRec] = useState(false);

  // Editable state
  const [notes, setNotes]             = useState('');
  const [assessment, setAssessment]   = useState<Record<string, any>>({});
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [newItemDue, setNewItemDue]   = useState('');

  const load = async () => {
    setLoading(true);
    const res  = await fetch(`/api/mentor/sessions/${sessionId}`);
    const data = await res.json();
    setSession(data);
    setNotes(data.notes || '');
    setAssessment(data.assessment || {});
    setActionItems(data.actionItems || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [sessionId]);

  const saveNotes = async () => {
    setSaving(true);
    await fetch(`/api/mentor/sessions/${sessionId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, assessment, actionItems }),
    });
    toast({ title: 'Saved' });
    setSaving(false);
  };

  const addActionItem = () => {
    if (!newItemText.trim()) return;
    setActionItems(prev => [...prev, { _id: Date.now().toString(), text: newItemText, dueDate: newItemDue || undefined, status: 'pending' }]);
    setNewItemText(''); setNewItemDue('');
  };

  const removeActionItem = (id: string) => setActionItems(prev => prev.filter(i => i._id !== id));

  const generateSummary = async () => {
    if (!session) return;
    if (!notes.trim()) { toast({ title: 'Add notes first', variant: 'destructive' }); return; }
    setGenSummary(true);
    try {
      const output = await generateSessionSummaryFlow({
        studentName:  session.studentName,
        teacherName,
        topic:        session.topic,
        scheduledAt:  session.scheduledAt,
        durationMins: session.durationMins,
        goalForm:     session.goalForm,
        notes,
        assessment,
        actionItems:  actionItems.map(i => ({ text: i.text, dueDate: i.dueDate })),
      });

      const summaryText = [
        `**${output.headline}**\n`,
        `**Key Topics Discussed:**\n${output.keyDiscussed.map(k => `• ${k}`).join('\n')}`,
        `\n**Strengths:**\n${output.strengths.map(s => `• ${s}`).join('\n')}`,
        `\n**Areas for Improvement:**\n${output.improvements.map(i => `• ${i}`).join('\n')}`,
        `\n**Mentor Insight:**\n${output.teacherInsight}`,
        `\n**Recommended Next Steps:**\n${output.recommendedSteps.map(s => `• ${s}`).join('\n')}`,
      ].join('\n');

      await fetch(`/api/mentor/sessions/${sessionId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiSummary: summaryText, notes, assessment, actionItems }),
      });
      toast({ title: 'AI summary generated!' });
      load();
    } catch (e: any) {
      toast({ title: 'Summary failed', description: e.message, variant: 'destructive' });
    } finally { setGenSummary(false); }
  };

  const fetchRecording = async () => {
    setFetchRec(true);
    const res  = await fetch(`/api/mentor/sessions/${sessionId}/recording`);
    const data = await res.json();
    if (data.recordingUrl) {
      toast({ title: 'Recording ready' });
      load();
    } else {
      toast({ title: 'Recording not ready yet', description: 'Daily.co may still be processing. Try again in a few minutes.' });
    }
    setFetchRec(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-violet-500" /></div>;
  if (!session) return <p className="text-center py-20 text-slate-400">Session not found.</p>;

  const isCompleted = session.status === 'completed';

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl mt-0.5 flex-shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900">{session.studentName}</h1>
            <Badge variant="outline">{session.rollNumber}</Badge>
            <Badge variant="outline">
              {session.program} Y{session.year}{session.section ? ` §${session.section}` : ''}
            </Badge>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize
              ${session.status === 'completed' ? 'bg-slate-100 text-slate-600' : session.status === 'approved' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
              {session.status}
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-0.5">{fmtDt(session.scheduledAt)} · {session.durationMins} min{session.topic ? ` · ${session.topic}` : ''}</p>
        </div>
        {session.status === 'approved' && (
          <Button onClick={() => router.push(`/dashboard/mentor/call/${session._id}`)}
            className="gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 flex-shrink-0">
            <Video className="h-4 w-4" /> Join Call
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — notes + assessment */}
        <div className="lg:col-span-2 space-y-5">

          {/* Student goal form */}
          {session.goalForm?.goals || session.goalForm?.questions ? (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2 pt-5">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Target className="h-4 w-4 text-indigo-500" /> Student Pre-session Form
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-5 space-y-2 text-sm text-slate-600">
                {session.goalForm.goals     && <div><span className="font-semibold text-slate-500">Goals: </span>{session.goalForm.goals}</div>}
                {session.goalForm.questions && <div><span className="font-semibold text-slate-500">Questions: </span>{session.goalForm.questions}</div>}
                {session.goalForm.mood      && <div className="flex items-center gap-2"><span className="font-semibold text-slate-500">Confidence: </span><StarRating value={session.goalForm.mood} /></div>}
              </CardContent>
            </Card>
          ) : null}

          {/* Notes */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-500" /> Session Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-5">
              <textarea
                rows={8}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Type your notes here during or after the session…"
                className="w-full rounded-xl border border-slate-200 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 bg-slate-50"
              />
            </CardContent>
          </Card>

          {/* Assessment */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-orange-500" /> Mentor Assessment
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {CRITERIA.map(c => (
                  <div key={c.key} className="space-y-1">
                    <Label className="text-xs text-slate-500">{c.label}</Label>
                    <StarRating value={assessment[c.key] || 0} onChange={v => setAssessment(a => ({ ...a, [c.key]: v }))} />
                  </div>
                ))}
              </div>
              <div className="space-y-3 pt-2">
                <div>
                  <Label className="text-xs text-slate-500">Strengths Observed</Label>
                  <textarea rows={2} value={assessment.strengths || ''} onChange={e => setAssessment(a => ({ ...a, strengths: e.target.value }))}
                    placeholder="What the student did well…"
                    className="w-full mt-1 rounded-xl border border-slate-200 p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Areas to Improve</Label>
                  <textarea rows={2} value={assessment.areasToImprove || ''} onChange={e => setAssessment(a => ({ ...a, areasToImprove: e.target.value }))}
                    placeholder="Where the student needs to grow…"
                    className="w-full mt-1 rounded-xl border border-slate-200 p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Additional Remarks</Label>
                  <textarea rows={2} value={assessment.remarks || ''} onChange={e => setAssessment(a => ({ ...a, remarks: e.target.value }))}
                    placeholder="Any other observations…"
                    className="w-full mt-1 rounded-xl border border-slate-200 p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save row */}
          <div className="flex gap-3">
            <Button onClick={saveNotes} disabled={saving} className="gap-2 rounded-xl bg-violet-600 hover:bg-violet-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Notes & Assessment
            </Button>
            <Button onClick={generateSummary} disabled={genSummary} variant="outline" className="gap-2 rounded-xl border-violet-200 text-violet-700 hover:bg-violet-50">
              {genSummary ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate AI Summary
            </Button>
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-5">

          {/* Action items */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" /> Action Items
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-5 space-y-3">
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {actionItems.length === 0 && <p className="text-xs text-slate-400">No action items yet.</p>}
                {actionItems.map(item => (
                  <div key={item._id} className="flex items-start gap-2 group">
                    {item.status === 'completed'
                      ? <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      : <Circle className="h-4 w-4 text-slate-300 mt-0.5 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${item.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.text}</p>
                      {item.dueDate && <p className="text-[10px] text-slate-400">Due: {new Intl.DateTimeFormat('en-GB').format(new Date(item.dueDate))}</p>}
                    </div>
                    <button onClick={() => removeActionItem(item._id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all flex-shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <Input placeholder="New action item…" value={newItemText} onChange={e => setNewItemText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addActionItem()} className="rounded-xl text-sm h-8" />
                <div className="flex gap-2">
                  <Input type="date" value={newItemDue} onChange={e => setNewItemDue(e.target.value)} className="rounded-xl text-xs h-8 flex-1" />
                  <Button size="sm" onClick={addActionItem} className="rounded-xl h-8 gap-1 bg-green-600 hover:bg-green-700 text-white">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recording */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Video className="h-4 w-4 text-violet-500" /> Recording
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-5 space-y-3">
              {session.recordingUrl ? (
                <a href={session.recordingUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-violet-600 hover:underline">
                  <Download className="h-4 w-4" /> Download Recording
                </a>
              ) : (
                <p className="text-xs text-slate-400">Recording not available yet.</p>
              )}
              <Button size="sm" variant="outline" onClick={fetchRecording} disabled={fetchRec} className="gap-1.5 rounded-xl h-8 text-xs w-full">
                {fetchRec ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Fetch from Daily.co
              </Button>
            </CardContent>
          </Card>

          {/* AI Summary */}
          {session.aiSummary && (
            <Card className="border-violet-200 bg-violet-50/30 shadow-sm">
              <CardHeader className="pb-2 pt-5">
                <CardTitle className="text-sm font-semibold text-violet-700 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" /> AI Session Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-5">
                <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{session.aiSummary}</pre>
              </CardContent>
            </Card>
          )}

          {/* Student reflection */}
          {session.studentReflection?.submittedAt && (
            <Card className="border-green-200 bg-green-50/30 shadow-sm">
              <CardHeader className="pb-2 pt-5">
                <CardTitle className="text-sm font-semibold text-green-700 flex items-center gap-2">
                  <Star className="h-4 w-4" /> Student Reflection
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-5 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Session Rating:</span>
                  <StarRating value={session.studentReflection.sessionRating} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Helpfulness:</span>
                  <StarRating value={session.studentReflection.helpfulness} />
                </div>
                {session.studentReflection.notes && (
                  <p className="text-slate-600 italic text-xs">"{session.studentReflection.notes}"</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
