import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { BookMarked, Users, Clock, GraduationCap, Calendar } from 'lucide-react';

interface MyClass {
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
    description: string;
  };
  student_count: number;
}

export default function MyClasses() {
  const [myClasses, setMyClasses] = useState<MyClass[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isTeacher } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchMyClasses = useCallback(async () => {
    if (!user?.id || !isTeacher) return;

    try {
      // Fetch class subjects where current user is the teacher
      const { data: classSubjectsData, error: classSubjectsError } = await supabase
        .from('class_subjects')
        .select(`
          *,
          classes (name, code, year, semester),
          subjects (name, code, description)
        `)
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });

      if (classSubjectsError) throw classSubjectsError;

      // For each class-subject, count enrolled students
      const classesWithStudentCount = await Promise.all(
        (classSubjectsData || []).map(async (classSubject) => {
          const { count, error: countError } = await supabase
            .from('class_enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', classSubject.class_id);

          if (countError) {
            console.error('Error counting students:', countError);
            return { ...classSubject, student_count: 0 };
          }

          return { ...classSubject, student_count: count || 0 };
        })
      );

      setMyClasses(classesWithStudentCount);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar suas turmas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, isTeacher, toast]);

  useEffect(() => {
    fetchMyClasses();
  }, [fetchMyClasses]);

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
          <p>Carregando suas turmas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-2 mb-6">
        <GraduationCap className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Minhas Turmas</h1>
      </div>

      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{myClasses.length}</div>
                <div className="text-sm text-muted-foreground">Turmas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {myClasses.reduce((acc, cls) => acc + cls.student_count, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Alunos Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {myClasses.reduce((acc, cls) => acc + (cls.workload_hours || 0), 0)}h
                </div>
                <div className="text-sm text-muted-foreground">Carga Horária</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {myClasses.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <BookMarked className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma turma encontrada</h3>
            <p className="text-muted-foreground">
              Você ainda não foi associado a nenhuma turma e disciplina.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Entre em contato com a administração para verificar suas atribuições.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {myClasses.map((classItem) => (
            <Card key={classItem.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {classItem.classes.name}
                  </CardTitle>
                  <Badge variant="secondary">
                    {classItem.classes.code}
                  </Badge>
                </div>
                <CardDescription>
                  {classItem.subjects.name} ({classItem.subjects.code})
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <GraduationCap className="h-4 w-4" />
                    <span>
                      {classItem.classes.year}º ano - {classItem.classes.semester}º semestre
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{classItem.student_count} alunos matriculados</span>
                  </div>
                  
                  {classItem.workload_hours && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{classItem.workload_hours}h semanais</span>
                    </div>
                  )}

                  {classItem.subjects.description && (
                    <div className="mt-3 p-3 bg-muted rounded-md">
                      <p className="text-sm">{classItem.subjects.description}</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-3">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => navigate(`/teacher/class/${classItem.class_id}/grades`)}
                    >
                      <BookMarked className="h-4 w-4 mr-1" />
                      Lançar Notas
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => navigate(`/teacher/class/${classItem.class_id}/attendance`)}
                    >
                      <Calendar className="h-4 w-4 mr-1" />
                      Lançar Faltas
                    </Button>
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