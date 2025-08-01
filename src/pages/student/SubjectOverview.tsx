import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowLeft, 
  BookOpen, 
  Award, 
  AlertCircle, 
  TrendingUp, 
  Calendar,
  Clock,
  Target,
  CheckCircle,
  XCircle,
  User
} from 'lucide-react';

interface Grade {
  id: string;
  grade_value: number;
  grade_type: string;
  evaluation_date: string;
}

interface AttendanceRecord {
  id: string;
  absence_date: string;
  absence_count: number;
  justified: boolean;
  justification: string | null;
}

interface SubjectInfo {
  id: string;
  name: string;
  code: string;
  class_name: string;
  teacher_name: string;
}

export default function SubjectOverview() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { user, isStudent } = useAuth();
  const { toast } = useToast();
  
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [subjectInfo, setSubjectInfo] = useState<SubjectInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubjectData = useCallback(async () => {
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

      // Fetch grades
      const { data: gradesData, error: gradesError } = await supabase
        .from('grades')
        .select('*')
        .eq('student_id', user.id)
        .eq('class_subject_id', subjectId)
        .order('evaluation_date', { ascending: true });

      if (gradesError) throw gradesError;
      setGrades(gradesData || []);

      // Fetch attendance
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', user.id)
        .eq('class_subject_id', subjectId)
        .order('absence_date', { ascending: false });

      if (attendanceError) throw attendanceError;
      setAttendanceRecords(attendanceData || []);

    } catch (error) {
      console.error('Error fetching subject data:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados da matéria',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, isStudent, subjectId, toast, navigate]);

  useEffect(() => {
    fetchSubjectData();
  }, [fetchSubjectData]);

  // Calculate statistics
  const calculateStats = () => {
    let totalWeightedGrade = 0;
    let totalWeight = 0;
    let hasAllGrades = false;

    const expectedTypes = ['prova', 'trabalho'];
    const gradesByType = grades.reduce((acc, grade) => {
      acc[grade.grade_type] = grade;
      return acc;
    }, {} as Record<string, Grade>);

    hasAllGrades = expectedTypes.every(type => gradesByType[type]);

    grades.forEach(grade => {
      const weight = grade.grade_type === 'prova' ? 3 : grade.grade_type === 'trabalho' ? 7 : 1;
      totalWeightedGrade += grade.grade_value * weight;
      totalWeight += weight;
    });

    const average = totalWeight > 0 ? totalWeightedGrade / totalWeight : 0;
    const isApproved = hasAllGrades ? average >= 7 : null;

    // Attendance stats
    const totalAbsences = attendanceRecords.reduce((sum, record) => sum + record.absence_count, 0);
    const justifiedAbsences = attendanceRecords
      .filter(record => record.justified)
      .reduce((sum, record) => sum + record.absence_count, 0);
    const unjustifiedAbsences = totalAbsences - justifiedAbsences;

    return {
      average,
      hasAllGrades,
      isApproved,
      totalAbsences,
      justifiedAbsences,
      unjustifiedAbsences,
      gradesCount: grades.length,
      attendanceRecordsCount: attendanceRecords.length
    };
  };

  const stats = calculateStats();

  const getGradeColor = (grade: number) => {
    if (grade >= 8) return 'text-green-600 bg-green-50 border-green-200';
    if (grade >= 7) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (grade >= 6) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getProgressColor = (value: number, max: number = 10) => {
    const percentage = (value / max) * 100;
    if (percentage >= 70) return 'bg-green-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
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
          <p>Carregando dados da matéria...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/student/grades')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>

      {/* Subject Info Header */}
      {subjectInfo && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-0">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                    <BookOpen className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl text-gray-900">{subjectInfo.name}</CardTitle>
                    <CardDescription className="text-base font-medium text-gray-600">
                      {subjectInfo.code} • {subjectInfo.class_name}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <User className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">
                    <strong>Professor(a):</strong> {subjectInfo.teacher_name}
                  </span>
                </div>
              </div>
              
              {/* Quick Status */}
              <div className="text-right space-y-2">
                {stats.hasAllGrades && (
                  <div className="flex items-center gap-2">
                    {stats.isApproved ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className={`font-bold ${stats.isApproved ? 'text-green-600' : 'text-red-600'}`}>
                      {stats.isApproved ? 'APROVADO' : 'REPROVADO'}
                    </span>
                  </div>
                )}
                <div className="text-2xl font-bold text-gray-900">
                  {stats.hasAllGrades ? stats.average.toFixed(1) : '--'}
                </div>
                <div className="text-sm text-gray-500">Média</div>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">
                  {stats.hasAllGrades ? stats.average.toFixed(1) : '--'}
                </div>
                <div className="text-xs text-muted-foreground">Média Final</div>
              </div>
            </div>
            {stats.average > 0 && (
              <Progress 
                value={Math.min((stats.average / 10) * 100, 100)} 
                className="mt-2 h-2"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{stats.gradesCount}</div>
                <div className="text-xs text-muted-foreground">Notas Lançadas</div>
              </div>
            </div>
            <Progress value={(stats.gradesCount / 2) * 100} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <div>
                <div className="text-2xl font-bold">{stats.totalAbsences}</div>
                <div className="text-xs text-muted-foreground">Total de Faltas</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.justifiedAbsences} justificadas
            </div>
          </CardContent>
        </Card>

        <Card className={`${stats.unjustifiedAbsences >= 5 ? 'border-red-200 bg-red-50' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className={`h-5 w-5 ${stats.unjustifiedAbsences >= 5 ? 'text-red-500' : 'text-gray-500'}`} />
              <div>
                <div className={`text-2xl font-bold ${stats.unjustifiedAbsences >= 5 ? 'text-red-600' : ''}`}>
                  {stats.unjustifiedAbsences}
                </div>
                <div className="text-xs text-muted-foreground">Faltas Não Just.</div>
              </div>
            </div>
            {stats.unjustifiedAbsences >= 5 && (
              <div className="text-xs text-red-600 mt-1 font-medium">
                Atenção: Alto número!
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="grades" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="grades" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Notas Detalhadas
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Histórico de Faltas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grades" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Avaliações do Semestre
              </CardTitle>
              <CardDescription>
                Notas lançadas e status das avaliações
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {['prova', 'trabalho'].map((type, index) => {
                  const grade = grades.find(g => g.grade_type === type);
                  const label = type === 'prova' ? 'Prova' : 'Trabalho';
                  const weight = type === 'prova' ? 3 : 7;
                  
                  return (
                    <div key={type} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{label}</div>
                          <div className="text-sm text-muted-foreground">Peso {weight}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {grade ? (
                          <>
                            <Badge className={getGradeColor(grade.grade_value)}>
                              {grade.grade_value.toFixed(1)}
                            </Badge>
                            <div className="text-right">
                              <div className="text-sm">
                                {new Date(grade.evaluation_date).toLocaleDateString('pt-BR')}
                              </div>
                              <Badge variant="default" className="text-xs">
                                Lançada
                              </Badge>
                            </div>
                          </>
                        ) : (
                          <div className="text-right">
                            <Badge variant="secondary" className="text-xs">
                              Pendente
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Registro de Faltas
              </CardTitle>
              <CardDescription>
                Histórico completo de faltas e justificativas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {attendanceRecords.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <h3 className="text-lg font-semibold mb-2">Nenhuma falta registrada</h3>
                  <p className="text-muted-foreground">
                    Parabéns! Você não possui faltas nesta matéria.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {attendanceRecords.map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          record.justified ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                        }`}>
                          {record.justified ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">
                            {new Date(record.absence_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {record.absence_count} falta{record.absence_count > 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <Badge 
                          className={record.justified ? 
                            'bg-green-100 text-green-800 border-green-200' : 
                            'bg-red-100 text-red-800 border-red-200'
                          }
                        >
                          {record.justified ? 'Justificada' : 'Não Justificada'}
                        </Badge>
                        {record.justified && record.justification && (
                          <div className="text-xs text-muted-foreground mt-1 max-w-xs">
                            {record.justification}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Final Status Card */}
      {stats.hasAllGrades && (
        <Card className={`border-l-4 ${
          stats.isApproved === true 
            ? 'border-l-green-500 bg-green-50' 
            : 'border-l-red-500 bg-red-50'
        }`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {stats.isApproved === true ? (
                  <Award className="h-8 w-8 text-green-600" />
                ) : (
                  <AlertCircle className="h-8 w-8 text-red-600" />
                )}
                <div>
                  <h3 className={`text-xl font-bold ${
                    stats.isApproved === true ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {stats.isApproved === true ? '🎉 APROVADO!' : '⚠️ REPROVADO'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {stats.isApproved === true 
                      ? 'Parabéns! Você atingiu a média necessária para aprovação.'
                      : `Faltaram ${(7 - stats.average).toFixed(1)} pontos para aprovação.`
                    }
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{stats.average.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">Média final</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}