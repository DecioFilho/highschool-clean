import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, BookOpen, Award, AlertCircle } from 'lucide-react';

interface Grade {
  id: string;
  grade_value: number;
  grade_type: string;
  evaluation_date: string;
}

interface SubjectInfo {
  id: string;
  name: string;
  code: string;
  class_name: string;
  teacher_name: string;
}

interface EvaluationRow {
  type: 'prova' | 'trabalho';
  label: string;
  weight: number;
  grade?: number;
  date?: string;
  status: 'lançada' | 'pendente';
}

export default function SubjectGrades() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { user, isStudent } = useAuth();
  const { toast } = useToast();
  
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjectInfo, setSubjectInfo] = useState<SubjectInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubjectGrades = useCallback(async () => {
    if (!user?.id || !isStudent || !subjectId) return;

    try {
      // Fetch subject info
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

      let targetSubject = null;
      for (const enrollment of enrollmentData || []) {
        const classData = enrollment.classes;
        const foundSubject = classData.class_subjects?.find(cs => cs.id === subjectId);
        if (foundSubject) {
          targetSubject = {
            class_subjects: foundSubject,
            classes: { name: classData.name }
          };
          break;
        }
      }

      if (!targetSubject) {
        toast({
          title: 'Erro',
          description: 'Matéria não encontrada ou você não está matriculado nela.',
          variant: 'destructive',
        });
        navigate('/student/grades');
        return;
      }

      setSubjectInfo({
        id: targetSubject.class_subjects.id,
        name: targetSubject.class_subjects.subjects.name,
        code: targetSubject.class_subjects.subjects.code,
        class_name: targetSubject.classes.name,
        teacher_name: targetSubject.class_subjects.users?.full_name || 'Professor não atribuído'
      });

      // Fetch grades for this specific subject
      const { data: gradesData, error: gradesError } = await supabase
        .from('grades')
        .select('*')
        .eq('student_id', user.id)
        .eq('class_subject_id', subjectId)
        .order('evaluation_date', { ascending: true });

      if (gradesError) throw gradesError;

      setGrades(gradesData || []);
    } catch (error) {
      console.error('Error fetching subject grades:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar notas da matéria',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, isStudent, subjectId, toast, navigate]);

  useEffect(() => {
    fetchSubjectGrades();
  }, [fetchSubjectGrades]);

  // Create evaluation rows (expected evaluations)
  const evaluationRows: EvaluationRow[] = [
    {
      type: 'prova',
      label: 'Avaliação 1',
      weight: 3,
      status: 'pendente'
    },
    {
      type: 'trabalho', 
      label: 'Avaliação 2',
      weight: 7,
      status: 'pendente'
    }
  ];

  // Fill in actual grades
  grades.forEach(grade => {
    const row = evaluationRows.find(r => r.type === grade.grade_type);
    if (row) {
      row.grade = grade.grade_value;
      row.date = grade.evaluation_date;
      row.status = 'lançada';
    }
  });

  // Calculate final average
  const calculateFinalAverage = () => {
    let totalWeightedGrade = 0;
    let totalWeight = 0;
    let hasAllGrades = true;

    evaluationRows.forEach(row => {
      if (row.grade !== undefined) {
        totalWeightedGrade += row.grade * row.weight;
        totalWeight += row.weight;
      } else {
        hasAllGrades = false;
      }
    });

    return {
      average: totalWeight > 0 ? totalWeightedGrade / totalWeight : 0,
      hasAllGrades,
      isApproved: totalWeight > 0 ? (totalWeightedGrade / totalWeight) >= 7 : null
    };
  };

  const result = calculateFinalAverage();

  const getGradeColor = (grade: number) => {
    if (grade >= 8) return 'bg-green-100 text-green-800';
    if (grade >= 7) return 'bg-blue-100 text-blue-800';
    if (grade >= 6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
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
          <p>Carregando notas da matéria...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/student/grades')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>

      {/* Subject Info */}
      {subjectInfo && (
        <div className="mb-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <BookOpen className="h-6 w-6" />
                    {subjectInfo.name}
                  </CardTitle>
                  <CardDescription className="text-lg">
                    {subjectInfo.code} - {subjectInfo.class_name}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Professor(a)</p>
                  <p className="font-medium">{subjectInfo.teacher_name}</p>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Grades Table */}
      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Avaliações do Semestre</CardTitle>
            <CardDescription>
              Avaliações previstas e notas lançadas para esta matéria
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Avaliação</TableHead>
                  <TableHead>Peso</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluationRows.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell>
                      <Badge variant="outline">Peso {row.weight}</Badge>
                    </TableCell>
                    <TableCell>
                      {row.grade !== undefined ? (
                        <Badge className={getGradeColor(row.grade)}>
                          {row.grade.toFixed(1)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.date ? new Date(row.date).toLocaleDateString('pt-BR') : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.status === 'lançada' ? 'default' : 'secondary'}>
                        {row.status === 'lançada' ? 'Lançada' : 'Pendente'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Final Result */}
      <div className="mb-6">
        <Card className={`border-l-4 ${
          result.isApproved === true 
            ? 'border-l-green-500 bg-green-50' 
            : result.isApproved === false 
              ? 'border-l-red-500 bg-red-50'
              : 'border-l-gray-500 bg-gray-50'
        }`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.isApproved === true ? (
                <Award className="h-5 w-5 text-green-600" />
              ) : result.isApproved === false ? (
                <AlertCircle className="h-5 w-5 text-red-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-gray-600" />
              )}
              Resultado Final da Matéria
            </CardTitle>
            <CardDescription>
              {result.hasAllGrades 
                ? 'Média final calculada com base em todas as avaliações'
                : 'Aguardando lançamento de todas as avaliações para cálculo final'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                {result.hasAllGrades ? (
                  <>
                    <p className={`text-2xl font-bold ${
                      result.isApproved === true ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {result.isApproved === true ? '✅ APROVADO' : '❌ REPROVADO'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Nota mínima para aprovação: 7.0
                    </p>
                    {result.isApproved === false && (
                      <p className="text-sm text-muted-foreground">
                        Faltaram {(7 - result.average).toFixed(1)} pontos para aprovação
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-gray-700">
                      ⏳ AGUARDANDO
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Resultado será exibido após todas as avaliações
                    </p>
                  </>
                )}
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">
                  {result.hasAllGrades ? result.average.toFixed(1) : '--'}
                </p>
                <p className="text-sm text-muted-foreground">Média Final</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}