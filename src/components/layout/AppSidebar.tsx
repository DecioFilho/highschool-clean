import { 
  BookOpen, 
  Users, 
  GraduationCap, 
  Calendar,
  ClipboardList,
  BarChart3,
  Settings,
  Home,
  UserCheck
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
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { isAdmin, isTeacher, isStudent } = useAuth();

  const isActive = (path: string) => location.pathname === path;
  
  const getNavClassName = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? "bg-primary text-primary-foreground font-medium" 
      : "text-white hover:bg-gray-700 hover:text-white";

  // Navigation items for each role
  const adminItems = [
    { title: "Dashboard", url: "/dashboard", icon: Home },
    { title: "Usuários", url: "/users", icon: Users },
    { title: "Turmas", url: "/classes", icon: GraduationCap },
    { title: "Matérias", url: "/subjects", icon: BookOpen },
    { title: "Matrículas", url: "/enrollments", icon: UserCheck },
    { title: "Notas", url: "/grades", icon: ClipboardList },
    { title: "Frequência", url: "/attendance", icon: Calendar },
  ];

  const teacherItems = [
    { title: "Dashboard", url: "/dashboard", icon: Home },
    { title: "Minhas Turmas", url: "/my-classes", icon: GraduationCap },
    { title: "Frequência", url: "/attendance", icon: Calendar },
    { title: "Notas", url: "/grades", icon: ClipboardList },
    { title: "Matérias", url: "/subjects", icon: BookOpen },
  ];

  const studentItems = [
    { title: "Dashboard", url: "/dashboard", icon: Home },
    { title: "Minhas Turmas", url: "/my-classes", icon: GraduationCap },
    { title: "Notas", url: "/my-grades", icon: ClipboardList },
    { title: "Frequência", url: "/my-attendance", icon: Calendar },
  ];

  const getMenuItems = () => {
    if (isAdmin) return adminItems;
    if (isTeacher) return teacherItems;
    if (isStudent) return studentItems;
    return [];
  };

  const menuItems = getMenuItems();

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent>
        <div className="p-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            {!collapsed && (
              <div>
                <h2 className="font-semibold text-sm text-white">HighSchool</h2>
                <p className="text-xs text-white/70">Connect</p>
              </div>
            )}
          </div>
        </div>

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel>
              {isAdmin && "Administração"}
              {isTeacher && "Professor"}
              {isStudent && "Estudante"}
            </SidebarGroupLabel>
          )}
          
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end 
                      className={getNavClassName}
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {(isAdmin || isTeacher) && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel>Relatórios</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to="/reports" 
                      className={getNavClassName}
                    >
                      <BarChart3 className="h-4 w-4" />
                      {!collapsed && <span>Relatórios</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Sistema</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink 
                    to="/settings" 
                    className={getNavClassName}
                  >
                    <Settings className="h-4 w-4" />
                    {!collapsed && <span>Configurações</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}