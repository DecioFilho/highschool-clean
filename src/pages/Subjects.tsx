import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, Plus, Edit, Trash2 } from 'lucide-react';

interface Subject {
  id: string;
  name: string;
  code: string;
  description?: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export default function Subjects() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: ''
  });

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .order('name');

      if (error) throw error;
      setSubjects(data || []);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar matérias',
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
      if (editingSubject) {
        const { error } = await supabase
          .from('subjects')
          .update({
            name: formData.name,
            code: formData.code,
            description: formData.description
          })
          .eq('id', editingSubject.id);

        if (error) throw error;
        
        toast({
          title: 'Sucesso',
          description: 'Matéria atualizada com sucesso',
        });
      } else {
        const { error } = await supabase
          .from('subjects')
          .insert([{
            name: formData.name,
            code: formData.code,
            description: formData.description
          }]);

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Matéria criada com sucesso',
        });
      }

      setIsDialogOpen(false);
      setEditingSubject(null);
      setFormData({ name: '', code: '', description: '' });
      fetchSubjects();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao salvar matéria',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (subject: Subject) => {
    setEditingSubject(subject);
    setFormData({
      name: subject.name,
      code: subject.code,
      description: subject.description || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (subjectId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta matéria?')) return;

    try {
      const { error } = await supabase
        .from('subjects')
        .update({ status: 'inactive' })
        .eq('id', subjectId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Matéria desativada com sucesso',
      });
      
      fetchSubjects();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao desativar matéria',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Matérias</h1>
          <p className="text-muted-foreground">
            Gerencie as matérias do sistema
          </p>
        </div>
        
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingSubject(null);
                setFormData({ name: '', code: '', description: '' });
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Matéria
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingSubject ? 'Editar Matéria' : 'Nova Matéria'}
                </DialogTitle>
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
                
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Salvando...' : editingSubject ? 'Atualizar' : 'Criar'}
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
          ) : subjects.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma matéria encontrada</p>
            </div>
          ) : (
            <div className="divide-y">
              {subjects.map((subject) => (
                <div key={subject.id} className="flex items-center justify-between p-6 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <BookOpen className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">{subject.name}</h3>
                        {subject.status === 'inactive' && (
                          <Badge variant="outline">Inativo</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Código: {subject.code}
                      </p>
                      {subject.description && (
                        <p className="text-sm text-muted-foreground">
                          {subject.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {isAdmin && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(subject)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(subject.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}