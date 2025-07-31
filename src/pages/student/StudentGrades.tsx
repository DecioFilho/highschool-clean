import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, GraduationCap } from 'lucide-react';

interface Grade {
  id: string;
  grade_value: number;
  grade_type: string;
  evaluation_date: string;
  class_subject_id: string;
  subject_name: string;
  subject_code: string;
  class_name: string;
  teacher_name: string;
}

interface Subject {
  subject_id: string;
  subject_name: string;
  subject_code: string;
}

export default function StudentGrades() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const { user, isStudent } = useAuth();
  const { toast } = useToast();

  const fetchGrades = useCallback(async () => {
    if (!user?.id || !isStudent) return;

    try {
      // Fetch all grades for the current student
      const { data: gradesData, error: gradesError } = await supabase
        .from('grades')
        .select(`
          id,
          grade_value,
          grade_type,
          evaluation_date,
          class_subject_id,
          class_subjects (
            subjects (name, code),
            classes (name),
            users (full_name)
          )
        `)
        .eq('student_id', user.id)
        .order('evaluation_date', { ascending: false });

      if (gradesError) throw gradesError;

      // Transform data for easier use
      const transformedGrades = gradesData?.map(grade => ({
        id: grade.id,
        grade_value: grade.grade_value,
        grade_type: grade.grade_type,
        evaluation_date: grade.evaluation_date,
        class_subject_id: grade.class_subject_id,
        subject_name: grade.class_subjects.subjects.name,
        subject_code: grade.class_subjects.subjects.code,
        class_name: grade.class_subjects.classes.name,
        teacher_name: grade.class_subjects.users.full_name
      })) || [];

      setGrades(transformedGrades);

      // Extract unique subjects for filter
      const uniqueSubjects = transformedGrades.reduce((acc: Subject[], grade) => {
        const existingSubject = acc.find(s => s.subject_name === grade.subject_name);
        if (!existingSubject) {
          acc.push({
            subject_id: grade.class_subject_id, // Using class_subject_id as identifier
            subject_name: grade.subject_name,
            subject_code: grade.subject_code
          });
        }
        return acc;
      }, []);

      setSubjects(uniqueSubjects);
    } catch (error) {
      console.error('Error fetching grades:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar suas notas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, isStudent, toast]);

  useEffect(() => {
    fetchGrades();
  }, [fetchGrades]);

  // Filter grades by selected subject
  const filteredGrades = selectedSubject === 'all' 
    ? grades 
    : grades.filter(grade => grade.subject_name === selectedSubject);

  // Calculate weighted average grade
  const calculateWeightedAverage = (gradesList: Grade[]) => {
    if (gradesList.length === 0) return 0;
    
    let totalWeightedGrade = 0;
    let totalWeight = 0;
    
    gradesList.forEach(grade => {
      let weight = 1;
      switch (grade.grade_type) {
        case 'prova':
          weight = 3;
          break;
        case 'trabalho':
          weight = 2;
          break;
        case 'recuperacao':
          weight = 5;
          break;
        default:
          weight = 1;
      }
      totalWeightedGrade += grade.grade_value * weight;
      totalWeight += weight;
    });
    
    return totalWeight > 0 ? totalWeightedGrade / totalWeight : 0;
  };

  const averageGrade = calculateWeightedAverage(filteredGrades).toFixed(1);

  const getGradeColor = (grade: number) => {
    if (grade >= 8) return 'bg-green-100 text-green-800';
    if (grade >= 6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getTypeLabel = (type: string) => {
    const types: { [key: string]: string } = {
      prova: 'Prova (peso 3)',
      trabalho: 'Trabalho (peso 2)',
      participacao: 'Participação',
      projeto: 'Projeto',
      recuperacao: 'Prova Final (peso 5)'
    };
    return types[type] || type;
  };

  if (!isStudent) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-6">
          <CardContent>
            <p className="text-center text-muted-foreground">
              Esta página é restrita para alunos.
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
          <p>Carregando suas notas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <BookOpen className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Minhas Notas</h1>
      </div>

      {/* Summary Card */}
      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumo Acadêmico</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{filteredGrades.length}</div>
                <div className="text-sm text-muted-foreground">
                  {selectedSubject === 'all' ? 'Total de Notas' : 'Notas da Disciplina'}
                </div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${parseFloat(averageGrade) >= 6 ? 'text-green-600' : 'text-red-600'}`}>
                  {averageGrade}
                </div>
                <div className="text-sm text-muted-foreground">Média Geral</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{subjects.length}</div>
                <div className="text-sm text-muted-foreground">Disciplinas</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">Filtrar por disciplina:</label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as disciplinas</SelectItem>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.subject_id} value={subject.subject_name}>
                      {subject.subject_name} ({subject.subject_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grades Table */}
      {filteredGrades.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma nota encontrada</h3>
            <p className="text-muted-foreground">
              {selectedSubject === 'all' 
                ? 'Você ainda não possui notas lançadas.'
                : `Você ainda não possui notas para ${selectedSubject}.`
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedSubject === 'all' ? 'Todas as Notas' : `Notas - ${selectedSubject}`}
            </CardTitle>
            <CardDescription>
              Suas notas organizadas por data de avaliação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Disciplina</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Professor</TableHead>
                  <TableHead>Turma</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGrades.map((grade) => (
                  <TableRow key={grade.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{grade.subject_name}</div>
                        <div className="text-sm text-muted-foreground">{grade.subject_code}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getTypeLabel(grade.grade_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getGradeColor(grade.grade_value)}>
                        {grade.grade_value.toFixed(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(grade.evaluation_date).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-sm">{grade.teacher_name}</TableCell>
                    <TableCell className="text-sm">{grade.class_name}</TableCell>
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