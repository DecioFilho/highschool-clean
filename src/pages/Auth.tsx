import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Eye, EyeOff } from 'lucide-react';

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { user, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  if (user) {
    return <Navigate to={from} replace />;
  }

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        title: 'Erro no login',
        description: error.message === 'Invalid login credentials' 
          ? 'Email ou senha incorretos' 
          : 'Erro ao fazer login. Tente novamente.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Login realizado com sucesso!',
        description: 'Bem-vindo ao HighSchool Connect.',
      });
    }

    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
    const fullName = formData.get('fullName') as string;
    const role = formData.get('role') as 'admin' | 'professor' | 'aluno';

    if (password !== confirmPassword) {
      toast({
        title: 'Erro no cadastro',
        description: 'As senhas não coincidem.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    const { error } = await signUp(email, password, fullName, role);

    if (error) {
      if (error.message.includes('already registered')) {
        toast({
          title: 'Erro no cadastro',
          description: 'Este email já está cadastrado.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erro no cadastro',
          description: 'Erro ao criar conta. Tente novamente.',
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Conta criada com sucesso!',
        description: 'Você já pode fazer login.',
      });
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center mb-4">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">HighSchool Connect</CardTitle>
          <CardDescription>
            Sistema de gestão escolar moderno
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full">
            <div className="text-center mb-4">
              <h3 className="text-lg font-semibold">Acesso ao Sistema</h3>
            </div>
            
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">Senha</Label>
                <div className="relative">
                  <Input
                    id="signin-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>

            <div className="text-sm text-muted-foreground border-t pt-4">
              <p className="mb-2 text-center"><strong>Use o usuário admin já cadastrado no banco</strong></p>
              <p className="text-center text-xs">Apenas administradores podem criar novos usuários</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}