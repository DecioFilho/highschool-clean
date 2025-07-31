import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { lazy, Suspense } from "react";

// Lazy loading das páginas
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Users = lazy(() => import("./pages/Users"));
const Subjects = lazy(() => import("./pages/Subjects"));
const Classes = lazy(() => import("./pages/Classes"));
const Enrollments = lazy(() => import("./pages/Enrollments"));
const Grades = lazy(() => import("./pages/Grades"));
const Attendance = lazy(() => import("./pages/Attendance"));
const MyClasses = lazy(() => import("./pages/MyClasses"));
const ClassStudents = lazy(() => import("./pages/teacher/ClassStudents"));
const TeacherGrades = lazy(() => import("./pages/teacher/TeacherGrades"));
const TeacherAttendance = lazy(() => import("./pages/teacher/TeacherAttendance"));
const StudentGrades = lazy(() => import("./pages/student/StudentGrades"));
const StudentAttendance = lazy(() => import("./pages/student/StudentAttendance"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={true}
        disableTransitionOnChange={false}
      >
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Carregando...</div>}>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/auth" element={<Auth />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <Dashboard />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/users"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <DashboardLayout>
                      <Users />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/subjects"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <Subjects />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/classes"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <Classes />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/enrollments"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <Enrollments />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/grades"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <Grades />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/attendance"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <Attendance />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-classes"
                element={
                  <ProtectedRoute requiredRole="professor">
                    <DashboardLayout>
                      <MyClasses />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teacher/class/:classId/students"
                element={
                  <ProtectedRoute requiredRole="professor">
                    <DashboardLayout>
                      <ClassStudents />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teacher/class/:classId/grades"
                element={
                  <ProtectedRoute requiredRole="professor">
                    <DashboardLayout>
                      <TeacherGrades />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teacher/class/:classId/attendance"
                element={
                  <ProtectedRoute requiredRole="professor">
                    <DashboardLayout>
                      <TeacherAttendance />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/grades"
                element={
                  <ProtectedRoute requiredRole="aluno">
                    <DashboardLayout>
                      <StudentGrades />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/attendance"
                element={
                  <ProtectedRoute requiredRole="aluno">
                    <DashboardLayout>
                      <StudentAttendance />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
