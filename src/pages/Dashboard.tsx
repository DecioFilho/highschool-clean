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

interface StudentStats {
  attendanceRate: number;
  averageGrade: number;
  totalSubjects: number;
}

interface RecentActivity {
  id: string;
  type: 'user_created' | 'class_created' | 'grade_added' | 'enrollment_created';
  description: string;
  time: string;
  user?: string;
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
  const [studentStats, setStudentStats] = useState<StudentStats>({
    attendanceRate: 0,
    averageGrade: 0,
    totalSubjects: 0
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
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

  const fetchRecentActivities = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const activities: RecentActivity[] = [];
      const now = new Date();
      
      // Recent users (last 7 days)
      const { data: recentUsers } = await supabase
        .from('users')
        .select('id, full_name, role, created_at')
        .gte('created_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(3);

      recentUsers?.forEach(user => {
        activities.push({
          id: user.id,
          type: 'user_created',
          description: `${user.role === 'professor' ? 'Professor' : user.role === 'aluno' ? 'Aluno' : 'Admin'} cadastrado: ${user.full_name}`,
          time: user.created_at,
          user: user.full_name
        });
      });

      // Recent classes (last 7 days)
      const { data: recentClasses } = await supabase
        .from('classes')
        .select('id, name, code, created_at')
        .gte('created_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(3);

      recentClasses?.forEach(cls => {
        activities.push({
          id: cls.id,
          type: 'class_created',
          description: `Nova turma criada: ${cls.name} (${cls.code})`,
          time: cls.created_at
        });
      });

      // Recent enrollments (last 7 days)
      const { data: recentEnrollments } = await supabase
        .from('class_enrollments')
        .select(`
          id, enrollment_date,
          student:users!class_enrollments_student_id_fkey(full_name),
          class:classes!class_enrollments_class_id_fkey(name)
        `)
        .gte('enrollment_date', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('enrollment_date', { ascending: false })
        .limit(2);

      recentEnrollments?.forEach(enrollment => {
        activities.push({
          id: enrollment.id,
          type: 'enrollment_created',
          description: `Matrícula realizada: ${enrollment.student.full_name} em ${enrollment.class.name}`,
          time: enrollment.enrollment_date
        });
      });

      // Sort all activities by time and limit to 5 most recent
      const sortedActivities = activities
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        .slice(0, 5);

      setRecentActivities(sortedActivities);
    } catch (error) {
      console.error('Error fetching recent activities:', error);
    }
  }, [isAdmin]);

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

  const fetchStudentStats = useCallback(async () => {
    if (!isStudent || !user?.id) return;

    try {
      // Fetch student's grades and calculate average with weights
      const { data: gradesData } = await supabase
        .from('grades')
        .select('grade_value, grade_type')
        .eq('student_id', user.id);

      let totalWeightedGrade = 0;
      let totalWeight = 0;

      if (gradesData && gradesData.length > 0) {
        gradesData.forEach(grade => {
          let weight = 1; // default weight
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
      }

      const averageGrade = totalWeight > 0 ? totalWeightedGrade / totalWeight : 0;

      // Fetch student's attendance data
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('absence_count')
        .eq('student_id', user.id);

      // Calculate total classes (estimate based on enrollments and time)
      const { data: enrollmentsData } = await supabase
        .from('class_enrollments')
        .select('class_id')
        .eq('student_id', user.id)
        .eq('status', 'active');

      const totalClasses = (enrollmentsData?.length || 0) * 20; // Estimate 20 classes per subject
      const totalAbsences = attendanceData?.reduce((sum, record) => sum + record.absence_count, 0) || 0;
      const attendanceRate = totalClasses > 0 ? Math.max(0, ((totalClasses - totalAbsences) / totalClasses) * 100) : 100;

      setStudentStats({
        attendanceRate: Math.round(attendanceRate),
        averageGrade: averageGrade,
        totalSubjects: enrollmentsData?.length || 0
      });

    } catch (error) {
      console.error('Error fetching student stats:', error);
    }
  }, [isStudent, user?.id]);

  useEffect(() => {
    if (isAdmin) {
      fetchDashboardStats();
      fetchRecentActivities();
    } else if (isTeacher) {
      fetchTeacherStats();
      setLoading(false);
    } else if (isStudent) {
      fetchStudentStats();
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [fetchDashboardStats, fetchTeacherStats, fetchRecentActivities, fetchStudentStats, isAdmin, isTeacher, isStudent]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `há ${diffInMinutes} minuto${diffInMinutes !== 1 ? 's' : ''}`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `há ${diffInHours} hora${diffInHours !== 1 ? 's' : ''}`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `há ${diffInDays} dia${diffInDays !== 1 ? 's' : ''}`;
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'user_created': return 'bg-blue-500';
      case 'class_created': return 'bg-green-500';
      case 'grade_added': return 'bg-yellow-500';
      case 'enrollment_created': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
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
                  {loading ? (
                    <div className="space-y-3">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-muted rounded-full animate-pulse"></div>
                          <div className="space-y-1 flex-1">
                            <div className="h-4 bg-muted rounded animate-pulse"></div>
                            <div className="h-3 bg-muted rounded animate-pulse w-2/3"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : recentActivities.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <p>Nenhuma atividade recente</p>
                    </div>
                  ) : (
                    recentActivities.map((activity) => (
                      <div key={activity.id} className="flex items-center gap-3">
                        <div className={`w-2 h-2 ${getActivityColor(activity.type)} rounded-full`}></div>
                        <div className="text-sm">
                          <p className="font-medium">{activity.description}</p>
                          <p className="text-muted-foreground">{getTimeAgo(activity.time)}</p>
                        </div>
                      </div>
                    ))
                  )}
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
          <div className="grid gap-4 md:grid-cols-1">
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
          </div>

          <div className="grid gap-4 md:grid-cols-1">
            <Card>
              <CardHeader>
                <CardTitle>Ações Rápidas</CardTitle>
                <CardDescription>
                  Funcionalidades principais para professores
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Link to="/my-classes" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors">
                    <Calendar className="h-5 w-5 text-orange-500" />
                    <div>
                      <p className="font-medium">Registrar frequência</p>
                      <p className="text-sm text-muted-foreground">Acesse suas turmas</p>
                    </div>
                  </Link>
                  <Link to="/my-classes" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors">
                    <Award className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium">Lançar notas</p>
                      <p className="text-sm text-muted-foreground">Acesse suas turmas</p>
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
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Frequência</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? <div className="h-8 w-16 bg-muted rounded animate-pulse" /> : `${studentStats.attendanceRate}%`}</div>
                <p className={`text-xs ${studentStats.attendanceRate >= 75 ? 'text-green-600' : studentStats.attendanceRate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {studentStats.attendanceRate >= 75 ? 'Boa frequência' : studentStats.attendanceRate >= 60 ? 'Atenção necessária' : 'Frequência baixa'}
                </p>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Média Geral</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? <div className="h-8 w-16 bg-muted rounded animate-pulse" /> : studentStats.averageGrade.toFixed(1)}</div>
                <p className={`text-xs ${studentStats.averageGrade >= 7 ? 'text-green-600' : studentStats.averageGrade >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {studentStats.averageGrade >= 7 ? 'Bom desempenho' : studentStats.averageGrade >= 5 ? 'Precisa melhorar' : 'Atenção urgente'}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-1">
            <Card className={`border-l-4 ${studentStats.averageGrade >= 7 ? 'border-l-green-500 bg-green-50' : studentStats.averageGrade >= 5 ? 'border-l-yellow-500 bg-yellow-50' : 'border-l-red-500 bg-red-50'}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className={`h-5 w-5 ${studentStats.averageGrade >= 7 ? 'text-green-600' : studentStats.averageGrade >= 5 ? 'text-yellow-600' : 'text-red-600'}`} />
                  Status Acadêmico
                </CardTitle>
                <CardDescription>
                  Situação atual do semestre
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-lg font-bold ${studentStats.averageGrade >= 7 ? 'text-green-700' : studentStats.averageGrade >= 5 ? 'text-yellow-700' : 'text-red-700'}`}>
                      {studentStats.averageGrade >= 7 ? '✅ APROVADO' : studentStats.averageGrade >= 5 ? '⚠️ EM RECUPERAÇÃO' : '❌ REPROVADO'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Média necessária para aprovação: 7.0
                    </p>
                    {studentStats.averageGrade < 7 && (
                      <p className="text-sm text-muted-foreground">
                        Precisa de {(7 - studentStats.averageGrade).toFixed(1)} pontos para aprovação
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{studentStats.averageGrade.toFixed(1)}</p>
                    <p className="text-sm text-muted-foreground">Média atual</p>
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