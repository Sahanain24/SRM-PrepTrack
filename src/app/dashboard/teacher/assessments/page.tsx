'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Search, Users, Brain, TrendingUp, BarChart2,
  ChevronRight, Star, Target, Lightbulb, RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';

interface Assessment {
  _id: string;
  studentName: string;
  rollNumber: string;
  submittedAt: string;
  employabilityScore: number;
  readinessLevel: string;
  sectionA: {
    program: string;
    yearOfStudy: number;
    cgpa: number;
    careerAspiration: string;
  };
  sectionB: Record<string, number>;
  sectionC: { preferredSector: string };
  sectionE: { trainingNeeds: string[]; trainingMode: string };
  sectionF: { skillGapOpinion: string; institutionSuggestion: string };
}

const SKILL_LABELS: Record<string, string> = {
  communicationSkills:   'Communication',
  problemSolving:        'Problem Solving',
  technicalKnowledge:    'Technical Knowledge',
  teamworkCollaboration: 'Teamwork',
  timeManagement:        'Time Management',
  leadershipSkills:      'Leadership',
  criticalThinking:      'Critical Thinking',
  emotionalIntelligence: 'Emotional Intelligence',
  industryReadiness:     'Industry Readiness',
};

function readinessColor(level: string) {
  if (level === 'Very High') return 'bg-green-100 text-green-700 border-green-200';
  if (level === 'High')      return 'bg-blue-100 text-blue-700 border-blue-200';
  if (level === 'Moderate')  return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  return 'bg-red-100 text-red-700 border-red-200';
}

function scoreColor(score: number) {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-blue-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-red-500';
}

function SkillBar({ label, value }: { label: string; value: number }) {
  const pct = ((value - 1) / 4) * 100;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold text-slate-800">{value}/5</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [selected,    setSelected]    = useState<Assessment | null>(null);
  const [filterLevel, setFilterLevel] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/self-assessment');
      const data = await res.json();
      setAssessments(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = assessments.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = (
      a.studentName?.toLowerCase().includes(q) ||
      a.rollNumber?.toLowerCase().includes(q) ||
      a.sectionA?.program?.toLowerCase().includes(q)
    );
    const matchLevel = filterLevel ? a.readinessLevel === filterLevel : true;
    return matchSearch && matchLevel;
  });

  // Aggregate stats
  const avgScore  = assessments.length
    ? Math.round(assessments.reduce((s, a) => s + (a.employabilityScore || 0), 0) / assessments.length)
    : 0;
  const levelCounts = assessments.reduce((acc, a) => {
    acc[a.readinessLevel] = (acc[a.readinessLevel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Top skill gaps (lowest average skill across all assessments)
  const skillAvgs = Object.keys(SKILL_LABELS).map(key => {
    const vals = assessments.map(a => a.sectionB?.[key]).filter(Boolean) as number[];
    return { key, label: SKILL_LABELS[key], avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0 };
  }).sort((a, b) => a.avg - b.avg);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-slate-900">Self-Assessment Results</h1>
          <p className="text-slate-500 mt-1">View student employability profiles and skill gap analysis.</p>
        </div>
        <Button variant="outline" onClick={load} className="rounded-xl gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Submitted',  value: assessments.length, icon: Users,     color: 'text-blue-600   bg-blue-50' },
          { label: 'Avg Employability',value: `${avgScore}%`,     icon: TrendingUp, color: 'text-indigo-600 bg-indigo-50' },
          { label: 'High Readiness',   value: (levelCounts['High'] || 0) + (levelCounts['Very High'] || 0), icon: Star, color: 'text-green-600 bg-green-50' },
          { label: 'Needs Support',    value: (levelCounts['Low'] || 0) + (levelCounts['Moderate'] || 0),  icon: Target, color: 'text-orange-600 bg-orange-50' },
        ].map(s => (
          <Card key={s.label} className="border-slate-200 shadow-sm">
            <CardContent className="flex items-center gap-3 pt-5 pb-5">
              <div className={`p-3 rounded-xl ${s.color}`}><s.icon className="h-5 w-5" /></div>
              <div>
                <p className="text-xl font-bold text-slate-900">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Skill gap insight */}
      {skillAvgs[0]?.avg > 0 && (
        <Card className="border-orange-200 bg-orange-50/40 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-orange-800">Top Skill Gaps (class average)</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {skillAvgs.slice(0, 3).map(s => (
                    <span key={s.key} className="text-xs bg-white border border-orange-200 text-orange-700 px-2 py-1 rounded-full">
                      {s.label} — {s.avg.toFixed(1)}/5
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter + Table */}
      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" /> Student Profiles ({filtered.length})
          </CardTitle>
          <CardDescription>Click a row to view the full assessment breakdown.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search name, roll number, program…"
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              value={filterLevel}
              onChange={e => setFilterLevel(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white"
            >
              <option value="">All Readiness Levels</option>
              {['Very High', 'High', 'Moderate', 'Low'].map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Program / Year</TableHead>
                  <TableHead>CGPA</TableHead>
                  <TableHead>Employability</TableHead>
                  <TableHead>Readiness</TableHead>
                  <TableHead>Career Goal</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-400">Loading…</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                      No assessments submitted yet.
                    </TableCell>
                  </TableRow>
                ) : filtered.map(a => (
                  <TableRow
                    key={a._id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => setSelected(a)}
                  >
                    <TableCell>
                      <div className="font-medium text-slate-900">{a.studentName}</div>
                      <div className="text-xs text-slate-400">{a.rollNumber}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{a.sectionA?.program}</div>
                      <div className="text-xs text-slate-400">Year {a.sectionA?.yearOfStudy}</div>
                    </TableCell>
                    <TableCell className="font-semibold">{a.sectionA?.cgpa}</TableCell>
                    <TableCell>
                      <span className={`text-lg font-black ${scoreColor(a.employabilityScore)}`}>
                        {a.employabilityScore}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={readinessColor(a.readinessLevel)}>
                        {a.readinessLevel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 max-w-[140px] truncate">
                      {a.sectionA?.careerAspiration}
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">
                      {a.submittedAt ? format(new Date(a.submittedAt), 'dd/MM/yyyy') : '—'}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Detail Dialog ── */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-headline">{selected.studentName}</DialogTitle>
                <DialogDescription>
                  {selected.rollNumber} · {selected.sectionA?.program} · Year {selected.sectionA?.yearOfStudy}
                  {selected.submittedAt && ` · Submitted ${format(new Date(selected.submittedAt), 'dd/MM/yyyy')}`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 mt-2">
                {/* Score + Level */}
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="text-center">
                    <div className={`text-4xl font-black ${scoreColor(selected.employabilityScore)}`}>
                      {selected.employabilityScore}%
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">Employability Score</div>
                  </div>
                  <div className="flex-1 space-y-1">
                    <Badge variant="outline" className={`${readinessColor(selected.readinessLevel)} text-sm px-3 py-1`}>
                      {selected.readinessLevel} Readiness
                    </Badge>
                    <div className="text-xs text-slate-500">CGPA: <strong>{selected.sectionA?.cgpa}</strong></div>
                    <div className="text-xs text-slate-500">Career Goal: <strong>{selected.sectionA?.careerAspiration}</strong></div>
                  </div>
                </div>

                {/* Skills breakdown */}
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <BarChart2 className="h-4 w-4" /> Self-Rated Skills
                  </p>
                  <div className="grid grid-cols-1 gap-2.5">
                    {Object.entries(SKILL_LABELS).map(([key, label]) =>
                      selected.sectionB?.[key] != null ? (
                        <SkillBar key={key} label={label} value={selected.sectionB[key]} />
                      ) : null
                    )}
                  </div>
                </div>

                {/* Preferred sector */}
                {selected.sectionC?.preferredSector && (
                  <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-sm">
                    <span className="text-indigo-600 font-semibold">Preferred Sector: </span>
                    <span className="text-slate-700">{selected.sectionC.preferredSector}</span>
                  </div>
                )}

                {/* Training needs */}
                {selected.sectionE?.trainingNeeds?.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-slate-700 mb-2">Training Needs</p>
                    <div className="flex flex-wrap gap-2">
                      {selected.sectionE.trainingNeeds.map((t, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                    {selected.sectionE.trainingMode && (
                      <p className="text-xs text-slate-500 mt-1">Preferred mode: {selected.sectionE.trainingMode}</p>
                    )}
                  </div>
                )}

                {/* Open feedback */}
                {(selected.sectionF?.skillGapOpinion || selected.sectionF?.institutionSuggestion) && (
                  <div className="space-y-3">
                    {selected.sectionF.skillGapOpinion && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-xs font-semibold text-amber-700 mb-1">Student's view on skill gaps</p>
                        <p className="text-sm text-slate-700 italic">"{selected.sectionF.skillGapOpinion}"</p>
                      </div>
                    )}
                    {selected.sectionF.institutionSuggestion && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                        <p className="text-xs font-semibold text-blue-700 mb-1">Suggestion to institution</p>
                        <p className="text-sm text-slate-700 italic">"{selected.sectionF.institutionSuggestion}"</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
