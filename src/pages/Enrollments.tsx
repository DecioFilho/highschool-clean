import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { UserCheck, Plus, Trash2 } from 'lucide-react';

interface Enrollment {
  id: string;
  student_id: string;
  class_id: string;
  status: 'active' | 'inactive';
  enrollment_date: string;
  student: {
    full_name: string;
    email: string;
    student_registration?: string;
  };
  class: {
    name: string;
    code: string;
    year: number;
  };
}

interface Student {
  id: string;
  full_name: string;
  email: string;
  student_registration?: string;
}

interface Class {
  id: string;
  name: string;
  code: string;
  year: number;
}

export default function Enrollments() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    student_id: '',
    class_id: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch enrollments with student and class data
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('class_enrollments')
        .select(`
          *,
          student:users!class_enrollments_student_id_fkey(full_name, email, student_registration),
          class:classes!class_enrollments_class_id_fkey(name, code, year)
        `)
        .order('enrollment_date', { ascending: false });

      if (enrollmentsError) throw enrollmentsError;
      setEnrollments(enrollmentsData || []);

      // Fetch students for dropdown
      const { data: studentsData, error: studentsError } = await supabase
        .from('users')
        .select('id, full_name, email, student_registration')
        .eq('role', 'aluno')
        .eq('status', 'active');

      if (studentsError) throw studentsError;
      setStudents(studentsData || []);

      // Fetch classes for dropdown
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id, name, code, year')
        .eq('status', 'active');

      if (classesError) throw classesError;
      setClasses(classesData || []);

    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check if enrollment already exists
      const { data: existing } = await supabase
        .from('class_enrollments')
        .select('id')
        .eq('student_id', formData.student_id)
        .eq('class_id', formData.class_id)
        .eq('status', 'active')
        .single();

      if (existing) {
        toast({
          title: 'Erro',
          description: 'Este aluno já está matriculado nesta turma',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('class_enrollments')
        .insert([{
          student_id: formData.student_id,
          class_id: formData.class_id
        }]);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Matrícula realizada com sucesso',
      });

      setIsDialogOpen(false);
      setFormData({ student_id: '', class_id: '' });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao realizar matrícula',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (enrollmentId: string) => {
    if (!confirm('Tem certeza que deseja cancelar esta matrícula?')) return;

    try {
      const { error } = await supabase
        .from('class_enrollments')
        .update({ status: 'inactive' })
        .eq('id', enrollmentId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Matrícula cancelada com sucesso',
      });
      
      fetchData();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao cancelar matrícula',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Matrículas</h1>
          <p className="text-muted-foreground">
            Gerencie as matrículas dos alunos nas turmas
          </p>
        </div>
        
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setFormData({ student_id: '', class_id: '' });
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Matrícula
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Matrícula</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="student_id">Aluno</Label>
                  <Select value={formData.student_id} onValueChange={(value) => setFormData({ ...formData, student_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um aluno" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.full_name} ({student.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="class_id">Turma</Label>
                  <Select value={formData.class_id} onValueChange={(value) => setFormData({ ...formData, class_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma turma" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((classItem) => (
                        <SelectItem key={classItem.id} value={classItem.id}>
                          {classItem.name} ({classItem.code}) - {classItem.year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button type="submit" className="w-full" disabled={loading || !formData.student_id || !formData.class_id}>
                  {loading ? 'Matriculando...' : 'Matricular'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
        ) : enrollments.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <UserCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma matrícula encontrada</p>
            </CardContent>
          </Card>
        ) : (
          enrollments.map((enrollment) => (
            <Card key={enrollment.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{enrollment.student.full_name}</h3>
                      <Badge variant={enrollment.status === 'active' ? 'default' : 'outline'}>
                        {enrollment.status === 'active' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{enrollment.student.email}</p>
                    {enrollment.student.student_registration && (
                      <p className="text-sm text-muted-foreground">
                        Matrícula: {enrollment.student.student_registration}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary">
                        {enrollment.class.name} ({enrollment.class.code})
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {enrollment.class.year}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Matriculado em: {new Date(enrollment.enrollment_date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  
                  {isAdmin && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(enrollment.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}