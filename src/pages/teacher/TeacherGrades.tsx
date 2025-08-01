import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, BookOpen, Save, Users } from 'lucide-react';

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

interface GradeEntry {
  student_id: string;
  grade_value: string;
}

export default function TeacherGrades() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { user, isTeacher } = useAuth();
  const { toast } = useToast();
  
  const [students, setStudents] = useState<Student[]>([]);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form states
  const [gradeType, setGradeType] = useState('');
  const [evaluationDate, setEvaluationDate] = useState(new Date().toISOString().split('T')[0]);
  const [grades, setGrades] = useState<{ [studentId: string]: string }>({});

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

      // Initialize grades object
      const initialGrades: { [studentId: string]: string } = {};
      studentsList.forEach(student => {
        if (student) {
          initialGrades[student.id] = '';
        }
      });
      setGrades(initialGrades);

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

  const handleGradeChange = (studentId: string, value: string) => {
    // Validate grade range
    const numValue = parseFloat(value);
    if (value === '' || (numValue >= 0 && numValue <= 10)) {
      setGrades(prev => ({
        ...prev,
        [studentId]: value
      }));
    }
  };

  const handleSaveGrades = async () => {
    if (!classInfo || !gradeType || !evaluationDate) {
      toast({
        title: 'Erro',
        description: 'Preencha o tipo de avaliação e a data.',
        variant: 'destructive',
      });
      return;
    }

    const gradesToSave = Object.entries(grades).filter(([_, value]) => value !== '');
    
    if (gradesToSave.length === 0) {
      toast({
        title: 'Erro',
        description: 'Digite pelo menos uma nota para salvar.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      const gradeInserts = gradesToSave.map(([studentId, gradeValue]) => ({
        student_id: studentId,
        class_subject_id: classInfo.class_subject_id,
        teacher_id: user?.id,
        grade_value: parseFloat(gradeValue),
        grade_type: gradeType,
        evaluation_date: evaluationDate
      }));

      const { error } = await supabase
        .from('grades')
        .insert(gradeInserts);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: `${gradesToSave.length} notas lançadas com sucesso!`,
      });

      // Clear grades after saving
      const clearedGrades: { [studentId: string]: string } = {};
      students.forEach(student => {
        clearedGrades[student.id] = '';
      });
      setGrades(clearedGrades);
      setGradeType('');

    } catch (error) {
      console.error('Error saving grades:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao salvar notas',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getGradeCount = () => {
    return Object.values(grades).filter(value => value !== '').length;
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
                    <BookOpen className="h-6 w-6" />
                    Lançar Notas - {classInfo.name}
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
            <CardTitle className="text-lg">Configuração da Avaliação</CardTitle>
            <CardDescription>
              Configure o tipo de avaliação e a data antes de lançar as notas. Nota mínima para aprovação: 7,0
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="grade_type">Tipo de Avaliação</Label>
                <Select value={gradeType} onValueChange={setGradeType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prova">Avaliação 1 (peso 3)</SelectItem>
                    <SelectItem value="trabalho">Avaliação 2 (peso 7)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="evaluation_date">Data da Avaliação</Label>
                <Input
                  id="evaluation_date"
                  type="date"
                  value={evaluationDate}
                  onChange={(e) => setEvaluationDate(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={handleSaveGrades}
                  disabled={saving || !gradeType || getGradeCount() === 0}
                  className="w-full"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Salvando...' : `Salvar ${getGradeCount()} Notas`}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Students Grades Table */}
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
            <CardTitle>Lançamento de Notas</CardTitle>
            <CardDescription>
              Digite as notas dos alunos (0-10). Deixe em branco para não lançar nota.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Nome do Aluno</TableHead>
                  <TableHead className="w-32">Nota (0-10)</TableHead>
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
                      <Input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={grades[student.id] || ''}
                        onChange={(e) => handleGradeChange(student.id, e.target.value)}
                        placeholder="0.0"
                        className="w-20"
                      />
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