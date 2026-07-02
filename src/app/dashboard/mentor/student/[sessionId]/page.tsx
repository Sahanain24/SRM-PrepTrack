'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/mock-db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Video, Loader2, CheckCircle2, Circle, Star,
  Lightbulb, ClipboardList, Target,
} from 'lucide-react';

interface ActionItem { _id: string; text: string; dueDate?: string; status: 'pending'|'completed' }
interface Session {
  _id: string; teacherName: string; scheduledAt: string; durationMins: number; topic: string; status: string;
  goalForm?: { goals: string; questions: string; mood: number };
  notes?: string;
  assessment?: { communication?: number; confidence?: number; technicalClarity?: number; problemSolving?: number; overall?: number; strengths?: string; areasToImprove?: string; remarks?: string };
  actionItems: ActionItem[];
  aiSummary?: string;
  studentReflection?: { sessionRating?: number; helpfulness?: number; notes?: string; submittedAt?: string };
}

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

export default function StudentSessionDetail({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router         = useRouter();
  const { toast }      = useToast();
  const user           = getCurrentUser() as any;
  const userId         = user?._id || user?.id;

  const [session, setSession]   = useState<Session | null>(null);
  const [loading, setLoading]   = useState(true);

  // Pre-session form
  const [goals, setGoals]         = useState('');
  const [questions, setQuestions] = useState('');
  const [mood, setMood]           = useState(3);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalSaved, setGoalSaved] = useState(false);

  // Self-reflection
  const [sessionRating, setSessionRating] = useState(0);
  const [helpfulness, setHelpfulness]     = useState(0);
  const [refNotes, setRefNotes]           = useState('');
  const [savingRef, setSavingRef]         = useState(false);

  // Action item toggle
  const [toggling, setToggling] = useState<string|null>(null);

  const load = async () => {
    setLoading(true);
    const res  = await fetch(`/api/mentor/sessions/${sessionId}`);
    const data = await res.json();
    setSession(data);
    if (data.goalForm) {
      setGoals(data.goalForm.goals || '');
      setQuestions(data.goalForm.questions || '');
      setMood(data.goalForm.mood || 3);
      if (data.goalForm.goals) setGoalSaved(true);
    }
    if (data.studentReflection) {
      setSessionRating(data.studentReflection.sessionRating || 0);
      setHelpfulness(data.studentReflection.helpfulness || 0);
      setRefNotes(data.studentReflection.notes || '');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [sessionId]);

  const saveGoalForm = async () => {
    setSavingGoal(true);
    await fetch(`/api/mentor/sessions/${sessionId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalForm: { goals, questions, mood } }),
    });
    toast({ title: 'Pre-session form saved' });
    setGoalSaved(true);
    setSavingGoal(false);
  };

  const saveReflection = async () => {
    if (!sessionRating || !helpfulness) { toast({ title: 'Please rate the session', variant: 'destructive' }); return; }
    setSavingRef(true);
    await fetch(`/api/mentor/sessions/${sessionId}/reflection`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionRating, helpfulness, notes: refNotes }),
    });
    toast({ title: 'Reflection submitted! Thank you.' });
    setSavingRef(false);
    load();
  };

  const toggleItem = async (item: ActionItem) => {
    setToggling(item._id);
    const newStatus = item.status === 'completed' ? 'pending' : 'completed';
    await fetch(`/api/mentor/sessions/${sessionId}/action-items/${item._id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    load();
    setToggling(null);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-violet-500" /></div>;
  if (!session) return <p className="text-center py-20 text-slate-400">Session not found.</p>;

  const isApproved  = session.status === 'approved';
  const isCompleted = session.status === 'completed';
  const hasReflection = !!session.studentReflection?.submittedAt;

  return (
    <div className="space-y-6 pb-12 max-w-3xl">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl mt-0.5">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900">Session with {session.teacherName}</h1>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize
              ${session.status === 'completed' ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-700'}`}>
              {session.status}
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-0.5">{fmtDt(session.scheduledAt)} · {session.durationMins} min{session.topic ? ` · ${session.topic}` : ''}</p>
        </div>
        {isApproved && (
          <Button onClick={() => router.push(`/dashboard/mentor/call/${session._id}`)}
            className="gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 flex-shrink-0">
            <Video className="h-4 w-4" /> Join Call
          </Button>
        )}
      </div>

      {/* Pre-session form (show when approved, not yet completed) */}
      {(isApproved || goalSaved) && (
        <Card className="border-indigo-200 bg-indigo-50/30 shadow-sm">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-sm font-semibold text-indigo-700 flex items-center gap-2">
              <Target className="h-4 w-4" /> Pre-session Form
              {goalSaved && <Badge className="text-[10px] bg-indigo-100 text-indigo-700 border-none">Saved</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">What do you want to achieve in this session?</Label>
              <textarea rows={2} value={goals} onChange={e => setGoals(e.target.value)}
                disabled={isCompleted}
                className="w-full rounded-xl border border-indigo-200 p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Specific questions for your teacher</Label>
              <textarea rows={2} value={questions} onChange={e => setQuestions(e.target.value)}
                disabled={isCompleted}
                className="w-full rounded-xl border border-indigo-200 p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">How confident are you going into this session?</Label>
              <StarRating value={mood} onChange={isCompleted ? undefined : setMood} />
            </div>
            {!isCompleted && (
              <Button size="sm" onClick={saveGoalForm} disabled={savingGoal} className="rounded-xl gap-1.5 bg-indigo-600 hover:bg-indigo-700">
                {savingGoal && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save Form
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action items from teacher */}
      {session.actionItems?.length > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-green-500" /> Action Items from Your Mentor
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-5 space-y-2">
            {session.actionItems.map(item => (
              <div key={item._id} className="flex items-start gap-3 group">
                <button onClick={() => toggleItem(item)} disabled={toggling === item._id} className="mt-0.5 flex-shrink-0">
                  {toggling === item._id
                    ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    : item.status === 'completed'
                      ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                      : <Circle className="h-4 w-4 text-slate-300 hover:text-green-400 transition-colors" />}
                </button>
                <div>
                  <p className={`text-sm ${item.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.text}</p>
                  {item.dueDate && <p className="text-[10px] text-slate-400">Due: {new Intl.DateTimeFormat('en-GB').format(new Date(item.dueDate))}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Teacher assessment (read-only for student) */}
      {isCompleted && session.assessment?.overall && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" /> Mentor Assessment
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-5 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { key: 'communication',    label: 'Communication' },
                { key: 'confidence',       label: 'Confidence' },
                { key: 'technicalClarity', label: 'Technical Clarity' },
                { key: 'problemSolving',   label: 'Problem Solving' },
                { key: 'overall',          label: 'Overall' },
              ].map(c => (
                (session.assessment as any)[c.key] ? (
                  <div key={c.key} className="space-y-1">
                    <p className="text-xs text-slate-500">{c.label}</p>
                    <StarRating value={(session.assessment as any)[c.key]} />
                  </div>
                ) : null
              ))}
            </div>
            {session.assessment.strengths      && <p className="text-sm text-green-700 bg-green-50 rounded-lg p-2.5"><span className="font-semibold">Strengths: </span>{session.assessment.strengths}</p>}
            {session.assessment.areasToImprove && <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-2.5"><span className="font-semibold">Areas to Improve: </span>{session.assessment.areasToImprove}</p>}
            {session.assessment.remarks        && <p className="text-sm text-slate-600 italic">"{session.assessment.remarks}"</p>}
          </CardContent>
        </Card>
      )}

      {/* AI Summary */}
      {session.aiSummary && (
        <Card className="border-violet-200 bg-violet-50/30 shadow-sm">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-sm font-semibold text-violet-700 flex items-center gap-2">
              <Lightbulb className="h-4 w-4" /> Session Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{session.aiSummary}</pre>
          </CardContent>
        </Card>
      )}

      {/* Student self-reflection */}
      {isCompleted && (
        <Card className={`shadow-sm ${hasReflection ? 'border-green-200 bg-green-50/20' : 'border-slate-200'}`}>
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Star className="h-4 w-4 text-green-500" />
              {hasReflection ? 'Your Reflection (Submitted)' : 'Self-reflection (Please fill after the session)'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">How would you rate this session overall?</Label>
              <StarRating value={sessionRating} onChange={hasReflection ? undefined : setSessionRating} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">How helpful was this session?</Label>
              <StarRating value={helpfulness} onChange={hasReflection ? undefined : setHelpfulness} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Your notes / thoughts</Label>
              <textarea rows={3} value={refNotes} onChange={e => setRefNotes(e.target.value)}
                disabled={hasReflection}
                placeholder="What did you learn? What would you do differently?"
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            {!hasReflection && (
              <Button onClick={saveReflection} disabled={savingRef} className="rounded-xl gap-1.5 bg-green-600 hover:bg-green-700">
                {savingRef && <Loader2 className="h-4 w-4 animate-spin" />} Submit Reflection
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
