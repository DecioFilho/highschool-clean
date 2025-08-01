import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Calendar, CheckCircle, XCircle } from 'lucide-react';

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

export default function SubjectAttendance() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { user, isStudent } = useAuth();
  const { toast } = useToast();
  
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [subjectInfo, setSubjectInfo] = useState<SubjectInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubjectAttendance = useCallback(async () => {
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
        navigate('/student/attendance');
        return;
      }

      setSubjectInfo({
        id: targetSubject.class_subjects.id,
        name: targetSubject.class_subjects.subjects.name,
        code: targetSubject.class_subjects.subjects.code,
        class_name: targetSubject.classes.name,
        teacher_name: targetSubject.class_subjects.users?.full_name || 'Professor não atribuído'
      });

      // Fetch attendance records for this specific subject
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', user.id)
        .eq('class_subject_id', subjectId)
        .order('absence_date', { ascending: false });

      if (attendanceError) throw attendanceError;

      setAttendanceRecords(attendanceData || []);
    } catch (error) {
      console.error('Error fetching subject attendance:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar frequência da matéria',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, isStudent, subjectId, toast, navigate]);

  useEffect(() => {
    fetchSubjectAttendance();
  }, [fetchSubjectAttendance]);

  // Calculate attendance statistics
  const totalAbsences = attendanceRecords.reduce((sum, record) => sum + record.absence_count, 0);
  const justifiedAbsences = attendanceRecords
    .filter(record => record.justified)
    .reduce((sum, record) => sum + record.absence_count, 0);
  const unjustifiedAbsences = totalAbsences - justifiedAbsences;

  const getStatusColor = (justified: boolean) => {
    return justified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  const getStatusIcon = (justified: boolean) => {
    return justified ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />;
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
          <p>Carregando frequência da matéria...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/student/attendance')}>
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
                    <Calendar className="h-6 w-6" />
                    Frequência - {subjectInfo.name}
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

      {/* Summary Card */}
      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumo de Frequência</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{totalAbsences}</div>
                <div className="text-sm text-muted-foreground">Total de Faltas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{justifiedAbsences}</div>
                <div className="text-sm text-muted-foreground">Faltas Justificadas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{unjustifiedAbsences}</div>
                <div className="text-sm text-muted-foreground">Faltas Não Justificadas</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Records Table */}
      {attendanceRecords.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma falta registrada</h3>
            <p className="text-muted-foreground">
              Parabéns! Você não possui faltas nesta matéria.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Registro de Faltas</CardTitle>
            <CardDescription>
              Histórico de faltas organizadas por data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Justificativa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      {new Date(record.absence_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {record.absence_count} falta{record.absence_count > 1 ? 's' : ''}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(record.justified)}>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(record.justified)}
                          {record.justified ? 'Justificada' : 'Não Justificada'}
                        </div>
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {record.justified && record.justification ? (
                        <div className="text-sm">
                          {record.justification}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">-</div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}