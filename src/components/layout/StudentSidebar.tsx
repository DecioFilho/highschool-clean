import { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Home,
  ClipboardList,
  Calendar,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  TrendingUp,
  Clock
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface StudentSubject {
  class_subject_id: string;
  subject_name: string;
  subject_code: string;
  class_name: string;
  teacher_name: string;
  average?: number;
  total_absences?: number;
  isApproved?: boolean | null;
}

export function StudentSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<StudentSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectsOpen, setSubjectsOpen] = useState(true);

  const isActive = (path: string) => location.pathname === path;
  
  const getNavClassName = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? "bg-primary text-primary-foreground font-medium" 
      : "text-white hover:bg-gray-700 hover:text-white";

  const fetchStudentSubjects = async () => {
    if (!user?.id) return;

    try {
      const { data: enrollmentData, error } = await supabase
        .from('class_enrollments')
        .select(`
          classes (
            id,
            name,
            class_subjects (
              id,
              subjects (name, code),
              users (full_name)
            )
          )
        `)
        .eq('student_id', user.id)
        .eq('status', 'active');

      if (error) throw error;

      const subjectsList: StudentSubject[] = [];

      for (const enrollment of enrollmentData || []) {
        const classData = enrollment.classes;
        
        for (const classSubject of classData.class_subjects || []) {
          // Fetch grades to calculate average
          const { data: gradesData } = await supabase
            .from('grades')
            .select('grade_type, grade_value')
            .eq('student_id', user.id)
            .eq('class_subject_id', classSubject.id);

          // Fetch attendance to count absences
          const { data: attendanceData } = await supabase
            .from('attendance')
            .select('absence_count')
            .eq('student_id', user.id)
            .eq('class_subject_id', classSubject.id);

          // Calculate average
          let average = 0;
          let isApproved = null;
          if (gradesData && gradesData.length > 0) {
            let totalWeighted = 0;
            let totalWeight = 0;
            
            gradesData.forEach(grade => {
              const weight = grade.grade_type === 'prova' ? 3 : grade.grade_type === 'trabalho' ? 7 : 1;
              totalWeighted += grade.grade_value * weight;
              totalWeight += weight;
            });
            
            if (totalWeight > 0) {
              average = totalWeighted / totalWeight;
              isApproved = average >= 7;
            }
          }

          // Calculate total absences
          const total_absences = attendanceData?.reduce((sum, record) => sum + record.absence_count, 0) || 0;

          subjectsList.push({
            class_subject_id: classSubject.id,
            subject_name: classSubject.subjects.name,
            subject_code: classSubject.subjects.code,
            class_name: classData.name,
            teacher_name: classSubject.users?.full_name || 'Professor não atribuído',
            average,
            total_absences,
            isApproved
          });
        }
      }

      setSubjects(subjectsList);
    } catch (error) {
      console.error('Error fetching student subjects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentSubjects();
  }, [user?.id]);

  const getSubjectStatusColor = (isApproved: boolean | null, average: number) => {
    if (isApproved === true) return 'bg-green-500';
    if (isApproved === false) return 'bg-red-500';
    if (average > 0) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  const getAbsenceColor = (absences: number) => {
    if (absences === 0) return 'text-green-600';
    if (absences >= 5) return 'text-red-600';
    return 'text-yellow-600';
  };

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent>
        {/* Header */}
        <div className="p-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            {!collapsed && (
              <div>
                <h2 className="font-semibold text-sm text-white">HighSchool</h2>
                <p className="text-xs text-white/70">Portal do Aluno</p>
              </div>
            )}
          </div>
        </div>

        {/* Main Navigation */}
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Principal</SidebarGroupLabel>}
          
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/dashboard" className={getNavClassName}>
                    <Home className="h-4 w-4" />
                    {!collapsed && <span>Dashboard</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/student/grades" className={getNavClassName}>
                    <ClipboardList className="h-4 w-4" />
                    {!collapsed && <span>Todas as Notas</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/student/attendance" className={getNavClassName}>
                    <Calendar className="h-4 w-4" />
                    {!collapsed && <span>Frequência Geral</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Subjects Navigation */}
        {!collapsed && (
          <SidebarGroup>
            <Collapsible open={subjectsOpen} onOpenChange={setSubjectsOpen}>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex items-center gap-2 hover:bg-gray-700 rounded p-1">
                  {subjectsOpen ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  <GraduationCap className="h-4 w-4" />
                  Minhas Disciplinas
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {loading ? (
                      <SidebarMenuItem>
                        <div className="px-2 py-1 text-xs text-white/70">
                          Carregando...
                        </div>
                      </SidebarMenuItem>
                    ) : subjects.length === 0 ? (
                      <SidebarMenuItem>
                        <div className="px-2 py-1 text-xs text-white/70">
                          Nenhuma disciplina
                        </div>
                      </SidebarMenuItem>
                    ) : (
                      subjects.map((subject) => (
                        <SidebarMenuItem key={subject.class_subject_id}>
                          <Collapsible>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton className="w-full justify-between text-white hover:bg-gray-700">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <div 
                                    className={`w-2 h-2 rounded-full flex-shrink-0 ${getSubjectStatusColor(subject.isApproved, subject.average || 0)}`}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="font-medium text-xs truncate">
                                      {subject.subject_name}
                                    </div>
                                    <div className="text-xs text-white/60 truncate">
                                      {subject.subject_code}
                                    </div>
                                  </div>
                                </div>
                                <ChevronRight className="h-3 w-3 flex-shrink-0" />
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                            
                            <CollapsibleContent>
                              <SidebarMenuSub>
                                <SidebarMenuSubItem>
                                  <SidebarMenuSubButton asChild>
                                    <NavLink 
                                      to={`/student/subject/${subject.class_subject_id}/overview`}
                                      className="flex items-center gap-2 text-xs"
                                    >
                                      <TrendingUp className="h-3 w-3" />
                                      Visão Geral
                                    </NavLink>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                                
                                <SidebarMenuSubItem>
                                  <SidebarMenuSubButton asChild>
                                    <NavLink 
                                      to={`/student/subject/${subject.class_subject_id}/grades`}
                                      className="flex items-center gap-2 text-xs justify-between"
                                    >
                                      <div className="flex items-center gap-2">
                                        <ClipboardList className="h-3 w-3" />
                                        Notas
                                      </div>
                                      {subject.average && subject.average > 0 && (
                                        <Badge 
                                          variant="outline" 
                                          className={`text-xs px-1 h-4 ${
                                            subject.isApproved === true ? 'border-green-500 text-green-600' :
                                            subject.isApproved === false ? 'border-red-500 text-red-600' :
                                            'border-yellow-500 text-yellow-600'
                                          }`}
                                        >
                                          {subject.average.toFixed(1)}
                                        </Badge>
                                      )}
                                    </NavLink>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>

                                <SidebarMenuSubItem>
                                  <SidebarMenuSubButton asChild>
                                    <NavLink 
                                      to={`/student/subject/${subject.class_subject_id}/attendance`}
                                      className="flex items-center gap-2 text-xs justify-between"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Clock className="h-3 w-3" />
                                        Faltas
                                      </div>
                                      {subject.total_absences !== undefined && (
                                        <span className={`text-xs ${getAbsenceColor(subject.total_absences)}`}>
                                          {subject.total_absences}
                                        </span>
                                      )}
                                    </NavLink>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              </SidebarMenuSub>
                            </CollapsibleContent>
                          </Collapsible>
                        </SidebarMenuItem>
                      ))
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}