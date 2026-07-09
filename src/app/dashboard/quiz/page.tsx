
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, AlertCircle, RotateCcw, BrainCircuit, Loader2, Sparkles, BookOpen } from 'lucide-react';
import { getDb, saveDb, getCurrentUser, StudyLog } from '@/lib/mock-db';
import type { GenerateQuizOutput } from '@/ai/flows/generate-quiz-flow';

function QuizContent() {
  const searchParams = useSearchParams();
  const sourceId = searchParams.get('source');

  const [topic, setTopic] = useState('');
  const [selectedLogId, setSelectedLogId] = useState<string | null>(sourceId);
  const [userLogs, setUserLogs] = useState<StudyLog[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [quizData, setQuizData] = useState<GenerateQuizOutput | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const user = getCurrentUser();
        if (user) {
          const { db } = await import('@/lib/mock-db');
          const userId = user._id || user.id;
          if (userId) {
            const userLogs = await db.getStudyLogs(userId);
            setUserLogs(userLogs);
          }
        }
      } catch (error) {
        console.error('Failed to fetch study logs:', error);
      }
    };

    fetchLogs();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let input: any = { difficulty: 'medium', count: 10 };
    
    if (selectedLogId && selectedLogId !== 'none') {
      const log = userLogs.find(l => (l._id === selectedLogId || l.id === selectedLogId));
      if (log) {
        input.content = log.content;
        input.topic = log.title;
      }
    } else if (topic) {
      input.topic = topic;
    } else {
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch('/api/ai/generate-quiz', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data: GenerateQuizOutput = await res.json();
      if (!res.ok) throw new Error((data as any).error || 'Generation failed');
      setQuizData(data);
      setCurrentStep(0);
      setAnswers([]);
      setIsFinished(false);
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Failed to generate quiz. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveQuizResult = async (calculatedScore: number, quizData: GenerateQuizOutput) => {
    const user = getCurrentUser();
    if (user) {
      const { db } = await import('@/lib/mock-db');
      const userId = user._id || user.id;
      if (userId) {
        await db.createQuizResult({
          userId,
          subject: quizData.title,
          score: calculatedScore,
          total: quizData.questions.length,
          date: new Date().toISOString(),
        });
      }
    }
  };

  const handleNext = async () => {
    if (selectedOption === null || !quizData) return;

    const newAnswers = [...answers, selectedOption];
    setAnswers(newAnswers);

    if (currentStep < quizData.questions.length - 1) {
      setCurrentStep(currentStep + 1);
      setSelectedOption(null);
    } else {
      let calculatedScore = 0;
      quizData.questions.forEach((q, idx) => {
        if (q.correctIndex === newAnswers[idx]) calculatedScore++;
      });
      setScore(calculatedScore);
      setIsFinished(true);

      await saveQuizResult(calculatedScore, quizData);
    }
  };

  const resetQuiz = () => {
    setQuizData(null);
    setTopic('');
    setSelectedOption(null);
    setAnswers([]);
    setIsFinished(false);
    setScore(0);
  };

  if (isFinished && quizData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in zoom-in-95">
        <div className={`p-6 rounded-full ${score === quizData.questions.length ? 'bg-green-100' : 'bg-primary/10'}`}>
          {score === quizData.questions.length ? <CheckCircle2 className="h-16 w-16 text-green-600" /> : <AlertCircle className="h-16 w-16 text-primary" />}
        </div>
        <div className="text-center">
          <h2 className="text-4xl font-headline font-bold mb-2">Quiz Completed!</h2>
          <p className="text-xl text-muted-foreground">You scored <span className="font-bold text-primary">{score}</span> out of {quizData.questions.length}</p>
        </div>
        <Button onClick={resetQuiz} size="lg" className="px-8">
          <RotateCcw className="h-4 w-4 mr-2" />
          New Topic
        </Button>
      </div>
    );
  }

  if (!quizData) {
    return (
      <div className="max-w-2xl mx-auto space-y-8 pt-12">
        <div className="text-center space-y-4">
          <BrainCircuit className="h-16 w-16 mx-auto text-primary" />
          <h1 className="text-4xl font-headline font-bold">Personalized Quizzes</h1>
          <p className="text-muted-foreground">Test your knowledge from your study logs or any topic.</p>
        </div>
        <Card className="border-none shadow-xl">
          <form onSubmit={handleGenerate}>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-2">
                <Label>Source Material (Optional)</Label>
                <Select value={selectedLogId || 'none'} onValueChange={setSelectedLogId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a study log..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Use topic below)</SelectItem>
                    {userLogs.map(log => (
                      <SelectItem key={log._id || log.id} value={(log._id || log.id) || ''}>{log.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Selecting a log will generate questions based on its content.</p>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">OR</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="topic">Specific Topic</Label>
                <Input 
                  id="topic" 
                  placeholder="e.g. React Hooks, WW2 History, Quantum Physics" 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  disabled={isGenerating || (!!selectedLogId && selectedLogId !== 'none')}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" size="lg" disabled={isGenerating || (!topic && (selectedLogId === 'none' || !selectedLogId))}>
                {isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating Quiz...</> : 'Generate Personalized Quiz'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  const currentQuestion = quizData.questions[currentStep];
  const progress = ((currentStep + 1) / quizData.questions.length) * 100;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="space-y-4">
        <div className="flex justify-between items-center text-sm font-medium">
          <span className="text-muted-foreground">Question {currentStep + 1} of {quizData.questions.length}</span>
          <span className="text-primary">{Math.round(progress)}% Complete</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <Card className="border-none shadow-xl">
        <CardHeader>
          <CardTitle className="font-headline text-2xl leading-tight">
            {currentQuestion.question}
          </CardTitle>
          <CardDescription className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {quizData.title}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup 
            value={selectedOption?.toString()} 
            onValueChange={(val) => setSelectedOption(parseInt(val))}
            className="space-y-3"
          >
            {currentQuestion.options.map((opt, idx) => (
              <Label
                key={idx}
                className={`flex items-center space-x-3 p-4 border rounded-xl cursor-pointer transition-all hover:bg-muted/50 ${selectedOption === idx ? 'border-primary bg-primary/5' : ''}`}
              >
                <RadioGroupItem value={idx.toString()} id={`opt-${idx}`} className="sr-only" />
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedOption === idx ? 'border-primary' : 'border-muted-foreground'}`}>
                  {selectedOption === idx && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                </div>
                <span className="text-base font-medium">{opt}</span>
              </Label>
            ))}
          </RadioGroup>
        </CardContent>
        <CardFooter className="flex justify-between items-center bg-muted/30 py-4">
          <p className="text-sm text-muted-foreground">Choose one to proceed</p>
          <Button onClick={handleNext} disabled={selectedOption === null} size="lg">
            {currentStep === quizData.questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <QuizContent />
    </Suspense>
  );
}
