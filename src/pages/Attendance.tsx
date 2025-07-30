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
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Plus, Edit, Trash2, Filter, CheckCircle, XCircle } from 'lucide-react';

interface Attendance {
  id: string;
  student_id: string;
  class_subject_id: string;
  teacher_id: string;
  absence_date: string;
  absence_count: number;
  justified: boolean;
  justification?: string;
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

export default function Attendance() {
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<Attendance[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Attendance | null>(null);
  const { isAdmin, isTeacher, user } = useAuth();
  const { toast } = useToast();

  // Filters
  const [filters, setFilters] = useState({
    class_subject_id: '',
    student_id: '',
    teacher_id: '',
    justified: '',
    date_from: '',
    date_to: ''
  });

  const [formData, setFormData] = useState({
    student_id: '',
    class_subject_id: '',
    teacher_id: '',
    absence_date: new Date().toISOString().split('T')[0],
    absence_count: '1',
    justified: false,
    justification: ''
  });

  const fetchData = useCallback(async () => {
    try {
      // Build query based on user role
      let attendanceQuery = supabase
        .from('attendance')
        .select(`
          *,
          student:users!attendance_student_id_fkey (full_name, student_registration),
          teacher:users!attendance_teacher_id_fkey (full_name),
          class_subject:class_subjects (
            id,
            classes (name, code),
            subjects (name, code)
          )
        `);

      // Filter by teacher if user is a teacher
      if (isTeacher && user?.id) {
        attendanceQuery = attendanceQuery.eq('teacher_id', user.id);
      }

      const { data: attendanceData, error: attendanceError } = await attendanceQuery
        .order('absence_date', { ascending: false });

      if (attendanceError) throw attendanceError;

      // Fetch class subjects for form
      const { data: classSubjectsData, error: classSubjectsError } = await supabase
        .from('class_subjects')
        .select(`
          id,
          classes (name, code),
          subjects (name, code)
        `)
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

      setAttendanceRecords(attendanceData || []);
      setFilteredRecords(attendanceData || []);
      setClassSubjects(classSubjectsData || []);
      setStudents(studentsData || []);
      setTeachers(teachersData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados de frequência.",
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
    let filtered = attendanceRecords;

    if (filters.class_subject_id) {
      filtered = filtered.filter(record => record.class_subject_id === filters.class_subject_id);
    }
    if (filters.student_id) {
      filtered = filtered.filter(record => record.student_id === filters.student_id);
    }
    if (filters.teacher_id) {
      filtered = filtered.filter(record => record.teacher_id === filters.teacher_id);
    }
    if (filters.justified !== '') {
      const isJustified = filters.justified === 'true';
      filtered = filtered.filter(record => record.justified === isJustified);
    }
    if (filters.date_from) {
      filtered = filtered.filter(record => record.absence_date >= filters.date_from);
    }
    if (filters.date_to) {
      filtered = filtered.filter(record => record.absence_date <= filters.date_to);
    }

    setFilteredRecords(filtered);
  }, [attendanceRecords, filters]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const absenceCount = parseInt(formData.absence_count);
      
      // Validate absence count
      if (absenceCount <= 0) {
        toast({
          title: "Erro de Validação",
          description: "A quantidade de faltas deve ser maior que zero.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const attendanceData = {
        student_id: formData.student_id,
        class_subject_id: formData.class_subject_id,
        teacher_id: formData.teacher_id,
        absence_date: formData.absence_date,
        absence_count: absenceCount,
        justified: formData.justified,
        justification: formData.justified ? formData.justification : null
      };

      if (editingRecord) {
        const { error } = await supabase
          .from('attendance')
          .update(attendanceData)
          .eq('id', editingRecord.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Registro de frequência atualizado com sucesso.",
        });
      } else {
        const { error } = await supabase
          .from('attendance')
          .insert([attendanceData]);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Registro de frequência criado com sucesso.",
        });
      }

      setIsDialogOpen(false);
      setEditingRecord(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar registro de frequência.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record: Attendance) => {
    setEditingRecord(record);
    setFormData({
      student_id: record.student_id,
      class_subject_id: record.class_subject_id,
      teacher_id: record.teacher_id,
      absence_date: record.absence_date,
      absence_count: record.absence_count.toString(),
      justified: record.justified,
      justification: record.justification || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este registro de frequência?')) return;

    try {
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Registro de frequência excluído com sucesso.",
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting attendance:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir registro de frequência.",
        variant: "destructive",
      });
    }
  };

  const handleJustify = async (record: Attendance, justified: boolean, justification?: string) => {
    try {
      const { error } = await supabase
        .from('attendance')
        .update({
          justified,
          justification: justified ? justification : null
        })
        .eq('id', record.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Falta ${justified ? 'justificada' : 'não justificada'} com sucesso.`,
      });
      fetchData();
    } catch (error) {
      console.error('Error updating attendance:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar justificativa.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      student_id: '',
      class_subject_id: '',
      teacher_id: '',
      absence_date: new Date().toISOString().split('T')[0],
      absence_count: '1',
      justified: false,
      justification: ''
    });
  };

  const openCreateDialog = () => {
    setEditingRecord(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const clearFilters = () => {
    setFilters({
      class_subject_id: '',
      student_id: '',
      teacher_id: '',
      justified: '',
      date_from: '',
      date_to: ''
    });
  };

  // Calculate attendance statistics
  const totalAbsences = filteredRecords.reduce((sum, record) => sum + record.absence_count, 0);
  const justifiedAbsences = filteredRecords
    .filter(record => record.justified)
    .reduce((sum, record) => sum + record.absence_count, 0);
  const unjustifiedAbsences = totalAbsences - justifiedAbsences;

  if (loading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Frequência</h1>
          <p className="text-muted-foreground">
            Visualize e gerencie a frequência dos estudantes
          </p>
        </div>
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Registrar Falta
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {editingRecord ? 'Editar Registro' : 'Registrar Falta'}
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
                    <Label htmlFor="absence_date">Data da Falta</Label>
                    <Input
                      id="absence_date"
                      type="date"
                      value={formData.absence_date}
                      onChange={(e) => setFormData({ ...formData, absence_date: e.target.value })}
                      autocomplete="off"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="absence_count">Quantidade de Faltas</Label>
                  <Input
                    id="absence_count"
                    type="number"
                    min="1"
                    value={formData.absence_count}
                    onChange={(e) => setFormData({ ...formData, absence_count: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="justified"
                      checked={formData.justified}
                      onCheckedChange={(checked) => setFormData({ ...formData, justified: !!checked })}
                    />
                    <Label htmlFor="justified">Falta justificada</Label>
                  </div>
                </div>

                {formData.justified && (
                  <div className="space-y-2">
                    <Label htmlFor="justification">Justificativa</Label>
                    <Textarea
                      id="justification"
                      value={formData.justification}
                      onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                      placeholder="Descreva a justificativa para a falta..."
                      required
                    />
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Salvando...' : editingRecord ? 'Atualizar' : 'Registrar'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Faltas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAbsences}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faltas Justificadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{justifiedAbsences}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faltas Não Justificadas</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{unjustifiedAbsences}</div>
          </CardContent>
        </Card>
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
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
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

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={filters.justified}
                onValueChange={(value) => setFilters({ ...filters, justified: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  <SelectItem value="true">Justificadas</SelectItem>
                  <SelectItem value="false">Não Justificadas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Data Final</Label>
              <Input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-4">
            <Button variant="outline" onClick={clearFilters}>
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Registros de Frequência ({filteredRecords.length})
          </CardTitle>
          <CardDescription>
            Lista de todos os registros de frequência no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredRecords.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum registro de frequência encontrado.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Turma</TableHead>
                    <TableHead>Disciplina</TableHead>
                    <TableHead>Professor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Faltas</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && <TableHead>Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{record.student.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {record.student.student_registration}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{record.class_subject.classes.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {record.class_subject.classes.code}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{record.class_subject.subjects.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {record.class_subject.subjects.code}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{record.teacher.full_name}</TableCell>
                      <TableCell>
                        {new Date(record.absence_date).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {record.absence_count}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant={record.justified ? "default" : "destructive"}>
                            {record.justified ? "Justificada" : "Não Justificada"}
                          </Badge>
                          {record.justified && record.justification && (
                            <p className="text-xs text-muted-foreground max-w-xs truncate">
                              {record.justification}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(record)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {!record.justified && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const justification = prompt('Digite a justificativa:');
                                  if (justification) {
                                    handleJustify(record, true, justification);
                                  }
                                }}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(record.id)}
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