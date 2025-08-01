import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, CheckCircle, ChevronRight, AlertCircle } from 'lucide-react';

interface SubjectAttendanceSummary {
  class_subject_id: string;
  subject_name: string;
  subject_code: string;
  class_name: string;
  teacher_name: string;
  total_absences: number;
  justified_absences: number;
  unjustified_absences: number;
  total_records: number;
}

export default function StudentAttendance() {
  const [subjects, setSubjects] = useState<SubjectAttendanceSummary[]>([]);
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

      const subjectSummaries: SubjectAttendanceSummary[] = [];

      for (const enrollment of enrollmentData || []) {
        const classData = enrollment.classes;
        
        // Process each class subject for this enrollment
        for (const classSubject of classData.class_subjects || []) {
          // Fetch attendance records for this subject
          const { data: attendanceData, error: attendanceError } = await supabase
            .from('attendance')
            .select('absence_count, justified')
            .eq('student_id', user.id)
            .eq('class_subject_id', classSubject.id);

          if (attendanceError) throw attendanceError;

          // Calculate attendance statistics
          const records = attendanceData || [];
          const total_absences = records.reduce((sum, record) => sum + record.absence_count, 0);
          const justified_absences = records
            .filter(record => record.justified)
            .reduce((sum, record) => sum + record.absence_count, 0);

          subjectSummaries.push({
            class_subject_id: classSubject.id,
            subject_name: classSubject.subjects.name,
            subject_code: classSubject.subjects.code,
            class_name: classData.name,
            teacher_name: classSubject.users?.full_name || 'Professor não atribuído',
            total_absences: total_absences,
            justified_absences: justified_absences,
            unjustified_absences: total_absences - justified_absences,
            total_records: records.length
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

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  // Calculate overall statistics
  const totalAbsences = subjects.reduce((sum, subject) => sum + subject.total_absences, 0);
  const totalJustified = subjects.reduce((sum, subject) => sum + subject.justified_absences, 0);
  const totalUnjustified = subjects.reduce((sum, subject) => sum + subject.unjustified_absences, 0);

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
          <p>Carregando sua frequência...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Calendar className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Minha Frequência</h1>
      </div>

      {/* Summary Card */}
      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumo de Frequência</CardTitle>
            <CardDescription>
              Clique em uma matéria abaixo para ver detalhes da frequência
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{totalAbsences}</div>
                <div className="text-sm text-muted-foreground">Total de Faltas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{totalJustified}</div>
                <div className="text-sm text-muted-foreground">Faltas Justificadas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{totalUnjustified}</div>
                <div className="text-sm text-muted-foreground">Faltas Não Justificadas</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subjects List */}
      {subjects.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
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
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/student/subject/${subject.class_subject_id}/attendance`)}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      <h3 className="text-lg font-semibold">{subject.subject_name}</h3>
                      <Badge variant="outline">{subject.subject_code}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">
                      <p><strong>Turma:</strong> {subject.class_name}</p>
                      <p><strong>Professor(a):</strong> {subject.teacher_name}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Total de faltas: </span>
                        <span className="font-medium">{subject.total_absences}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Justificadas: </span>
                        <span className="font-medium text-green-600">{subject.justified_absences}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Não justificadas: </span>
                        <span className={`font-medium ${subject.unjustified_absences > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {subject.unjustified_absences}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      {subject.total_absences === 0 ? (
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      ) : subject.unjustified_absences >= 5 ? (
                        <AlertCircle className="h-6 w-6 text-red-600" />
                      ) : (
                        <AlertCircle className="h-6 w-6 text-yellow-600" />
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Alert for high absences */}
      {totalUnjustified >= 5 && (
        <div className="mt-6">
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-orange-800">
                <AlertCircle className="h-5 w-5" />
                <div>
                  <div className="font-semibold">Atenção: Alto número de faltas não justificadas</div>
                  <div className="text-sm">
                    Você possui {totalUnjustified} faltas não justificadas no total. 
                    Procure a secretaria para verificar sua situação acadêmica.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}