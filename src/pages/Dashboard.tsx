import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  Calendar,
  TrendingUp,
  Award,
  Clock,
  UserCheck
} from 'lucide-react';

interface DashboardStats {
  totalUsers: number;
  activeClasses: number;
  totalSubjects: number;
  attendanceRate: number;
  totalEnrollments: number;
}

interface TeacherStats {
  myClasses: number;
  totalStudents: number;
  pendingGrades: number;
  attendanceToday: number;
  uniqueSubjects: number;
}

export default function Dashboard() {
  const { profile, isAdmin, isTeacher, isStudent, user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeClasses: 0,
    totalSubjects: 0,
    attendanceRate: 0,
    totalEnrollments: 0
  });
  const [teacherStats, setTeacherStats] = useState<TeacherStats>({
    myClasses: 0,
    totalStudents: 0,
    pendingGrades: 0,
    attendanceToday: 0,
    uniqueSubjects: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchTeacherStats = useCallback(async () => {
    if (!isTeacher || !user?.id) return;

    try {
      // Fetch teacher's classes
      const { data: classSubjects, error: classSubjectsError } = await supabase
        .from('class_subjects')
        .select(`
          id,
          class_id,
          subject_id,
          classes (name, code),
          subjects (name, code)
        `)
        .eq('teacher_id', user.id);

      if (classSubjectsError) throw classSubjectsError;

      // Count total students across all classes
      let totalStudents = 0;
      if (classSubjects && classSubjects.length > 0) {
        const classIds = [...new Set(classSubjects.map(cs => cs.class_id))];
        const { count } = await supabase
          .from('class_enrollments')
          .select('*', { count: 'exact', head: true })
          .in('class_id', classIds);
        totalStudents = count || 0;
      }

      // Count grades without evaluation (pending grades)
      const { count: pendingGrades } = await supabase
        .from('grades')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', user.id)
        .is('grade_value', null);

      // Count attendance records for today
      const today = new Date().toISOString().split('T')[0];
      const { count: attendanceToday } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', user.id)
        .eq('absence_date', today);

      // Count unique subjects
      const uniqueSubjects = classSubjects ? [...new Set(classSubjects.map(cs => cs.subject_id))].length : 0;

      setTeacherStats({
        myClasses: classSubjects?.length || 0,
        totalStudents,
        pendingGrades: pendingGrades || 0,
        attendanceToday: attendanceToday || 0,
        uniqueSubjects
      });
    } catch (error) {
      console.error('Error fetching teacher stats:', error);
    }
  }, [isTeacher, user?.id]);

  const fetchDashboardStats = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    try {
      // Fetch total users
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      // Fetch active classes
      const { count: activeClasses } = await supabase
        .from('classes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Fetch total subjects
      const { count: totalSubjects } = await supabase
        .from('subjects')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Fetch total enrollments
      const { count: totalEnrollments } = await supabase
        .from('class_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Calculate attendance rate
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('absence_count, student_id')
        .gte('absence_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

      const { count: totalClassDays } = await supabase
        .from('class_subjects')
        .select('*', { count: 'exact', head: true });

      let attendanceRate = 100;
      if (attendanceData && totalClassDays && totalEnrollments) {
        const totalAbsences = attendanceData.reduce((sum, record) => sum + record.absence_count, 0);
        const estimatedTotalClasses = totalClassDays * totalEnrollments * 20; // Aproximação de 20 dias de aula no mês
        if (estimatedTotalClasses > 0) {
          attendanceRate = Math.max(0, ((estimatedTotalClasses - totalAbsences) / estimatedTotalClasses) * 100);
        }
      }

      setStats({
        totalUsers: totalUsers || 0,
        activeClasses: activeClasses || 0,
        totalSubjects: totalSubjects || 0,
        attendanceRate: Math.round(attendanceRate * 10) / 10,
        totalEnrollments: totalEnrollments || 0
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchDashboardStats();
    } else if (isTeacher) {
      fetchTeacherStats();
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [fetchDashboardStats, fetchTeacherStats, isAdmin, isTeacher]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const getRoleSpecificContent = () => {
    if (isAdmin) {
      return (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? <div className="h-8 w-16 bg-muted rounded animate-pulse" /> : stats.totalUsers}</div>
                <p className="text-xs text-muted-foreground">
                  Administradores, professores e alunos
                </p>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Turmas Ativas</CardTitle>
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? <div className="h-8 w-16 bg-muted rounded animate-pulse" /> : stats.activeClasses}</div>
                <p className="text-xs text-muted-foreground">
                  Com {loading ? <div className="h-4 w-8 bg-muted rounded animate-pulse inline-block" /> : stats.totalEnrollments} matrículas
                </p>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Matérias</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? <div className="h-8 w-16 bg-muted rounded animate-pulse" /> : stats.totalSubjects}</div>
                <p className="text-xs text-muted-foreground">
                  Disciplinas ativas
                </p>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Frequência</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? <div className="h-8 w-16 bg-muted rounded animate-pulse" /> : `${stats.attendanceRate}%`}</div>
                <p className="text-xs text-muted-foreground">
                  Últimos 30 dias
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Ações Rápidas</CardTitle>
                <CardDescription>
                  Principais funcionalidades administrativas
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <Link to="/users" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Gerenciar Usuários</p>
                    <p className="text-sm text-muted-foreground">Criar e editar contas</p>
                  </div>
                </Link>
                <Link to="/classes" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Administrar Turmas</p>
                    <p className="text-sm text-muted-foreground">Criar e organizar turmas</p>
                  </div>
                </Link>
                <Link to="/subjects" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Configurar Matérias</p>
                    <p className="text-sm text-muted-foreground">Gerenciar currículo</p>
                  </div>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Atividades Recentes</CardTitle>
                <CardDescription>
                  Últimas ações no sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="text-sm">
                      <p className="font-medium">Nova turma criada</p>
                      <p className="text-muted-foreground">3º Ano A - há 2 horas</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div className="text-sm">
                      <p className="font-medium">Professor cadastrado</p>
                      <p className="text-muted-foreground">Maria Silva - há 4 horas</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <div className="text-sm">
                      <p className="font-medium">Sistema atualizado</p>
                      <p className="text-muted-foreground">Versão 2.1.0 - ontem</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      );
    }

    if (isTeacher) {
      return (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Minhas Turmas</CardTitle>
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? <div className="h-8 w-16 bg-muted rounded animate-pulse" /> : teacherStats.myClasses}</div>
                <p className="text-xs text-muted-foreground">
                  {teacherStats.totalStudents} alunos no total
                </p>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Aulas Hoje</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? <div className="h-8 w-16 bg-muted rounded animate-pulse" /> : teacherStats.attendanceToday}</div>
                <p className="text-xs text-muted-foreground">
                  Registros de hoje
                </p>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Notas Pendentes</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? <div className="h-8 w-16 bg-muted rounded animate-pulse" /> : teacherStats.pendingGrades}</div>
                <p className="text-xs text-muted-foreground">
                  Notas pendentes
                </p>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Notas Lançadas</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">85%</div>
                <p className="text-xs text-muted-foreground">
                  Meta: 100%
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Turmas de Hoje</CardTitle>
                <CardDescription>
                  Suas aulas programadas para hoje
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">1º Ano A - Matemática</p>
                      <p className="text-sm text-muted-foreground">30 alunos</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">08:00 - 08:50</p>
                      <p className="text-sm text-green-600">Concluída</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">2º Ano B - Matemática</p>
                      <p className="text-sm text-muted-foreground">28 alunos</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">14:00 - 14:50</p>
                      <p className="text-sm text-blue-600">Próxima</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ações Pendentes</CardTitle>
                <CardDescription>
                  Tarefas que precisam da sua atenção
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Link to="/attendance" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors">
                    <Calendar className="h-5 w-5 text-orange-500" />
                    <div>
                      <p className="font-medium">Registrar frequência</p>
                      <p className="text-sm text-muted-foreground">3 aulas pendentes</p>
                    </div>
                  </Link>
                  <Link to="/grades" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors">
                    <Award className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium">Lançar notas</p>
                      <p className="text-sm text-muted-foreground">Avaliação mensal</p>
                    </div>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      );
    }

    if (isStudent) {
      return (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Matérias</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? <div className="h-8 w-16 bg-muted rounded animate-pulse" /> : teacherStats.uniqueSubjects}</div>
                <p className="text-xs text-muted-foreground">
                  Disciplinas que leciona
                </p>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Frequência</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">92%</div>
                <p className="text-xs text-success">
                  Acima da média
                </p>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Média Geral</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">8.5</div>
                <p className="text-xs text-success">
                  Bom desempenho
                </p>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Próximas Aulas</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">5</div>
                <p className="text-xs text-muted-foreground">
                  Hoje
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Próximas Aulas</CardTitle>
                <CardDescription>
                  Sua agenda de hoje
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Matemática</p>
                      <p className="text-sm text-muted-foreground">Prof. João Silva</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">14:00</p>
                      <p className="text-sm text-blue-600">Sala 201</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">História</p>
                      <p className="text-sm text-muted-foreground">Prof. Maria Costa</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">15:00</p>
                      <p className="text-sm text-blue-600">Sala 105</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Últimas Notas</CardTitle>
                <CardDescription>
                  Avaliações recentes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Matemática - Prova</p>
                      <p className="text-sm text-muted-foreground">15/03/2024</p>
                    </div>
                    <div className="text-lg font-bold text-green-600">9.0</div>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">História - Trabalho</p>
                      <p className="text-sm text-muted-foreground">12/03/2024</p>
                    </div>
                    <div className="text-lg font-bold text-green-600">8.5</div>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Português - Redação</p>
                      <p className="text-sm text-muted-foreground">10/03/2024</p>
                    </div>
                    <div className="text-lg font-bold text-orange-600">7.0</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {getGreeting()}, {profile?.full_name?.split(' ')[0]}!
        </h1>
        <p className="text-muted-foreground">
          {isAdmin && 'Painel administrativo do HighSchool Connect'}
          {isTeacher && 'Seus recursos como professor'}
          {isStudent && 'Acompanhe seu progresso acadêmico'}
        </p>
      </div>

      {/* Role-specific content */}
      {getRoleSpecificContent()}
    </div>
  );
}