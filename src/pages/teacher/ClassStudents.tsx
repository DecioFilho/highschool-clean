import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Users, ArrowLeft, BookOpen, Calendar, Plus } from 'lucide-react';

interface Student {
  id: string;
  full_name: string;
  email: string;
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

interface TeacherSubject {
  id: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
}

export default function ClassStudents() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { user, isTeacher } = useAuth();
  const { toast } = useToast();
  
  const [students, setStudents] = useState<Student[]>([]);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [teacherSubjects, setTeacherSubjects] = useState<TeacherSubject[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [gradeModalOpen, setGradeModalOpen] = useState(false);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  // Form states
  const [gradeForm, setGradeForm] = useState({
    subject_id: '',
    grade_value: '',
    grade_type: '',
    evaluation_date: new Date().toISOString().split('T')[0]
  });
  
  const [attendanceForm, setAttendanceForm] = useState({
    subject_id: '',
    absence_date: new Date().toISOString().split('T')[0],
    absence_count: '1',
    justified: false,
    justification: ''
  });

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
          users (id, full_name, email, student_registration)
        `)
        .eq('class_id', classId)
        .eq('status', 'active');

      if (studentsError) throw studentsError;

      const studentsList = studentsData?.map(enrollment => enrollment.users).filter(Boolean) || [];
      setStudents(studentsList as Student[]);

      // Fetch all subjects this teacher can grade for (teacher competencies)
      const { data: competenciesData, error: competenciesError } = await supabase
        .from('teacher_competencies')
        .select(`
          id,
          subject_id,
          subjects (name, code)
        `)
        .eq('teacher_id', user.id);

      if (competenciesError) throw competenciesError;

      const subjectsList = competenciesData?.map(comp => ({
        id: comp.id,
        subject_id: comp.subject_id,
        subject_name: comp.subjects.name,
        subject_code: comp.subjects.code
      })) || [];
      setTeacherSubjects(subjectsList);

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

  const handleLaunchGrade = async () => {
    if (!selectedStudent || !classInfo) return;

    try {
      // Find the class_subject_id for the selected subject
      const { data: classSubjectData, error: classSubjectError } = await supabase
        .from('class_subjects')
        .select('id')
        .eq('class_id', classId)
        .eq('subject_id', gradeForm.subject_id)
        .eq('teacher_id', user?.id)
        .single();

      if (classSubjectError || !classSubjectData) {
        toast({
          title: 'Erro',
          description: 'Você não tem permissão para lançar nota nesta disciplina.',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase
        .from('grades')
        .insert({
          student_id: selectedStudent.id,
          class_subject_id: classSubjectData.id,
          teacher_id: user?.id,
          grade_value: parseFloat(gradeForm.grade_value),
          grade_type: gradeForm.grade_type,
          evaluation_date: gradeForm.evaluation_date
        });

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Nota lançada com sucesso!',
      });

      setGradeModalOpen(false);
      setGradeForm({
        subject_id: '',
        grade_value: '',
        grade_type: '',
        evaluation_date: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error('Error launching grade:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao lançar nota',
        variant: 'destructive',
      });
    }
  };

  const handleMarkAttendance = async () => {
    if (!selectedStudent || !classInfo) return;

    try {
      // Find the class_subject_id for the selected subject
      const { data: classSubjectData, error: classSubjectError } = await supabase
        .from('class_subjects')
        .select('id')
        .eq('class_id', classId)
        .eq('subject_id', attendanceForm.subject_id)
        .eq('teacher_id', user?.id)
        .single();

      if (classSubjectError || !classSubjectData) {
        toast({
          title: 'Erro',
          description: 'Você não tem permissão para marcar frequência nesta disciplina.',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase
        .from('attendance')
        .insert({
          student_id: selectedStudent.id,
          class_subject_id: classSubjectData.id,
          teacher_id: user?.id,
          absence_date: attendanceForm.absence_date,
          absence_count: parseInt(attendanceForm.absence_count),
          justified: attendanceForm.justified,
          justification: attendanceForm.justified ? attendanceForm.justification : null
        });

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Frequência registrada com sucesso!',
      });

      setAttendanceModalOpen(false);
      setAttendanceForm({
        subject_id: '',
        absence_date: new Date().toISOString().split('T')[0],
        absence_count: '1',
        justified: false,
        justification: ''
      });
    } catch (error) {
      console.error('Error marking attendance:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao registrar frequência',
        variant: 'destructive',
      });
    }
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
          <p>Carregando alunos...</p>
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
                    <Users className="h-6 w-6" />
                    {classInfo.name}
                  </CardTitle>
                  <CardDescription className="text-lg">
                    {classInfo.subject_name} ({classInfo.subject_code})
                  </CardDescription>
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className="mb-2">
                    {classInfo.code}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    {classInfo.year}º ano - {classInfo.semester}º semestre
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{students.length} alunos matriculados</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Students List */}
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
        <div className="grid gap-4">
          {students.map((student) => (
            <Card key={student.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{student.full_name}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span>Matrícula: {student.student_registration}</span>
                      <span>Email: {student.email}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={gradeModalOpen} onOpenChange={setGradeModalOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setSelectedStudent(student)}
                        >
                          <BookOpen className="h-4 w-4 mr-1" />
                          Lançar Nota
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Lançar Nota</DialogTitle>
                          <DialogDescription>
                            Lançar nota para {selectedStudent?.full_name}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="subject">Disciplina</Label>
                            <Select value={gradeForm.subject_id} onValueChange={(value) => setGradeForm(prev => ({ ...prev, subject_id: value }))}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a disciplina" />
                              </SelectTrigger>
                              <SelectContent>
                                {teacherSubjects.map((subject) => (
                                  <SelectItem key={subject.subject_id} value={subject.subject_id}>
                                    {subject.subject_name} ({subject.subject_code})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="grade_type">Tipo de Avaliação</Label>
                            <Select value={gradeForm.grade_type} onValueChange={(value) => setGradeForm(prev => ({ ...prev, grade_type: value }))}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="prova">Prova</SelectItem>
                                <SelectItem value="trabalho">Trabalho</SelectItem>
                                <SelectItem value="participacao">Participação</SelectItem>
                                <SelectItem value="projeto">Projeto</SelectItem>
                                <SelectItem value="recuperacao">Recuperação</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="grade_value">Nota (0-10)</Label>
                            <Input
                              id="grade_value"
                              type="number"
                              min="0"
                              max="10"
                              step="0.1"
                              value={gradeForm.grade_value}
                              onChange={(e) => setGradeForm(prev => ({ ...prev, grade_value: e.target.value }))}
                              placeholder="Ex: 8.5"
                            />
                          </div>
                          <div>
                            <Label htmlFor="evaluation_date">Data da Avaliação</Label>
                            <Input
                              id="evaluation_date"
                              type="date"
                              value={gradeForm.evaluation_date}
                              onChange={(e) => setGradeForm(prev => ({ ...prev, evaluation_date: e.target.value }))}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setGradeModalOpen(false)}>
                            Cancelar
                          </Button>
                          <Button 
                            onClick={handleLaunchGrade}
                            disabled={!gradeForm.subject_id || !gradeForm.grade_type || !gradeForm.grade_value}
                          >
                            Lançar Nota
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={attendanceModalOpen} onOpenChange={setAttendanceModalOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setSelectedStudent(student)}
                        >
                          <Calendar className="h-4 w-4 mr-1" />
                          Marcar Falta
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Registrar Frequência</DialogTitle>
                          <DialogDescription>
                            Registrar falta para {selectedStudent?.full_name}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="subject_attendance">Disciplina</Label>
                            <Select value={attendanceForm.subject_id} onValueChange={(value) => setAttendanceForm(prev => ({ ...prev, subject_id: value }))}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a disciplina" />
                              </SelectTrigger>
                              <SelectContent>
                                {teacherSubjects.map((subject) => (
                                  <SelectItem key={subject.subject_id} value={subject.subject_id}>
                                    {subject.subject_name} ({subject.subject_code})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="absence_date">Data da Falta</Label>
                            <Input
                              id="absence_date"
                              type="date"
                              value={attendanceForm.absence_date}
                              onChange={(e) => setAttendanceForm(prev => ({ ...prev, absence_date: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label htmlFor="absence_count">Quantidade de Faltas</Label>
                            <Select value={attendanceForm.absence_count} onValueChange={(value) => setAttendanceForm(prev => ({ ...prev, absence_count: value }))}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1 falta</SelectItem>
                                <SelectItem value="2">2 faltas</SelectItem>
                                <SelectItem value="3">3 faltas</SelectItem>
                                <SelectItem value="4">4 faltas</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="justified"
                              checked={attendanceForm.justified}
                              onChange={(e) => setAttendanceForm(prev => ({ ...prev, justified: e.target.checked }))}
                              className="rounded"
                            />
                            <Label htmlFor="justified">Falta justificada</Label>
                          </div>
                          {attendanceForm.justified && (
                            <div>
                              <Label htmlFor="justification">Justificativa</Label>
                              <Textarea
                                id="justification"
                                value={attendanceForm.justification}
                                onChange={(e) => setAttendanceForm(prev => ({ ...prev, justification: e.target.value }))}
                                placeholder="Descreva o motivo da justificativa..."
                              />
                            </div>
                          )}
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setAttendanceModalOpen(false)}>
                            Cancelar
                          </Button>
                          <Button 
                            onClick={handleMarkAttendance}
                            disabled={!attendanceForm.subject_id}
                          >
                            Registrar Falta
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
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