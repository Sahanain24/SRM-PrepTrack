
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle2, XCircle, Clock, FileText, Code, Mic, MessageSquare, Eye, Calendar, User, Quote, Sparkles } from 'lucide-react';
import { getDb, getCurrentUser, QuizResult, CodingSubmission, CommunicationHistory } from '@/lib/mock-db';
import { format } from 'date-fns';

type DetailType = 'quiz' | 'coding' | 'speech' | null;

export default function StudyHistoryPage() {
  const [quizzes, setQuizzes] = useState<QuizResult[]>([]);
  const [coding, setCoding] = useState<CodingSubmission[]>([]);
  const [communication, setCommunication] = useState<CommunicationHistory[]>([]);
  
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [detailType, setDetailType] = useState<DetailType>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const user = getCurrentUser();
        if (user) {
          const { db } = await import('@/lib/mock-db');
          const userId = user._id || user.id;
          if (userId) {
            const [quizzes, coding, communication] = await Promise.all([
              db.getQuizResults(userId),
              db.getCodingSubmissions(userId),
              db.getCommunicationHistory(userId)
            ]);
            setQuizzes(quizzes.reverse());
            setCoding(coding.reverse());
            setCommunication(communication.reverse());
          }
        }
      } catch (error) {
        console.error('Failed to fetch history:', error);
      }
    };

    fetchHistory();
  }, []);

  const openDetail = (item: any, type: DetailType) => {
    setSelectedItem(item);
    setDetailType(type);
  };

  const closeDetail = () => {
    setSelectedItem(null);
    setDetailType(null);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-headline font-bold text-primary">Study History</h1>
        <p className="text-muted-foreground">View all your past academic activities and AI insights.</p>
      </div>

      <Tabs defaultValue="quizzes" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="quizzes" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Quizzes
          </TabsTrigger>
          <TabsTrigger value="coding" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            Coding
          </TabsTrigger>
          <TabsTrigger value="speech" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Speech
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quizzes" className="mt-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Quiz Results</CardTitle>
              <CardDescription>Track your scores across various subjects.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quizzes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No quiz history found.</TableCell>
                    </TableRow>
                  ) : (
                    quizzes.map((q) => (
                      <TableRow key={q._id || q.id}>
                        <TableCell className="font-medium">{q.subject}</TableCell>
                        <TableCell>{q.score} / {q.total}</TableCell>
                        <TableCell>{format(new Date(q.date), 'dd/MM/yyyy HH:mm')}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => openDetail(q, 'quiz')}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Summary
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coding" className="mt-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Coding Submissions</CardTitle>
              <CardDescription>Review your logic and algorithm practice.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Problem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coding.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No coding history found.</TableCell>
                    </TableRow>
                  ) : (
                    coding.map((c) => (
                      <TableRow key={c._id || c.id}>
                        <TableCell className="font-medium">{c.problemId}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {c.result === 'passed' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                            <span className="capitalize">{c.result}</span>
                          </div>
                        </TableCell>
                        <TableCell>{format(new Date(c.date), 'dd/MM/yyyy HH:mm')}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => openDetail(c, 'coding')}>
                            <Code className="h-4 w-4 mr-2" />
                            View Code
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="speech" className="mt-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Speech Practice Sessions</CardTitle>
              <CardDescription>AI transcription and sentiment analysis.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {communication.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No speech history found.</div>
                ) : (
                  communication.map((m) => (
                    <div key={m._id || m.id} className="p-4 border rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer group" onClick={() => openDetail(m, 'speech')}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={m.sentiment === 'positive' ? 'default' : 'secondary'}>{m.sentiment.toUpperCase()}</Badge>
                          <span className="text-xs text-muted-foreground">{format(new Date(m.date), 'dd/MM/yyyy HH:mm')}</span>
                        </div>
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          View Analysis
                        </Button>
                      </div>
                      <p className="text-sm italic text-muted-foreground line-clamp-2">"{m.transcription}"</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedItem} onOpenChange={closeDetail}>
        <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
          {detailType === 'quiz' && selectedItem && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5">
                    <FileText className="h-3 w-3 mr-1" /> Quiz Result
                  </Badge>
                </div>
                <DialogTitle className="text-2xl font-headline">{selectedItem.subject}</DialogTitle>
                <DialogDescription>
                  Taken on {format(new Date(selectedItem.date), 'dd/MM/yyyy HH:mm')}
                </DialogDescription>
              </DialogHeader>
              <div className="py-6 flex flex-col items-center justify-center space-y-4">
                <div className="relative h-32 w-32 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-muted"></div>
                  <div 
                    className="absolute inset-0 rounded-full border-4 border-primary" 
                    style={{ 
                      clipPath: `polygon(50% 50%, -50% -50%, ${selectedItem.score / selectedItem.total * 100}% -50%)`,
                      transform: 'rotate(-90deg)'
                    }}
                  ></div>
                  <div className="text-center">
                    <span className="text-4xl font-bold text-primary">{selectedItem.score}</span>
                    <span className="text-xl text-muted-foreground">/{selectedItem.total}</span>
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold">
                    {Math.round((selectedItem.score / selectedItem.total) * 100)}% Accuracy
                  </h3>
                  <p className="text-muted-foreground max-w-sm">
                    {selectedItem.score / selectedItem.total >= 0.8 ? "Excellent performance! You've mastered this topic." : "Good effort. Review your study logs to strengthen these areas."}
                  </p>
                </div>
              </div>
            </>
          )}

          {detailType === 'coding' && selectedItem && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={selectedItem.result === 'passed' ? 'default' : 'destructive'} className="flex items-center gap-1">
                    {selectedItem.result === 'passed' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {selectedItem.result.toUpperCase()}
                  </Badge>
                </div>
                <DialogTitle className="text-2xl font-headline">{selectedItem.problemId}</DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  Submitted on {format(new Date(selectedItem.date), 'dd/MM/yyyy HH:mm')}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4">
                <h4 className="text-sm font-bold mb-2 flex items-center gap-2">
                  <Code className="h-4 w-4 text-primary" />
                  Submitted Solution
                </h4>
                <div className="p-4 bg-zinc-900 text-zinc-100 rounded-lg font-code text-sm overflow-x-auto whitespace-pre">
                  {selectedItem.code}
                </div>
              </div>
            </>
          )}

          {detailType === 'speech' && selectedItem && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={selectedItem.sentiment === 'positive' ? 'default' : 'secondary'}>
                    {selectedItem.sentiment.toUpperCase()} SENTIMENT
                  </Badge>
                </div>
                <DialogTitle className="text-2xl font-headline">Speech Analysis Report</DialogTitle>
                <DialogDescription>
                  Session recorded on {format(new Date(selectedItem.date), 'dd/MM/yyyy HH:mm')}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 space-y-6">
                <div className="space-y-2 p-4 bg-muted/50 rounded-lg border italic">
                  <div className="flex items-center gap-2 mb-1">
                    <Quote className="h-4 w-4 text-primary opacity-40" />
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Transcription</span>
                  </div>
                  <p className="text-sm text-foreground">"{selectedItem.transcription}"</p>
                </div>

                <div className="p-5 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h4 className="font-bold text-primary">AI Coach Feedback</h4>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {selectedItem.overallFeedback}
                  </p>
                </div>
              </div>
            </>
          )}

          <DialogFooter className="mt-6">
            <Button onClick={closeDetail} className="w-full sm:w-auto">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
