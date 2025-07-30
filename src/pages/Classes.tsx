import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { School, Plus, Edit, Trash2, Users, BookOpen } from 'lucide-react';

interface Class {
  id: string;
  name: string;
  code: string;
  description?: string;
  year: number;
  semester?: number;
  status: 'active' | 'inactive';
  created_at: string;
}

interface ClassStudent {
  id: string;
  full_name: string;
  email: string;
  student_registration: string;
  enrollment_date: string;
  status: 'active' | 'inactive';
}

interface ClassSubject {
  id: string;
  subject_name: string;
  subject_code: string;
  teacher_name: string;
  teacher_email: string;
  workload_hours: number;
}

export default function Classes() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [isStudentsDialogOpen, setIsStudentsDialogOpen] = useState(false);
  const [classStudents, setClassStudents] = useState<ClassStudent[]>([]);
  const [isSubjectsDialogOpen, setIsSubjectsDialogOpen] = useState(false);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [subjects, setSubjects] = useState<{id: string; name: string; code: string}[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [teachers, setTeachers] = useState<{id: string; full_name: string}[]>([]);
  const [subjectTeachers, setSubjectTeachers] = useState<{[key: string]: string}>({});
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    year: new Date().getFullYear(),
    semester: 1
  });

  const fetchClasses = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('year', { ascending: false })
        .order('name');

      if (error) throw error;
      setClasses(data || []);

      // Also fetch subjects for the form
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('id, name, code')
        .eq('status', 'active')
        .order('name');

      if (subjectsError) throw subjectsError;
      setSubjects(subjectsData || []);

      // Also fetch teachers
      const { data: teachersData, error: teachersError } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('role', 'professor')
        .eq('status', 'active')
        .order('full_name');

      if (teachersError) throw teachersError;
      setTeachers(teachersData || []);

    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchClassStudents = useCallback(async (classId: string) => {
    try {
      const { data, error } = await supabase
        .from('class_enrollments')
        .select(`
          id,
          enrollment_date,
          status,
          student:users!class_enrollments_student_id_fkey(
            id,
            full_name,
            email,
            student_registration
          )
        `)
        .eq('class_id', classId)
        .order('enrollment_date', { ascending: false });

      if (error) throw error;

      const students = data?.map(enrollment => ({
        id: enrollment.student.id,
        full_name: enrollment.student.full_name,
        email: enrollment.student.email,
        student_registration: enrollment.student.student_registration || enrollment.student.id,
        enrollment_date: enrollment.enrollment_date,
        status: enrollment.status
      })) || [];

      setClassStudents(students);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar alunos da turma',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handleViewStudents = (classItem: Class) => {
    setSelectedClass(classItem);
    fetchClassStudents(classItem.id);
    setIsStudentsDialogOpen(true);
  };

  const fetchClassSubjects = useCallback(async (classId: string) => {
    try {
      const { data, error } = await supabase
        .from('class_subjects')
        .select(`
          id,
          workload_hours,
          teacher_id,
          subject:subjects!class_subjects_subject_id_fkey(
            name,
            code
          )
        `)
        .eq('class_id', classId);

      if (error) throw error;

      const subjects = [];
      
      for (const item of data || []) {
        let teacher_name = 'Professor não atribuído';
        let teacher_email = '';
        
        if (item.teacher_id) {
          const { data: teacherData } = await supabase
            .from('users')
            .select('full_name, email')
            .eq('id', item.teacher_id)
            .single();
            
          if (teacherData) {
            teacher_name = teacherData.full_name;
            teacher_email = teacherData.email;
          }
        }
        
        subjects.push({
          id: item.id,
          subject_name: item.subject.name,
          subject_code: item.subject.code,
          teacher_name,
          teacher_email,
          workload_hours: item.workload_hours
        });
      }

      setClassSubjects(subjects);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar disciplinas da turma',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handleViewSubjects = (classItem: Class) => {
    setSelectedClass(classItem);
    fetchClassSubjects(classItem.id);
    setIsSubjectsDialogOpen(true);
  };

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let classId: string;
      
      if (editingClass) {
        // Update existing class
        const { error } = await supabase
          .from('classes')
          .update({
            name: formData.name,
            code: formData.code,
            description: formData.description,
            year: formData.year,
            semester: formData.semester
          })
          .eq('id', editingClass.id);

        if (error) throw error;
        classId = editingClass.id;

        // Update class subjects
        // First, delete existing associations
        await supabase
          .from('class_subjects')
          .delete()
          .eq('class_id', classId);

        // Then, insert new associations
        if (selectedSubjectIds.length > 0) {
          const classSubjects = selectedSubjectIds.map(subjectId => ({
            class_id: classId,
            subject_id: subjectId,
            teacher_id: subjectTeachers[subjectId] && subjectTeachers[subjectId] !== '' ? subjectTeachers[subjectId] : null,
            workload_hours: 60 // Default workload, can be made configurable later
          }));

          const { error: subjectsError } = await supabase
            .from('class_subjects')
            .insert(classSubjects);

          if (subjectsError) {
            throw subjectsError;
          }
        }
        
        toast({
          title: 'Sucesso',
          description: 'Turma atualizada com sucesso',
        });
      } else {
        // Create new class
        const { data: classData, error } = await supabase
          .from('classes')
          .insert([{
            name: formData.name,
            code: formData.code,
            description: formData.description,
            year: formData.year,
            semester: formData.semester
          }])
          .select()
          .single();

        if (error) throw error;
        classId = classData.id;

        // Insert class subjects if any are selected
        if (selectedSubjectIds.length > 0) {
          const classSubjects = selectedSubjectIds.map(subjectId => ({
            class_id: classId,
            subject_id: subjectId,
            teacher_id: subjectTeachers[subjectId] && subjectTeachers[subjectId] !== '' ? subjectTeachers[subjectId] : null,
            workload_hours: 60 // Default workload
          }));

          const { error: subjectsError } = await supabase
            .from('class_subjects')
            .insert(classSubjects);

          if (subjectsError) {
            throw subjectsError;
          }
        }

        toast({
          title: 'Sucesso',
          description: 'Turma criada com sucesso',
        });
      }

      setIsDialogOpen(false);
      setEditingClass(null);
      setSelectedSubjectIds([]);
      setSubjectTeachers({});
      setFormData({
        name: '',
        code: '',
        description: '',
        year: new Date().getFullYear(),
        semester: 1
      });
      fetchClasses();
    } catch (error: unknown) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao salvar turma',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchClassSubjectsForEdit = useCallback(async (classId: string) => {
    try {
      const { data, error } = await supabase
        .from('class_subjects')
        .select('subject_id, teacher_id')
        .eq('class_id', classId);

      if (error) throw error;
      
      const subjectIds = data?.map(item => item.subject_id) || [];
      const teacherAssignments: {[key: string]: string} = {};
      
      data?.forEach(item => {
        if (item.teacher_id) {
          teacherAssignments[item.subject_id] = item.teacher_id;
        }
      });
      
      setSelectedSubjectIds(subjectIds);
      setSubjectTeachers(teacherAssignments);
    } catch (error) {
      console.error('Error fetching class subjects for edit:', error);
      setSelectedSubjectIds([]);
      setSubjectTeachers({});
    }
  }, []);

  const handleEdit = async (classItem: Class) => {
    setEditingClass(classItem);
    setFormData({
      name: classItem.name,
      code: classItem.code,
      description: classItem.description || '',
      year: classItem.year,
      semester: classItem.semester || 1
    });
    
    // Load current subjects for this class
    await fetchClassSubjectsForEdit(classItem.id);
    setIsDialogOpen(true);
  };

  const handleDeactivate = async (classId: string) => {
    if (!confirm('Tem certeza que deseja desativar esta turma?')) return;

    try {
      const { error } = await supabase
        .from('classes')
        .update({ status: 'inactive' })
        .eq('id', classId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Turma desativada com sucesso',
      });
      
      fetchClasses();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao desativar turma',
        variant: 'destructive',
      });
    }
  };

  const handleReactivate = async (classId: string) => {
    if (!confirm('Tem certeza que deseja reativar esta turma?')) return;

    try {
      const { error } = await supabase
        .from('classes')
        .update({ status: 'active' })
        .eq('id', classId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Turma reativada com sucesso',
      });
      
      fetchClasses();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao reativar turma',
        variant: 'destructive',
      });
    }
  };

  const handleDeletePermanently = async (classId: string) => {
    if (!confirm('ATENÇÃO: Esta ação irá excluir permanentemente a turma e todos os dados relacionados. Tem certeza?')) return;

    try {
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', classId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Turma excluída permanentemente',
      });
      
      fetchClasses();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao excluir turma permanentemente',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Turmas</h1>
          <p className="text-muted-foreground">
            Gerencie as turmas do sistema
          </p>
        </div>
        
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingClass(null);
                setSelectedSubjectIds([]);
                setSubjectTeachers({});
                setFormData({
                  name: '',
                  code: '',
                  description: '',
                  year: new Date().getFullYear(),
                  semester: 1
                });
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Turma
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingClass ? 'Editar Turma' : 'Nova Turma'}
                </DialogTitle>
                <DialogDescription>
                  {editingClass ? 'Edite as informações da turma e suas matérias vinculadas.' : 'Preencha os dados para criar uma nova turma e vincule as matérias desejadas.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="code">Código</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="year">Ano</Label>
                    <Input
                      id="year"
                      type="number"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="semester">Semestre</Label>
                    <Input
                      id="semester"
                      type="number"
                      min="1"
                      max="2"
                      value={formData.semester}
                      onChange={(e) => setFormData({ ...formData, semester: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
                
                {/* Subject Selection with Teachers */}
                <div className="space-y-3">
                  <Label>Matérias e Professores</Label>
                  <div className="max-h-64 overflow-y-auto border rounded-md p-3 space-y-3">
                    {subjects.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma matéria disponível</p>
                    ) : (
                      subjects.map((subject) => (
                        <div key={subject.id} className="space-y-2 p-3 border rounded-lg">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`subject-${subject.id}`}
                              checked={selectedSubjectIds.includes(subject.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedSubjectIds([...selectedSubjectIds, subject.id]);
                                } else {
                                  setSelectedSubjectIds(selectedSubjectIds.filter(id => id !== subject.id));
                                  // Remove teacher assignment when unchecking subject
                                  const newSubjectTeachers = { ...subjectTeachers };
                                  delete newSubjectTeachers[subject.id];
                                  setSubjectTeachers(newSubjectTeachers);
                                }
                              }}
                            />
                            <Label 
                              htmlFor={`subject-${subject.id}`} 
                              className="text-sm font-semibold cursor-pointer flex-1"
                            >
                              {subject.name} ({subject.code})
                            </Label>
                          </div>
                          
                          {selectedSubjectIds.includes(subject.id) && (
                            <div className="ml-6 space-y-1">
                              <Label className="text-xs">Professor para esta matéria:</Label>
                              <Select
                                value={subjectTeachers[subject.id] || 'none'}
                                onValueChange={(teacherId) => {
                                  setSubjectTeachers({
                                    ...subjectTeachers,
                                    [subject.id]: teacherId === 'none' ? '' : teacherId
                                  });
                                }}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Selecionar professor" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Nenhum professor</SelectItem>
                                  {teachers.map((teacher) => (
                                    <SelectItem key={teacher.id} value={teacher.id}>
                                      {teacher.full_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  {selectedSubjectIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {selectedSubjectIds.length} matéria{selectedSubjectIds.length !== 1 ? 's' : ''} selecionada{selectedSubjectIds.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Salvando...' : editingClass ? 'Atualizar' : 'Criar'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : classes.length === 0 ? (
            <div className="text-center py-8">
              <School className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma turma encontrada</p>
            </div>
          ) : (
            <div className="divide-y">
              {classes.map((classItem) => (
                <div key={classItem.id} className="flex items-center justify-between p-6 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <School className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">{classItem.name}</h3>
                        {classItem.status === 'inactive' && (
                          <Badge variant="outline">Inativo</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Código: {classItem.code} • {classItem.year}
                        {classItem.semester && ` - ${classItem.semester}º Semestre`}
                      </p>
                      {classItem.description && (
                        <p className="text-sm text-muted-foreground">
                          {classItem.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewStudents(classItem)}
                      className="text-sm"
                    >
                      <Users className="h-4 w-4 mr-1" />
                      Ver alunos
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewSubjects(classItem)}
                      className="text-sm"
                    >
                      <BookOpen className="h-4 w-4 mr-1" />
                      Ver matérias
                    </Button>
                    
                    {isAdmin && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(classItem)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {classItem.status === 'active' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeactivate(classItem.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReactivate(classItem.id)}
                              className="text-green-600 hover:text-green-700"
                            >
                              Reativar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeletePermanently(classItem.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Students Dialog */}
      <Dialog open={isStudentsDialogOpen} onOpenChange={setIsStudentsDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Alunos da Turma {selectedClass?.name} ({selectedClass?.code})
            </DialogTitle>
            <DialogDescription>
              Visualize todos os alunos matriculados nesta turma.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {classStudents.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum aluno matriculado nesta turma</p>
              </div>
            ) : (
              <div className="space-y-3">
                {classStudents.map((student) => (
                  <Card key={student.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold">{student.full_name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {student.email}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Matrícula: {student.student_registration}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant={student.status === 'active' ? 'default' : 'secondary'}>
                            {student.status === 'active' ? 'Ativo' : 'Inativo'}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            Matriculado em: {new Date(student.enrollment_date).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Subjects Dialog */}
      <Dialog open={isSubjectsDialogOpen} onOpenChange={setIsSubjectsDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Matérias da Turma {selectedClass?.name} ({selectedClass?.code})
            </DialogTitle>
            <DialogDescription>
              Visualize todas as matérias atribuídas a esta turma e seus respectivos professores.
            </DialogDescription>
          </DialogHeader>
          

          <div className="max-h-96 overflow-y-auto">
            {classSubjects.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhuma matéria atribuída a esta turma</p>
              </div>
            ) : (
              <div className="space-y-3">
                {classSubjects.map((subject) => (
                  <Card key={subject.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <BookOpen className="h-5 w-5 text-primary" />
                            <div>
                              <h4 className="font-semibold text-lg">{subject.subject_name}</h4>
                              <p className="text-sm text-muted-foreground">
                                Código: {subject.subject_code}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div>
                              <span className="font-medium">Professor:</span> {subject.teacher_name}
                            </div>
                            {subject.teacher_email && (
                              <div>
                                <span className="font-medium">Email:</span> {subject.teacher_email}
                              </div>
                            )}
                            <div>
                              <span className="font-medium">Carga Horária:</span> {subject.workload_hours}h
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}