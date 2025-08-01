import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, ChevronRight, Award, Calendar, FileText } from 'lucide-react';

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
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <BookOpen className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Minhas Matérias</h1>
      </div>

      {/* Summary Card */}
      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumo Acadêmico</CardTitle>
            <CardDescription>
              Use os botões "Ver Notas" e "Ver Faltas" para acessar os detalhes de cada matéria
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{subjects.length}</div>
                <div className="text-sm text-muted-foreground">Total de Matérias</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {subjects.filter(s => s.isApproved === true).length}
                </div>
                <div className="text-sm text-muted-foreground">Aprovações</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {subjects.filter(s => s.isApproved === false).length}
                </div>
                <div className="text-sm text-muted-foreground">Reprovações</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subjects List */}
      {subjects.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma matéria encontrada</h3>
            <p className="text-muted-foreground">
              Você ainda não está matriculado em nenhuma matéria.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {subjects.map((subject) => (
            <Card 
              key={subject.class_subject_id} 
              className="hover:shadow-md transition-shadow"
            >
              <CardContent className="p-6">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-semibold">{subject.subject_name}</h3>
                        <Badge variant="outline">{subject.subject_code}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">
                        <p><strong>Turma:</strong> {subject.class_name}</p>
                        <p><strong>Professor(a):</strong> {subject.teacher_name}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Notas lançadas: </span>
                          <span className="font-medium">{subject.totalGrades}/2</span>
                        </div>
                        {subject.hasAllGrades && (
                          <>
                            <div className="text-sm">
                              <span className="text-muted-foreground">Média: </span>
                              <span className={`font-bold ${subject.isApproved ? 'text-green-600' : 'text-red-600'}`}>
                                {subject.average.toFixed(1)}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className={`text-sm font-bold ${getStatusColor(subject.isApproved)}`}>
                                {getStatusLabel(subject.isApproved, subject.hasAllGrades)}
                              </div>
                              {subject.isApproved === true && (
                                <Award className="h-4 w-4 text-green-600 mx-auto mt-1" />
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => navigate(`/student/subject/${subject.class_subject_id}/grades`)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Ver Notas
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => navigate(`/student/subject/${subject.class_subject_id}/attendance`)}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Ver Faltas
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}