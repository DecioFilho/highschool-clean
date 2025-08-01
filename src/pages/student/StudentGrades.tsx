import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  BookOpen, 
  ChevronRight, 
  ChevronDown,
  Award, 
  Calendar, 
  FileText, 
  TrendingUp,
  Clock,
  User,
  Target,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

interface SubjectSummary {
  class_subject_id: string;
  subject_name: string;
  subject_code: string;
  class_name: string;
  teacher_name: string;
  grades: Array<{
    grade_type: string;
    grade_value: number;
  }>;
  average: number;
  hasAllGrades: boolean;
  isApproved: boolean | null;
  totalGrades: number;
}

export default function StudentGrades() {
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const { user, isStudent } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchSubjects = useCallback(async () => {
    if (!user?.id || !isStudent) return;

    try {
      // Fetch all subjects the student is enrolled in
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from('class_enrollments')
        .select(`
          classes (
            id,
            name,
            class_subjects (
              id,
              subjects (name, code),
              users (full_name)
            )
          )
        `)
        .eq('student_id', user.id)
        .eq('status', 'active');

      if (enrollmentError) throw enrollmentError;

      const subjectSummaries: SubjectSummary[] = [];

      for (const enrollment of enrollmentData || []) {
        const classData = enrollment.classes;
        
        // Process each class subject for this enrollment
        for (const classSubject of classData.class_subjects || []) {
          // Fetch grades for this subject
          const { data: gradesData, error: gradesError } = await supabase
            .from('grades')
            .select('grade_type, grade_value')
            .eq('student_id', user.id)
            .eq('class_subject_id', classSubject.id);

          if (gradesError) throw gradesError;

          // Calculate subject statistics
          const grades = gradesData || [];
          const { average, hasAllGrades, isApproved } = calculateSubjectStats(grades);

          subjectSummaries.push({
            class_subject_id: classSubject.id,
            subject_name: classSubject.subjects.name,
            subject_code: classSubject.subjects.code,
            class_name: classData.name,
            teacher_name: classSubject.users?.full_name || 'Professor não atribuído',
            grades: grades,
            average: average,
            hasAllGrades: hasAllGrades,
            isApproved: isApproved,
            totalGrades: grades.length
          });
        }
      }

      setSubjects(subjectSummaries);
    } catch (error) {
      console.error('Error fetching subjects:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar suas matérias',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, isStudent, toast]);

  // Calculate subject statistics
  const calculateSubjectStats = (grades: Array<{grade_type: string; grade_value: number}>) => {
    const expectedEvaluations = ['prova', 'trabalho'];
    const hasAllGrades = expectedEvaluations.every(type => 
      grades.some(grade => grade.grade_type === type)
    );

    let totalWeightedGrade = 0;
    let totalWeight = 0;

    grades.forEach(grade => {
      let weight = 1;
      switch (grade.grade_type) {
        case 'prova':
          weight = 3;
          break;
        case 'trabalho':
          weight = 7;
          break;
        default:
          weight = 1;
      }
      totalWeightedGrade += grade.grade_value * weight;
      totalWeight += weight;
    });

    const average = totalWeight > 0 ? totalWeightedGrade / totalWeight : 0;
    const isApproved = hasAllGrades ? average >= 7 : null;

    return { average, hasAllGrades, isApproved };
  };

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const getStatusColor = (isApproved: boolean | null) => {
    if (isApproved === true) return 'text-green-600';
    if (isApproved === false) return 'text-red-600';
    return 'text-gray-600';
  };

  const getStatusLabel = (isApproved: boolean | null, hasAllGrades: boolean) => {
    if (!hasAllGrades) return 'Aguardando';
    return isApproved ? 'Aprovado' : 'Reprovado';
  };

  if (!isStudent) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-6">
          <CardContent>
            <p className="text-center text-muted-foreground">
              Esta página é restrita para alunos.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Carregando suas notas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Modern Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Minhas Disciplinas</h1>
            <p className="text-sm text-gray-600">Visão geral do seu desempenho acadêmico</p>
          </div>
        </div>
        
        {/* Quick stats */}
        <div className="hidden md:flex items-center gap-6">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900">{subjects.length}</div>
            <div className="text-xs text-gray-500">Disciplinas</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">
              {subjects.filter(s => s.isApproved === true).length}
            </div>
            <div className="text-xs text-gray-500">Aprovações</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-red-600">
              {subjects.filter(s => s.isApproved === false).length}
            </div>
            <div className="text-xs text-gray-500">Reprovações</div>
          </div>
        </div>
      </div>

      {/* Performance Overview */}
      {subjects.length > 0 && (
        <Card className="bg-gradient-to-r from-gray-50 to-gray-100 border-0">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <Target className="h-6 w-6 mx-auto mb-1 text-blue-500" />
                <div className="text-xl font-bold">
                  {(subjects.reduce((sum, s) => sum + (s.average || 0), 0) / subjects.filter(s => s.average > 0).length || 0).toFixed(1)}
                </div>
                <div className="text-xs text-gray-600">Média Geral</div>
              </div>
              <div className="text-center">
                <TrendingUp className="h-6 w-6 mx-auto mb-1 text-green-500" />
                <div className="text-xl font-bold text-green-600">
                  {subjects.filter(s => s.isApproved === true).length}
                </div>
                <div className="text-xs text-gray-600">Aprovações</div>
              </div>
              <div className="text-center">
                <AlertTriangle className="h-6 w-6 mx-auto mb-1 text-red-500" />
                <div className="text-xl font-bold text-red-600">
                  {subjects.filter(s => s.isApproved === false).length}
                </div>
                <div className="text-xs text-gray-600">Reprovações</div>
              </div>
              <div className="text-center">
                <Clock className="h-6 w-6 mx-auto mb-1 text-orange-500" />
                <div className="text-xl font-bold text-orange-600">
                  {subjects.filter(s => s.isApproved === null).length}
                </div>
                <div className="text-xs text-gray-600">Pendentes</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subjects List - Compact View */}
      {subjects.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2 text-gray-900">Nenhuma disciplina encontrada</h3>
            <p className="text-gray-600">
              Você ainda não está matriculado em nenhuma disciplina.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {subjects.map((subject, index) => {
            const isOpen = expandedSubjects.has(subject.class_subject_id);
            const toggleExpanded = () => {
              const newExpanded = new Set(expandedSubjects);
              if (isOpen) {
                newExpanded.delete(subject.class_subject_id);
              } else {
                newExpanded.add(subject.class_subject_id);
              }
              setExpandedSubjects(newExpanded);
            };
            
            return (
              <Card key={subject.class_subject_id} className="border-l-4 border-l-gray-200 hover:border-l-blue-400 transition-colors">
                <Collapsible open={isOpen} onOpenChange={toggleExpanded}>
                  <CollapsibleTrigger asChild>
                    <CardContent className="p-4 cursor-pointer hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          {/* Subject Status Indicator */}
                          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                            subject.isApproved === true ? 'bg-green-500' :
                            subject.isApproved === false ? 'bg-red-500' :
                            subject.average > 0 ? 'bg-yellow-500' : 'bg-gray-400'
                          }`} />
                          
                          {/* Subject Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-gray-900 truncate">{subject.subject_name}</h3>
                              <Badge variant="outline" className="text-xs">{subject.subject_code}</Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {subject.teacher_name}
                              </span>
                              <span>{subject.class_name}</span>
                            </div>
                          </div>

                          {/* Quick Stats */}
                          <div className="hidden md:flex items-center gap-6 text-sm">
                            <div className="text-center">
                              <div className={`font-bold ${
                                subject.isApproved === true ? 'text-green-600' :
                                subject.isApproved === false ? 'text-red-600' :
                                'text-gray-600'
                              }`}>
                                {subject.hasAllGrades ? subject.average.toFixed(1) : '--'}
                              </div>
                              <div className="text-xs text-gray-500">Média</div>
                            </div>
                            
                            <div className="text-center">
                              <div className="font-bold text-gray-900">{subject.totalGrades}/2</div>
                              <div className="text-xs text-gray-500">Notas</div>
                            </div>

                            {subject.hasAllGrades && (
                              <div className="flex items-center gap-2">
                                {subject.isApproved === true ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4 text-red-600" />
                                )}
                                <span className={`text-xs font-medium ${
                                  subject.isApproved === true ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {subject.isApproved === true ? 'APROVADO' : 'REPROVADO'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          {subject.average > 0 && (
                            <div className="hidden sm:block w-20">
                              <Progress 
                                value={Math.min((subject.average / 10) * 100, 100)} 
                                className="h-2"
                              />
                            </div>
                          )}
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-4 px-4">
                      <div className="border-t pt-4 space-y-4">
                        {/* Mobile stats */}
                        <div className="grid grid-cols-2 md:hidden gap-4 text-sm">
                          <div className="text-center p-2 bg-gray-50 rounded">
                            <div className={`font-bold ${
                              subject.isApproved === true ? 'text-green-600' :
                              subject.isApproved === false ? 'text-red-600' :
                              'text-gray-600'
                            }`}>
                              {subject.hasAllGrades ? subject.average.toFixed(1) : '--'}
                            </div>
                            <div className="text-xs text-gray-500">Média</div>
                          </div>
                          <div className="text-center p-2 bg-gray-50 rounded">
                            <div className="font-bold text-gray-900">{subject.totalGrades}/2</div>
                            <div className="text-xs text-gray-500">Notas</div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 justify-start"
                            onClick={() => navigate(`/student/subject/${subject.class_subject_id}/overview`)}
                          >
                            <TrendingUp className="h-4 w-4 mr-2" />
                            Visão Geral
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 justify-start"
                            onClick={() => navigate(`/student/subject/${subject.class_subject_id}/grades`)}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Notas Detalhadas
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 justify-start"
                            onClick={() => navigate(`/student/subject/${subject.class_subject_id}/attendance`)}
                          >
                            <Calendar className="h-4 w-4 mr-2" />
                            Faltas
                          </Button>
                        </div>

                        {/* Status Message */}
                        {subject.hasAllGrades && (
                          <div className={`p-3 rounded-lg text-sm ${
                            subject.isApproved === true 
                              ? 'bg-green-50 text-green-700 border border-green-200' 
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {subject.isApproved === true ? (
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4" />
                                <span>
                                  Parabéns! Você foi <strong>aprovado</strong> com média {subject.average.toFixed(1)}.
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                <span>
                                  Você foi <strong>reprovado</strong>. Faltaram {(7 - subject.average).toFixed(1)} pontos para aprovação.
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}