import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Subjects from "./pages/Subjects";
import Classes from "./pages/Classes";
import Enrollments from "./pages/Enrollments";
import TeacherCompetencies from "./pages/TeacherCompetencies";
import ClassSubjects from "./pages/ClassSubjects";
import Grades from "./pages/Grades";
import Attendance from "./pages/Attendance";
import NotFound from "./pages/NotFound";

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
                path="/competencies"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <TeacherCompetencies />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/class-subjects"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <DashboardLayout>
                      <ClassSubjects />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/grades"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <DashboardLayout>
                      <Grades />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/attendance"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <DashboardLayout>
                      <Attendance />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
