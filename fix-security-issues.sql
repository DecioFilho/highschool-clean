-- ========================================
-- CORREÇÕES DE SEGURANÇA DO SUPABASE
-- ========================================

-- 1. HABILITAR RLS NA TABELA USERS (CRÍTICO)
-- Isso corrige o erro mais grave de segurança
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. CORRIGIR SEARCH_PATH DAS FUNÇÕES (WARNINGS)
-- Definir search_path seguro para todas as funções

-- Função: update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- Função: get_user_role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    RETURN (SELECT role FROM public.users WHERE id = auth.uid());
END;
$$;

-- Função: is_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    RETURN (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin';
END;
$$;

-- Função: is_teacher
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    RETURN (SELECT role FROM public.users WHERE id = auth.uid()) = 'professor';
END;
$$;

-- Função: is_student
CREATE OR REPLACE FUNCTION public.is_student()
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    RETURN (SELECT role FROM public.users WHERE id = auth.uid()) = 'aluno';
END;
$$;

-- Função: teacher_teaches_class
CREATE OR REPLACE FUNCTION public.teacher_teaches_class(class_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.class_subjects 
        WHERE class_subjects.class_id = teacher_teaches_class.class_id 
        AND teacher_id = auth.uid()
    );
END;
$$;

-- Função: student_enrolled_in_class
CREATE OR REPLACE FUNCTION public.student_enrolled_in_class(class_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.class_enrollments 
        WHERE class_enrollments.class_id = student_enrolled_in_class.class_id 
        AND student_id = auth.uid() 
        AND status = 'active'
    );
END;
$$;

-- Função: sync_existing_auth_users
CREATE OR REPLACE FUNCTION public.sync_existing_auth_users()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, role, status)
    SELECT 
        au.id,
        au.email,
        COALESCE(au.raw_user_meta_data->>'full_name', au.email),
        COALESCE((au.raw_user_meta_data->>'role')::public.user_role, 'aluno'),
        'active'
    FROM auth.users au
    WHERE au.id NOT IN (SELECT id FROM public.users)
    ON CONFLICT (id) DO NOTHING;
END;
$$;

-- Função: handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, role, status)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'aluno'),
        'active'
    );
    RETURN NEW;
END;
$$;

-- 3. MELHORAR POLÍTICAS RLS (OPCIONAL - PARA REDUZIR WARNINGS)
-- Remover acesso anônimo das políticas onde não é necessário

-- Política mais restritiva para users - remover acesso anônimo se existir
DROP POLICY IF EXISTS "Deny anonymous access users" ON public.users;
CREATE POLICY "Deny anonymous access users" ON public.users
    FOR ALL USING (auth.role() != 'anon');

-- Verificar se existem outras políticas que permitem acesso anônimo desnecessário
-- (Isso pode precisar de ajustes dependendo dos requisitos específicos do sistema)

-- 4. CONFIRMAR QUE RLS ESTÁ HABILITADO EM TODAS AS TABELAS NECESSÁRIAS
-- Verificar outras tabelas importantes
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Mensagem de confirmação
DO $$
BEGIN
    RAISE NOTICE 'Correções de segurança aplicadas com sucesso!';
    RAISE NOTICE '1. RLS habilitado na tabela users';
    RAISE NOTICE '2. search_path corrigido em todas as funções';
    RAISE NOTICE '3. RLS habilitado em todas as tabelas principais';
    RAISE NOTICE 'Execute este script no SQL Editor do Supabase Dashboard';
END $$;