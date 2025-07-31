import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  absence_date: string;
  absence_count: number;
  justified: boolean;
  justification: string | null;
  class_subject_id: string;
  subject_name: string;
  subject_code: string;
  class_name: string;
  teacher_name: string;
}

interface Subject {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  total_absences: number;
  justified_absences: number;
  unjustified_absences: number;
}

export default function StudentAttendance() {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const { user, isStudent } = useAuth();
  const { toast } = useToast();

  const fetchAttendance = useCallback(async () => {
    if (!user?.id || !isStudent) return;

    try {
      // Fetch all attendance records for the current student
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select(`
          id,
          absence_date,
          absence_count,
          justified,
          justification,
          class_subject_id,
          class_subjects (
            subjects (name, code),
            classes (name),
            users (full_name)
          )
        `)
        .eq('student_id', user.id)
        .order('absence_date', { ascending: false });

      if (attendanceError) throw attendanceError;

      // Transform data for easier use
      const transformedRecords = attendanceData?.map(record => ({
        id: record.id,
        absence_date: record.absence_date,
        absence_count: record.absence_count,
        justified: record.justified,
        justification: record.justification,
        class_subject_id: record.class_subject_id,
        subject_name: record.class_subjects.subjects.name,
        subject_code: record.class_subjects.subjects.code,
        class_name: record.class_subjects.classes.name,
        teacher_name: record.class_subjects.users.full_name
      })) || [];

      setAttendanceRecords(transformedRecords);

      // Calculate statistics by subject
      const subjectStats = transformedRecords.reduce((acc: { [key: string]: Subject }, record) => {
        const key = record.subject_name;
        
        if (!acc[key]) {
          acc[key] = {
            subject_id: record.class_subject_id,
            subject_name: record.subject_name,
            subject_code: record.subject_code,
            total_absences: 0,
            justified_absences: 0,
            unjustified_absences: 0
          };
        }
        
        acc[key].total_absences += record.absence_count;
        if (record.justified) {
          acc[key].justified_absences += record.absence_count;
        } else {
          acc[key].unjustified_absences += record.absence_count;
        }
        
        return acc;
      }, {});

      setSubjects(Object.values(subjectStats));
    } catch (error) {
      console.error('Error fetching attendance:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar sua frequência',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, isStudent, toast]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // Filter records by selected subject
  const filteredRecords = selectedSubject === 'all' 
    ? attendanceRecords 
    : attendanceRecords.filter(record => record.subject_name === selectedSubject);

  // Calculate totals for filtered records
  const totalAbsences = filteredRecords.reduce((sum, record) => sum + record.absence_count, 0);
  const justifiedAbsences = filteredRecords
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
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{subjects.length}</div>
                <div className="text-sm text-muted-foreground">Disciplinas</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">Filtrar por disciplina:</label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as disciplinas</SelectItem>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.subject_id} value={subject.subject_name}>
                      {subject.subject_name} ({subject.subject_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subject Statistics (when a specific subject is selected) */}
      {selectedSubject !== 'all' && (
        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Estatísticas - {selectedSubject}</CardTitle>
            </CardHeader>
            <CardContent>
              {subjects.filter(s => s.subject_name === selectedSubject).map(subject => (
                <div key={subject.subject_id} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-xl font-bold text-primary">{subject.total_absences}</div>
                    <div className="text-sm text-muted-foreground">Total de Faltas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-600">{subject.justified_absences}</div>
                    <div className="text-sm text-muted-foreground">Justificadas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-red-600">{subject.unjustified_absences}</div>
                    <div className="text-sm text-muted-foreground">Não Justificadas</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Attendance Records Table */}
      {filteredRecords.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma falta registrada</h3>
            <p className="text-muted-foreground">
              {selectedSubject === 'all' 
                ? 'Parabéns! Você não possui faltas registradas.'
                : `Você não possui faltas em ${selectedSubject}.`
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedSubject === 'all' ? 'Todas as Faltas' : `Faltas - ${selectedSubject}`}
            </CardTitle>
            <CardDescription>
              Registro de faltas organizadas por data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Disciplina</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Justificativa</TableHead>
                  <TableHead>Professor</TableHead>
                  <TableHead>Turma</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      {new Date(record.absence_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{record.subject_name}</div>
                        <div className="text-sm text-muted-foreground">{record.subject_code}</div>
                      </div>
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
                    <TableCell className="text-sm">{record.teacher_name}</TableCell>
                    <TableCell className="text-sm">{record.class_name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Alert for high absences */}
      {unjustifiedAbsences >= 5 && (
        <div className="mt-6">
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-orange-800">
                <AlertCircle className="h-5 w-5" />
                <div>
                  <div className="font-semibold">Atenção: Alto número de faltas não justificadas</div>
                  <div className="text-sm">
                    Você possui {unjustifiedAbsences} faltas não justificadas. 
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