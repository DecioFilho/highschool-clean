import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { BookMarked, Plus, Edit, Trash2 } from 'lucide-react';

interface ClassSubject {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  workload_hours: number;
  created_at: string;
  classes: {
    name: string;
    code: string;
    year: number;
    semester: number;
  };
  subjects: {
    name: string;
    code: string;
  };
  users: {
    full_name: string;
    email: string;
  };
}

interface Class {
  id: string;
  name: string;
  code: string;
  year: number;
  semester: number;
}

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface Teacher {
  id: string;
  full_name: string;
  email: string;
}

export default function ClassSubjects() {
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClassSubject, setEditingClassSubject] = useState<ClassSubject | null>(null);
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    class_id: '',
    subject_id: '',
    teacher_id: '',
    workload_hours: ''
  });

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchData = useCallback(async () => {
    try {
      // Fetch class subjects with relations
      const { data: classSubjectsData, error: classSubjectsError } = await supabase
        .from('class_subjects')
        .select(`
          *,
          classes (name, code, year, semester),
          subjects (name, code),
          users (full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (classSubjectsError) throw classSubjectsError;

      // Fetch classes for form
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('*')
        .eq('status', 'active')
        .order('name');

      if (classesError) throw classesError;

      // Fetch subjects for form
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('*')
        .eq('status', 'active')
        .order('name');

      if (subjectsError) throw subjectsError;

      // Fetch teachers for form
      const { data: teachersData, error: teachersError } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('role', 'professor')
        .eq('status', 'active')
        .order('full_name');

      if (teachersError) throw teachersError;

      setClassSubjects(classSubjectsData || []);
      setClasses(classesData || []);
      setSubjects(subjectsData || []);
      setTeachers(teachersData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const checkTeacherCompetency = async (teacherId: string, subjectId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('teacher_competencies')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('subject_id', subjectId)
      .single();

    return !error && data;
  };

  const checkDuplicateAssignment = async (classId: string, subjectId: string, excludeId?: string): Promise<boolean> => {
    let query = supabase
      .from('class_subjects')
      .select('id')
      .eq('class_id', classId)
      .eq('subject_id', subjectId);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query.single();

    return !error && data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate teacher competency
      const hasCompetency = await checkTeacherCompetency(formData.teacher_id, formData.subject_id);
      if (!hasCompetency) {
        toast({
          title: "Erro de Validação",
          description: "O professor não tem competência nesta disciplina.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Check for duplicate assignment
      const isDuplicate = await checkDuplicateAssignment(
        formData.class_id, 
        formData.subject_id,
        editingClassSubject?.id
      );
      if (isDuplicate) {
        toast({
          title: "Erro de Validação",
          description: "Esta disciplina já está associada a esta turma.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const classSubjectData = {
        class_id: formData.class_id,
        subject_id: formData.subject_id,
        teacher_id: formData.teacher_id,
        workload_hours: parseInt(formData.workload_hours)
      };

      if (editingClassSubject) {
        const { error } = await supabase
          .from('class_subjects')
          .update(classSubjectData)
          .eq('id', editingClassSubject.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Associação atualizada com sucesso.",
        });
      } else {
        const { error } = await supabase
          .from('class_subjects')
          .insert([classSubjectData]);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Associação criada com sucesso.",
        });
      }

      setIsDialogOpen(false);
      setEditingClassSubject(null);
      setFormData({
        class_id: '',
        subject_id: '',
        teacher_id: '',
        workload_hours: ''
      });
      fetchData();
    } catch (error) {
      console.error('Error saving class subject:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar associação.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (classSubject: ClassSubject) => {
    setEditingClassSubject(classSubject);
    setFormData({
      class_id: classSubject.class_id,
      subject_id: classSubject.subject_id,
      teacher_id: classSubject.teacher_id,
      workload_hours: classSubject.workload_hours.toString()
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta associação?')) return;

    try {
      const { error } = await supabase
        .from('class_subjects')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Associação removida com sucesso.",
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting class subject:', error);
      toast({
        title: "Erro",
        description: "Erro ao remover associação.",
        variant: "destructive",
      });
    }
  };

  const openCreateDialog = () => {
    setEditingClassSubject(null);
    setFormData({
      class_id: '',
      subject_id: '',
      teacher_id: '',
      workload_hours: ''
    });
    setIsDialogOpen(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Turma-Disciplinas</h1>
          <p className="text-muted-foreground">
            Gerencie as associações entre turmas, disciplinas e professores
          </p>
        </div>
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Associação
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>
                  {editingClassSubject ? 'Editar Associação' : 'Nova Associação'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="class_id">Turma</Label>
                  <Select
                    value={formData.class_id}
                    onValueChange={(value) => setFormData({ ...formData, class_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma turma" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name} ({cls.code}) - {cls.year}º/{cls.semester}º
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject_id">Disciplina</Label>
                  <Select
                    value={formData.subject_id}
                    onValueChange={(value) => setFormData({ ...formData, subject_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma disciplina" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name} ({subject.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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

                <div className="space-y-2">
                  <Label htmlFor="workload_hours">Carga Horária (horas)</Label>
                  <Input
                    id="workload_hours"
                    type="number"
                    min="1"
                    value={formData.workload_hours}
                    onChange={(e) => setFormData({ ...formData, workload_hours: e.target.value })}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Salvando...' : editingClassSubject ? 'Atualizar' : 'Criar'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {classSubjects.map((classSubject) => (
          <Card key={classSubject.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookMarked className="h-5 w-5" />
                {classSubject.classes.name}
              </CardTitle>
              <CardDescription>
                Código: {classSubject.classes.code} | {classSubject.classes.year}º ano / {classSubject.classes.semester}º sem
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-medium">Disciplina</p>
                <p className="text-sm text-muted-foreground">
                  {classSubject.subjects.name} ({classSubject.subjects.code})
                </p>
              </div>
              
              <div>
                <p className="font-medium">Professor</p>
                <p className="text-sm text-muted-foreground">
                  {classSubject.users.full_name}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {classSubject.workload_hours}h
                </Badge>
              </div>

              {isAdmin && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(classSubject)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(classSubject.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {classSubjects.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <BookMarked className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma associação encontrada.</p>
            {isAdmin && (
              <p className="text-sm text-muted-foreground mt-2">
                Crie a primeira associação turma-disciplina-professor.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}