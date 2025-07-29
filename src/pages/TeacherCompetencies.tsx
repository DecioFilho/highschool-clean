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
import { BookOpen, Plus, Trash2 } from 'lucide-react';

interface TeacherCompetency {
  id: string;
  teacher_id: string;
  subject_id: string;
  created_at: string;
  teacher: {
    full_name: string;
    email: string;
  };
  subject: {
    name: string;
    code: string;
  };
}

interface Teacher {
  id: string;
  full_name: string;
  email: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
}

export default function TeacherCompetencies() {
  const [competencies, setCompetencies] = useState<TeacherCompetency[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    teacher_id: '',
    subject_id: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch competencies with teacher and subject data
      const { data: competenciesData, error: competenciesError } = await supabase
        .from('teacher_competencies')
        .select(`
          *,
          teacher:users!teacher_competencies_teacher_id_fkey(full_name, email),
          subject:subjects!teacher_competencies_subject_id_fkey(name, code)
        `)
        .order('created_at', { ascending: false });

      if (competenciesError) throw competenciesError;
      setCompetencies(competenciesData || []);

      // Fetch teachers for dropdown
      const { data: teachersData, error: teachersError } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('role', 'professor')
        .eq('status', 'active');

      if (teachersError) throw teachersError;
      setTeachers(teachersData || []);

      // Fetch subjects for dropdown
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('id, name, code')
        .eq('status', 'active');

      if (subjectsError) throw subjectsError;
      setSubjects(subjectsData || []);

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
      // Check if competency already exists
      const { data: existing } = await supabase
        .from('teacher_competencies')
        .select('id')
        .eq('teacher_id', formData.teacher_id)
        .eq('subject_id', formData.subject_id)
        .single();

      if (existing) {
        toast({
          title: 'Erro',
          description: 'Este professor já tem competência nesta matéria',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('teacher_competencies')
        .insert([{
          teacher_id: formData.teacher_id,
          subject_id: formData.subject_id
        }]);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Competência adicionada com sucesso',
      });

      setIsDialogOpen(false);
      setFormData({ teacher_id: '', subject_id: '' });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao adicionar competência',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (competencyId: string) => {
    if (!confirm('Tem certeza que deseja remover esta competência?')) return;

    try {
      const { error } = await supabase
        .from('teacher_competencies')
        .delete()
        .eq('id', competencyId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Competência removida com sucesso',
      });
      
      fetchData();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao remover competência',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Competências dos Professores</h1>
          <p className="text-muted-foreground">
            Gerencie as competências dos professores por matéria
          </p>
        </div>
        
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setFormData({ teacher_id: '', subject_id: '' });
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Competência
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Competência</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="teacher_id">Professor</Label>
                  <Select value={formData.teacher_id} onValueChange={(value) => setFormData({ ...formData, teacher_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um professor" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.full_name} ({teacher.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="subject_id">Matéria</Label>
                  <Select value={formData.subject_id} onValueChange={(value) => setFormData({ ...formData, subject_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma matéria" />
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
                
                <Button type="submit" className="w-full" disabled={loading || !formData.teacher_id || !formData.subject_id}>
                  {loading ? 'Adicionando...' : 'Adicionar Competência'}
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
        ) : competencies.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma competência encontrada</p>
            </CardContent>
          </Card>
        ) : (
          competencies.map((competency) => (
            <Card key={competency.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{competency.teacher.full_name}</h3>
                      <Badge variant="secondary">Professor</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{competency.teacher.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="default">
                        {competency.subject.name} ({competency.subject.code})
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Adicionado em: {new Date(competency.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  
                  {isAdmin && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(competency.id)}
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