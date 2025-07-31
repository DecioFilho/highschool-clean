import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Calendar, Save, Users, CheckCircle, XCircle } from 'lucide-react';

interface Student {
  id: string;
  full_name: string;
  student_registration: string;
}

interface ClassInfo {
  id: string;
  name: string;
  code: string;
  year: number;
  semester: number;
  subject_name: string;
  subject_code: string;
  class_subject_id: string;
}

interface AttendanceEntry {
  student_id: string;
  status: 'present' | 'absent' | '';
  absence_count: number;
  justified: boolean;
  justification: string;
}

export default function TeacherAttendance() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { user, isTeacher } = useAuth();
  const { toast } = useToast();
  
  const [students, setStudents] = useState<Student[]>([]);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form states
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<{ [studentId: string]: AttendanceEntry }>({});

  const fetchClassData = useCallback(async () => {
    if (!user?.id || !isTeacher || !classId) return;

    try {
      // Fetch class info and verify teacher access
      const { data: classSubjectData, error: classError } = await supabase
        .from('class_subjects')
        .select(`
          id,
          class_id,
          subject_id,
          classes (id, name, code, year, semester),
          subjects (name, code)
        `)
        .eq('class_id', classId)
        .eq('teacher_id', user.id)
        .single();

      if (classError) throw classError;
      if (!classSubjectData) {
        toast({
          title: 'Acesso negado',
          description: 'Você não tem permissão para acessar esta turma.',
          variant: 'destructive',
        });
        navigate('/my-classes');
        return;
      }

      setClassInfo({
        id: classSubjectData.classes.id,
        name: classSubjectData.classes.name,
        code: classSubjectData.classes.code,
        year: classSubjectData.classes.year,
        semester: classSubjectData.classes.semester,
        subject_name: classSubjectData.subjects.name,
        subject_code: classSubjectData.subjects.code,
        class_subject_id: classSubjectData.id
      });

      // Fetch students enrolled in this class
      const { data: studentsData, error: studentsError } = await supabase
        .from('class_enrollments')
        .select(`
          users (id, full_name, student_registration)
        `)
        .eq('class_id', classId)
        .eq('status', 'active');

      if (studentsError) throw studentsError;

      const studentsList = studentsData?.map(enrollment => enrollment.users).filter(Boolean) || [];
      setStudents(studentsList as Student[]);

      // Initialize attendance object
      const initialAttendance: { [studentId: string]: AttendanceEntry } = {};
      studentsList.forEach(student => {
        if (student) {
          initialAttendance[student.id] = {
            student_id: student.id,
            status: '',
            absence_count: 1,
            justified: false,
            justification: ''
          };
        }
      });
      setAttendance(initialAttendance);

    } catch (error) {
      console.error('Error fetching class data:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados da turma',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, isTeacher, classId, toast, navigate]);

  useEffect(() => {
    fetchClassData();
  }, [fetchClassData]);

  const handleAttendanceChange = (studentId: string, field: keyof AttendanceEntry, value: string | boolean | number) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }));
  };

  const handleSaveAttendance = async () => {
    if (!classInfo || !attendanceDate) {
      toast({
        title: 'Erro',
        description: 'Selecione a data da aula.',
        variant: 'destructive',
      });
      return;
    }

    const absencesToSave = Object.values(attendance).filter(entry => entry.status === 'absent');
    
    if (absencesToSave.length === 0) {
      toast({
        title: 'Erro',
        description: 'Marque pelo menos uma falta para salvar.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      const attendanceInserts = absencesToSave.map(entry => ({
        student_id: entry.student_id,
        class_subject_id: classInfo.class_subject_id,
        teacher_id: user?.id,
        absence_date: attendanceDate,
        absence_count: entry.absence_count,
        justified: entry.justified,
        justification: entry.justified ? entry.justification : null
      }));

      const { error } = await supabase
        .from('attendance')
        .insert(attendanceInserts);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: `${absencesToSave.length} faltas registradas com sucesso!`,
      });

      // Clear attendance after saving
      const clearedAttendance: { [studentId: string]: AttendanceEntry } = {};
      students.forEach(student => {
        clearedAttendance[student.id] = {
          student_id: student.id,
          status: '',
          absence_count: 1,
          justified: false,
          justification: ''
        };
      });
      setAttendance(clearedAttendance);

    } catch (error) {
      console.error('Error saving attendance:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao salvar frequência',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getAbsenceCount = () => {
    return Object.values(attendance).filter(entry => entry.status === 'absent').length;
  };

  const setAllPresent = () => {
    const updatedAttendance = { ...attendance };
    Object.keys(updatedAttendance).forEach(studentId => {
      updatedAttendance[studentId].status = 'present';
    });
    setAttendance(updatedAttendance);
  };

  const setAllAbsent = () => {
    const updatedAttendance = { ...attendance };
    Object.keys(updatedAttendance).forEach(studentId => {
      updatedAttendance[studentId].status = 'absent';
    });
    setAttendance(updatedAttendance);
  };

  if (!isTeacher) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-6">
          <CardContent>
            <p className="text-center text-muted-foreground">
              Esta página é restrita para professores.
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
          <p>Carregando turma...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/my-classes')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>

      {classInfo && (
        <div className="mb-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Calendar className="h-6 w-6" />
                    Chamada - {classInfo.name}
                  </CardTitle>
                  <CardDescription className="text-lg">
                    {classInfo.subject_name} ({classInfo.subject_code})
                  </CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    {classInfo.year}º ano - {classInfo.semester}º semestre
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {students.length} alunos matriculados
                  </p>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Form Configuration */}
      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configuração da Chamada</CardTitle>
            <CardDescription>
              Configure a data da aula e marque as presenças/faltas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <Label htmlFor="attendance_date">Data da Aula</Label>
                <Input
                  id="attendance_date"
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button 
                  variant="outline"
                  onClick={setAllPresent}
                  className="w-full"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Todos Presentes
                </Button>
              </div>
              <div className="flex items-end">
                <Button 
                  variant="outline"
                  onClick={setAllAbsent}
                  className="w-full"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Todos Ausentes
                </Button>
              </div>
              <div className="flex items-end md:col-span-2">
                <Button 
                  onClick={handleSaveAttendance}
                  disabled={saving || getAbsenceCount() === 0}
                  className="w-full"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Salvando...' : `Registrar ${getAbsenceCount()} Faltas`}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Students Attendance Table */}
      {students.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Nenhum aluno matriculado</h3>
            <p className="text-muted-foreground">
              Esta turma ainda não possui alunos matriculados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Lista de Chamada</CardTitle>
            <CardDescription>
              Marque presente ou ausente para cada aluno. Apenas as faltas serão registradas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Nome do Aluno</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Qtd Faltas</TableHead>
                  <TableHead>Justificada?</TableHead>
                  <TableHead>Justificativa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-mono text-sm">
                      {student.student_registration}
                    </TableCell>
                    <TableCell className="font-medium">
                      {student.full_name}
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={attendance[student.id]?.status || ''} 
                        onValueChange={(value) => handleAttendanceChange(student.id, 'status', value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Selecionar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="present">Presente</SelectItem>
                          <SelectItem value="absent">Ausente</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {attendance[student.id]?.status === 'absent' && (
                        <Select 
                          value={attendance[student.id]?.absence_count.toString() || '1'} 
                          onValueChange={(value) => handleAttendanceChange(student.id, 'absence_count', parseInt(value))}
                        >
                          <SelectTrigger className="w-16">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1</SelectItem>
                            <SelectItem value="2">2</SelectItem>
                            <SelectItem value="3">3</SelectItem>
                            <SelectItem value="4">4</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      {attendance[student.id]?.status === 'absent' && (
                        <input
                          type="checkbox"
                          checked={attendance[student.id]?.justified || false}
                          onChange={(e) => handleAttendanceChange(student.id, 'justified', e.target.checked)}
                          className="rounded"
                        />
                      )}
                    </TableCell>
                    <TableCell className="w-64">
                      {attendance[student.id]?.status === 'absent' && attendance[student.id]?.justified && (
                        <Textarea
                          value={attendance[student.id]?.justification || ''}
                          onChange={(e) => handleAttendanceChange(student.id, 'justification', e.target.value)}
                          placeholder="Motivo da justificativa..."
                          className="min-h-8 text-sm"
                          rows={2}
                        />
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