import { useState, useEffect, useCallback } from 'react';
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
import { School, Plus, Edit, Trash2, Users } from 'lucide-react';

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

export default function Classes() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
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
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar turmas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingClass) {
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
        
        toast({
          title: 'Sucesso',
          description: 'Turma atualizada com sucesso',
        });
      } else {
        const { error } = await supabase
          .from('classes')
          .insert([{
            name: formData.name,
            code: formData.code,
            description: formData.description,
            year: formData.year,
            semester: formData.semester
          }]);

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Turma criada com sucesso',
        });
      }

      setIsDialogOpen(false);
      setEditingClass(null);
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

  const handleEdit = (classItem: Class) => {
    setEditingClass(classItem);
    setFormData({
      name: classItem.name,
      code: classItem.code,
      description: classItem.description || '',
      year: classItem.year,
      semester: classItem.semester || 1
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (classId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta turma?')) return;

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
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Users className="h-4 w-4 mr-1" />
                      <span>Ver alunos</span>
                    </div>
                    
                    {isAdmin && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(classItem)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(classItem.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}