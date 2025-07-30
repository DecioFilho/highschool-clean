import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { GraduationCap, Plus, Edit, Trash2, Filter } from 'lucide-react';

interface Grade {
  id: string;
  student_id: string;
  class_subject_id: string;
  teacher_id: string;
  grade_value: number;
  grade_type: 'prova' | 'trabalho' | 'participacao' | 'projeto' | 'recuperacao';
  evaluation_date: string;
  description?: string;
  created_at: string;
  student: {
    full_name: string;
    student_registration: string;
  };
  class_subject: {
    classes: {
      name: string;
      code: string;
    };
    subjects: {
      name: string;
      code: string;
    };
  };
  teacher: {
    full_name: string;
  };
}

interface ClassSubject {
  id: string;
  classes: {
    name: string;
    code: string;
  };
  subjects: {
    name: string;
    code: string;
  };
}

interface Student {
  id: string;
  full_name: string;
  student_registration: string;
}

interface Teacher {
  id: string;
  full_name: string;
}

const gradeTypeLabels = {
  prova: 'Prova',
  trabalho: 'Trabalho',
  participacao: 'Participação',
  projeto: 'Projeto',
  recuperacao: 'Recuperação'
};

const gradeTypeBadgeVariant = {
  prova: 'default',
  trabalho: 'secondary',
  participacao: 'outline',
  projeto: 'destructive',
  recuperacao: 'default'
} as const;

export default function Grades() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [filteredGrades, setFilteredGrades] = useState<Grade[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  const { isAdmin, isTeacher, user } = useAuth();
  const { toast } = useToast();

  // Filters
  const [filters, setFilters] = useState({
    class_subject_id: '',
    student_id: '',
    teacher_id: '',
    grade_type: ''
  });

  const [formData, setFormData] = useState({
    student_id: '',
    class_subject_id: '',
    teacher_id: '',
    grade_value: '',
    grade_type: 'prova' as 'prova' | 'trabalho' | 'participacao' | 'projeto' | 'recuperacao',
    evaluation_date: new Date().toISOString().split('T')[0],
    description: ''
  });

  const fetchData = useCallback(async () => {
    try {
      // Build query based on user role
      let gradesQuery = supabase
        .from('grades')
        .select(`
          *,
          student:users!grades_student_id_fkey (full_name, student_registration),
          teacher:users!grades_teacher_id_fkey (full_name),
          class_subject:class_subjects (
            id,
            classes (name, code),
            subjects (name, code)
          )
        `);

      // Filter by teacher if user is a teacher
      if (isTeacher && user?.id) {
        gradesQuery = gradesQuery.eq('teacher_id', user.id);
      }

      const { data: gradesData, error: gradesError } = await gradesQuery
        .order('evaluation_date', { ascending: false });

      if (gradesError) throw gradesError;

      // Fetch class subjects for form - filter by teacher if not admin
      let classSubjectsQuery = supabase
        .from('class_subjects')
        .select(`
          id,
          classes (name, code),
          subjects (name, code)
        `);

      if (isTeacher && user?.id) {
        classSubjectsQuery = classSubjectsQuery.eq('teacher_id', user.id);
      }

      const { data: classSubjectsData, error: classSubjectsError } = await classSubjectsQuery
        .order('classes(name)');

      if (classSubjectsError) throw classSubjectsError;

      // Fetch students for form
      const { data: studentsData, error: studentsError } = await supabase
        .from('users')
        .select('id, full_name, student_registration')
        .eq('role', 'aluno')
        .eq('status', 'active')
        .order('full_name');

      if (studentsError) throw studentsError;

      // Fetch teachers for form
      const { data: teachersData, error: teachersError } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('role', 'professor')
        .eq('status', 'active')
        .order('full_name');

      if (teachersError) throw teachersError;

      setGrades(gradesData || []);
      setFilteredGrades(gradesData || []);
      setClassSubjects(classSubjectsData || []);
      setStudents(studentsData || []);
      setTeachers(teachersData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados das notas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, isTeacher, user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Apply filters
  useEffect(() => {
    let filtered = grades;

    if (filters.class_subject_id) {
      filtered = filtered.filter(grade => grade.class_subject_id === filters.class_subject_id);
    }
    if (filters.student_id) {
      filtered = filtered.filter(grade => grade.student_id === filters.student_id);
    }
    if (filters.teacher_id) {
      filtered = filtered.filter(grade => grade.teacher_id === filters.teacher_id);
    }
    if (filters.grade_type) {
      filtered = filtered.filter(grade => grade.grade_type === filters.grade_type);
    }

    setFilteredGrades(filtered);
  }, [grades, filters]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const gradeValue = parseFloat(formData.grade_value);
      
      // Validate grade value
      if (gradeValue < 0 || gradeValue > 10) {
        toast({
          title: "Erro de Validação",
          description: "A nota deve estar entre 0 e 10.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Set teacher_id automatically for teachers
      const teacherId = isTeacher && user?.id ? user.id : formData.teacher_id;

      if (!teacherId) {
        toast({
          title: "Erro de Validação",
          description: "Professor deve ser selecionado.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const gradeData = {
        student_id: formData.student_id,
        class_subject_id: formData.class_subject_id,
        teacher_id: teacherId,
        grade_value: gradeValue,
        grade_type: formData.grade_type,
        evaluation_date: formData.evaluation_date,
        description: formData.description || null
      };

      if (editingGrade) {
        const { error } = await supabase
          .from('grades')
          .update(gradeData)
          .eq('id', editingGrade.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Nota atualizada com sucesso.",
        });
      } else {
        const { error } = await supabase
          .from('grades')
          .insert([gradeData]);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Nota criada com sucesso.",
        });
      }

      setIsDialogOpen(false);
      setEditingGrade(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving grade:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar nota.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (grade: Grade) => {
    setEditingGrade(grade);
    setFormData({
      student_id: grade.student_id,
      class_subject_id: grade.class_subject_id,
      teacher_id: grade.teacher_id,
      grade_value: grade.grade_value.toString(),
      grade_type: grade.grade_type,
      evaluation_date: grade.evaluation_date,
      description: grade.description || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta nota?')) return;

    try {
      const { error } = await supabase
        .from('grades')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Nota excluída com sucesso.",
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting grade:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir nota.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      student_id: '',
      class_subject_id: '',
      teacher_id: '',
      grade_value: '',
      grade_type: 'prova',
      evaluation_date: new Date().toISOString().split('T')[0],
      description: ''
    });
  };

  const openCreateDialog = () => {
    setEditingGrade(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const clearFilters = () => {
    setFilters({
      class_subject_id: '',
      student_id: '',
      teacher_id: '',
      grade_type: ''
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Notas</h1>
          <p className="text-muted-foreground">
            Visualize e gerencie todas as notas dos estudantes
          </p>
        </div>
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Nota
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {editingGrade ? 'Editar Nota' : 'Nova Nota'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="student_id">Aluno</Label>
                    <Select
                      value={formData.student_id}
                      onValueChange={(value) => setFormData({ ...formData, student_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um aluno" />
                      </SelectTrigger>
                      <SelectContent>
                        {students.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.full_name} ({student.student_registration})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="class_subject_id">Turma-Disciplina</Label>
                    <Select
                      value={formData.class_subject_id}
                      onValueChange={(value) => setFormData({ ...formData, class_subject_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione turma-disciplina" />
                      </SelectTrigger>
                      <SelectContent>
                        {classSubjects.map((cs) => (
                          <SelectItem key={cs.id} value={cs.id}>
                            {cs.classes.name} - {cs.subjects.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Show teacher selection only for admins */}
                  {isAdmin && (
                    <div className="space-y-2">
                      <Label htmlFor="teacher_id">Professor</Label>
                      <Select
                        value={formData.teacher_id}
                        onValueChange={(value) => setFormData({ ...formData, teacher_id: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um professor" />
                        </SelectTrigger>
                        <SelectContent>
                          {teachers.map((teacher) => (
                            <SelectItem key={teacher.id} value={teacher.id}>
                              {teacher.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="grade_type">Tipo de Nota</Label>
                    <Select
                      value={formData.grade_type}
                      onValueChange={(value) => setFormData({ ...formData, grade_type: value as 'prova' | 'trabalho' | 'participacao' | 'projeto' | 'recuperacao' })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(gradeTypeLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="grade_value">Nota (0-10)</Label>
                    <Input
                      id="grade_value"
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={formData.grade_value}
                      onChange={(e) => setFormData({ ...formData, grade_value: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="evaluation_date">Data da Avaliação</Label>
                    <Input
                      id="evaluation_date"
                      type="date"
                      value={formData.evaluation_date}
                      onChange={(e) => setFormData({ ...formData, evaluation_date: e.target.value })}
                      autocomplete="off"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição (opcional)</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Detalhes sobre a avaliação..."
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Salvando...' : editingGrade ? 'Atualizar' : 'Criar'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Turma-Disciplina</Label>
              <Select
                value={filters.class_subject_id}
                onValueChange={(value) => setFilters({ ...filters, class_subject_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  {classSubjects.map((cs) => (
                    <SelectItem key={cs.id} value={cs.id}>
                      {cs.classes.name} - {cs.subjects.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Aluno</Label>
              <Select
                value={filters.student_id}
                onValueChange={(value) => setFilters({ ...filters, student_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Show teacher filter only for admins */}
            {isAdmin && (
              <div className="space-y-2">
                <Label>Professor</Label>
                <Select
                  value={filters.teacher_id}
                  onValueChange={(value) => setFilters({ ...filters, teacher_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Tipo de Nota</Label>
              <Select
                value={filters.grade_type}
                onValueChange={(value) => setFilters({ ...filters, grade_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {Object.entries(gradeTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4">
            <Button variant="outline" onClick={clearFilters}>
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Grades Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Notas ({filteredGrades.length})
          </CardTitle>
          <CardDescription>
            Lista de todas as notas cadastradas no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredGrades.length === 0 ? (
            <div className="text-center py-8">
              <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma nota encontrada.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Turma</TableHead>
                    <TableHead>Disciplina</TableHead>
                    {isAdmin && <TableHead>Professor</TableHead>}
                    <TableHead>Nota</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data</TableHead>
                    {isAdmin && <TableHead>Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGrades.map((grade) => (
                    <TableRow key={grade.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{grade.student.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {grade.student.student_registration}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{grade.class_subject.classes.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {grade.class_subject.classes.code}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{grade.class_subject.subjects.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {grade.class_subject.subjects.code}
                          </p>
                        </div>
                      </TableCell>
                      {isAdmin && <TableCell>{grade.teacher.full_name}</TableCell>}
                      <TableCell>
                        <Badge variant={grade.grade_value >= 6 ? "default" : "destructive"}>
                          {grade.grade_value.toFixed(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={gradeTypeBadgeVariant[grade.grade_type]}>
                          {gradeTypeLabels[grade.grade_type]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(grade.evaluation_date).toLocaleDateString('pt-BR')}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(grade)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(grade.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}