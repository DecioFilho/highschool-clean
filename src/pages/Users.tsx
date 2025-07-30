import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Users as UsersIcon, Plus, Edit, Trash2, UserPlus, GraduationCap, Eye, School } from 'lucide-react';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'professor' | 'aluno';
  status: 'active' | 'inactive';
  student_registration?: string;
  created_at: string;
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userType, setUserType] = useState<'all' | 'admin' | 'professor' | 'aluno'>('all');
  const [newUserType, setNewUserType] = useState<'professor' | 'aluno' | null>(null);
  const [isSubjectsDialogOpen, setIsSubjectsDialogOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<User | null>(null);
  const [teacherSubjects, setTeacherSubjects] = useState<{id: string; name: string; code: string; classes: {id: string; name: string; code: string; year: number}[]}[]>([]);
  const [subjects, setSubjects] = useState<{id: string; name: string; code: string}[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [classes, setClasses] = useState<{id: string; name: string; code: string}[]>([]);
  const [isEnrollmentDialogOpen, setIsEnrollmentDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const { isAdmin, signUp } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'aluno' as 'admin' | 'professor' | 'aluno',
    password: '',
    student_registration: ''
  });


  const filteredUsers = users.filter(user => {
    if (userType === 'all') return true;
    return user.role === userType;
  });

  const fetchUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);

      // Also fetch subjects for the form
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('id, name, code')
        .eq('status', 'active')
        .order('name');

      if (subjectsError) throw subjectsError;
      setSubjects(subjectsData || []);

      // Also fetch classes for enrollment
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id, name, code')
        .eq('status', 'active')
        .order('name');

      if (classesError) throw classesError;
      setClasses(classesData || []);

    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar usuários',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let userId: string;
      
      if (editingUser) {
        // Update existing user
        const { error } = await supabase
          .from('users')
          .update({
            email: formData.email,
            full_name: formData.full_name,
            role: formData.role,
            student_registration: formData.student_registration || null
          })
          .eq('id', editingUser.id);

        if (error) throw error;
        userId = editingUser.id;

        // Note: Professor-subject relationships are now managed at the class level, 
        // not globally. This allows different professors to teach the same subject 
        // in different classes.
        
        toast({
          title: 'Sucesso',
          description: 'Usuário atualizado com sucesso',
        });
      } else {
        // Create new user
        const { error } = await signUp(formData.email, formData.password, formData.full_name, formData.role);
        
        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Usuário criado com sucesso',
        });
      }

      setIsDialogOpen(false);
      setEditingUser(null);
      setNewUserType(null);
      setSelectedSubjectIds([]);
      setFormData({
        email: '',
        full_name: '',
        role: 'aluno',
        password: '',
        student_registration: ''
      });
      fetchUsers();
    } catch (error: unknown) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao salvar usuário',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Note: Teacher subjects are now managed per class, not globally

  const handleEdit = async (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      password: '',
      student_registration: user.student_registration || ''
    });
    
    setSelectedSubjectIds([]);
    setIsDialogOpen(true);
  };

  const openStudentDialog = () => {
    setNewUserType('aluno');
    setSelectedSubjectIds([]);
    setFormData({
      email: '',
      full_name: '',
      role: 'aluno',
      password: '',
      student_registration: ''
    });
    setIsDialogOpen(true);
  };

  const openTeacherDialog = () => {
    setNewUserType('professor');
    setSelectedSubjectIds([]);
    setFormData({
      email: '',
      full_name: '',
      role: 'professor',
      password: '',
      student_registration: ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ status: 'inactive' })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Usuário desativado com sucesso',
      });
      
      fetchUsers();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao desativar usuário',
        variant: 'destructive',
      });
    }
  };

  const handleEnrollStudent = (student: User) => {
    setSelectedStudent(student);
    setSelectedClassId('');
    setIsEnrollmentDialogOpen(true);
  };

  const handleEnrollmentSubmit = async () => {
    if (!selectedStudent || !selectedClassId) return;

    try {
      // First, check if student is already enrolled in any class
      const { data: existingEnrollment, error: checkError } = await supabase
        .from('class_enrollments')
        .select('id, class_id')
        .eq('student_id', selectedStudent.id)
        .eq('status', 'active');

      if (checkError) throw checkError;

      if (existingEnrollment && existingEnrollment.length > 0) {
        // Update existing enrollment to new class
        const { error: updateError } = await supabase
          .from('class_enrollments')
          .update({ 
            class_id: selectedClassId,
            enrollment_date: new Date().toISOString()
          })
          .eq('student_id', selectedStudent.id)
          .eq('status', 'active');

        if (updateError) throw updateError;
      } else {
        // Create new enrollment
        const { error: insertError } = await supabase
          .from('class_enrollments')
          .insert([{
            student_id: selectedStudent.id,
            class_id: selectedClassId,
            enrollment_date: new Date().toISOString(),
            status: 'active'
          }]);

        if (insertError) throw insertError;
      }

      toast({
        title: 'Sucesso',
        description: 'Aluno matriculado na turma com sucesso',
      });

      setIsEnrollmentDialogOpen(false);
      setSelectedStudent(null);
      setSelectedClassId('');
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao matricular aluno na turma',
        variant: 'destructive',
      });
    }
  };

  const handleViewSubjects = async (teacher: User) => {
    setSelectedTeacher(teacher);
    setIsSubjectsDialogOpen(true);
    
    try {
      const { data, error } = await supabase
        .from('class_subjects')
        .select(`
          id,
          subject:subjects!class_subjects_subject_id_fkey (
            id,
            name,
            code
          ),
          class:classes!class_subjects_class_id_fkey (
            id,
            name,
            code,
            year
          )
        `)
        .eq('teacher_id', teacher.id);

      if (error) throw error;

      // Agrupar por disciplina
      const groupedSubjects: { [key: string]: {id: string; name: string; code: string; classes: {id: string; name: string; code: string; year: number}[]} } = {};
      
      data?.forEach((item) => {
        const subjectId = item.subject.id;
        if (!groupedSubjects[subjectId]) {
          groupedSubjects[subjectId] = {
            ...item.subject,
            classes: []
          };
        }
        
        const classExists = groupedSubjects[subjectId].classes.find(c => c.id === item.class.id);
        if (!classExists) {
          groupedSubjects[subjectId].classes.push(item.class);
        }
      });

      setTeacherSubjects(Object.values(groupedSubjects));
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar disciplinas do professor',
        variant: 'destructive',
      });
    }
  };

  // Note: Teacher assignments are now managed exclusively through the Classes interface
  // This prevents automatic assignment to all classes with a subject

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'professor': return 'Professor';
      case 'aluno': return 'Aluno';
      default: return role;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'professor': return 'default';
      case 'aluno': return 'secondary';
      default: return 'outline';
    }
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Acesso negado. Apenas administradores podem gerenciar usuários.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usuários</h1>
          <p className="text-muted-foreground">
            Gerencie os usuários do sistema
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={openStudentDialog}>
            <UserPlus className="mr-2 h-4 w-4" />
            Novo Aluno
          </Button>
          <Button onClick={openTeacherDialog} variant="outline">
            <GraduationCap className="mr-2 h-4 w-4" />
            Novo Professor
          </Button>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingUser ? 'Editar Usuário' : 
                 newUserType === 'professor' ? 'Novo Professor' :
                 newUserType === 'aluno' ? 'Novo Aluno' : 'Novo Usuário'}
              </DialogTitle>
              <DialogDescription>
                {editingUser ? 'Edite as informações do usuário abaixo.' : 
                 newUserType === 'professor' ? 'Preencha os dados para criar um novo professor.' :
                 newUserType === 'aluno' ? 'Preencha os dados para criar um novo aluno.' : 'Preencha os dados para criar um novo usuário.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome Completo</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  autocomplete="name"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  autocomplete="email"
                  required
                />
              </div>
              
              {!editingUser && (
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    autocomplete="new-password"
                    required
                    minLength={6}
                  />
                </div>
              )}
              
              {/* Hide role selection for new users with specific type */}
              {editingUser && (
                <div className="space-y-2">
                  <Label htmlFor="role">Tipo</Label>
                  <Select value={formData.role} onValueChange={(value: 'admin' | 'professor' | 'aluno') => setFormData({ ...formData, role: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aluno">Aluno</SelectItem>
                      <SelectItem value="professor">Professor</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {/* Student Registration field for students - only show when editing */}
              {editingUser && editingUser.role === 'aluno' && (
                <div className="space-y-2">
                  <Label htmlFor="student_registration">Matrícula</Label>
                  <Input
                    id="student_registration"
                    value={formData.student_registration}
                    onChange={(e) => setFormData({ ...formData, student_registration: e.target.value })}
                    placeholder="Matrícula do aluno"
                  />
                </div>
              )}

              {/* Note: Professor-subject assignments are now managed per class in the Classes page */}
              
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Salvando...' : editingUser ? 'Atualizar' : 'Criar'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* User Type Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <Button
              variant={userType === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUserType('all')}
            >
              Todos ({users.length})
            </Button>
            <Button
              variant={userType === 'admin' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUserType('admin')}
            >
              Admins ({users.filter(u => u.role === 'admin').length})
            </Button>
            <Button
              variant={userType === 'professor' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUserType('professor')}
            >
              Professores ({users.filter(u => u.role === 'professor').length})
            </Button>
            <Button
              variant={userType === 'aluno' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUserType('aluno')}
            >
              Alunos ({users.filter(u => u.role === 'aluno').length})
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <UsersIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum usuário encontrado</p>
            </CardContent>
          </Card>
        ) : (
          filteredUsers.map((user) => (
            <Card key={user.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{user.full_name}</h3>
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {getRoleLabel(user.role)}
                      </Badge>
                      {user.status === 'inactive' && (
                        <Badge variant="outline">Inativo</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    {user.student_registration && (
                      <p className="text-sm text-muted-foreground">
                        Matrícula: {user.student_registration}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    {user.role === 'professor' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewSubjects(user)}
                        title="Ver disciplinas do professor"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    {user.role === 'aluno' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEnrollStudent(user)}
                        title="Matricular/Transferir aluno"
                      >
                        <School className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(user)}
                      title="Editar usuário"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(user.id)}
                      title="Excluir usuário"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Teacher Subjects Dialog */}
      <Dialog open={isSubjectsDialogOpen} onOpenChange={setIsSubjectsDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Atribuições de {selectedTeacher?.full_name}
            </DialogTitle>
            <DialogDescription>
              Visualize as disciplinas e turmas onde este professor leciona. Para fazer alterações, edite as turmas individualmente.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-96 overflow-y-auto">
            {teacherSubjects.length === 0 ? (
              <div className="text-center py-8">
                <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Este professor não possui disciplinas atribuídas</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Para atribuir disciplinas, edite as turmas e selecione este professor para as matérias desejadas.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {teacherSubjects.map((subject) => (
                  <Card key={subject.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-lg">{subject.name}</h4>
                          <p className="text-sm text-muted-foreground">Código: {subject.code}</p>
                        </div>
                        <Badge variant="secondary">
                          {subject.classes.length} turma{subject.classes.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Turmas onde leciona esta disciplina:</p>
                        <div className="flex flex-wrap gap-2">
                          {subject.classes.map((classItem) => (
                            <Badge key={classItem.id} variant="outline">
                              {classItem.name} ({classItem.code}) - {classItem.year}
                            </Badge>
                          ))}
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

      {/* Student Enrollment Dialog */}
      <Dialog open={isEnrollmentDialogOpen} onOpenChange={setIsEnrollmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Matricular/Transferir Aluno
            </DialogTitle>
            <DialogDescription>
              Selecione a turma para matricular ou transferir {selectedStudent?.full_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="class_select">Turma</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma turma" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((classItem) => (
                    <SelectItem key={classItem.id} value={classItem.id}>
                      {classItem.name} ({classItem.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setIsEnrollmentDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleEnrollmentSubmit}
                disabled={!selectedClassId}
              >
                Confirmar Matrícula
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}