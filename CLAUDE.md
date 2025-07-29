# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos de Desenvolvimento

- **Iniciar servidor de desenvolvimento**: `npm run dev` (roda na porta 8080)
- **Build para produção**: `npm run build`
- **Build para desenvolvimento**: `npm run build:dev`
- **Executar linting**: `npm run lint`
- **Visualizar build de produção**: `npm run preview`

## Arquitetura do Projeto

Este é um sistema de gestão escolar para ensino médio construído com:

- **Frontend**: React 18 + TypeScript + Vite
- **Framework de UI**: Componentes shadcn/ui com Tailwind CSS
- **Backend**: Supabase (banco PostgreSQL + Autenticação)
- **Gerenciamento de Estado**: React Query (@tanstack/react-query) para estado do servidor
- **Roteamento**: React Router DOM
- **Estilização**: Tailwind CSS com variáveis CSS para temas

### Padrões de Arquitetura Principais

**Fluxo de Autenticação**:
- Usa Supabase Auth com controle de acesso baseado em roles (admin, professor, aluno)
- Estado de auth gerenciado via `AuthContext` em `src/contexts/AuthContext.tsx`
- Rotas protegidas usam componente `ProtectedRoute` com requisitos opcionais de role
- Perfis de usuário armazenados na tabela `users` com roles e status

**Estrutura de Componentes**:
- Componentes de UI em `src/components/ui/` (shadcn/ui)
- Componentes de layout em `src/components/layout/`
- Componentes de página em `src/pages/`
- Utilitários compartilhados em `src/lib/utils.ts`

**Integração com Banco de Dados**:
- Cliente Supabase configurado em `src/integrations/supabase/client.ts`
- Tipos TypeScript gerados em `src/integrations/supabase/types.ts`
- Usa React Query para busca e cache de dados

**Estrutura de Roteamento**:
- `/` → redireciona para `/dashboard`
- `/auth` → Página de autenticação
- `/dashboard` → Dashboard principal (protegida)
- `/users` → Gerenciamento de usuários (apenas admin)
- `/subjects` → Gerenciamento de disciplinas (protegida)
- `/classes` → Gerenciamento de turmas (protegida)
- `/enrollments` → Gerenciamento de matrículas (protegida)
- `/competencies` → Competências de professores (protegida)

### Arquivos de Configuração

- `vite.config.ts`: Configuração do Vite com React SWC, aliases de path (@/ → src/)
- `tailwind.config.ts`: Configuração extensa do Tailwind com cores customizadas, animações
- `components.json`: Configuração do shadcn/ui
- `eslint.config.js`: ESLint com plugins TypeScript, React hooks e React refresh

### Notas Importantes

- Projeto usa plataforma Lovable para desenvolvimento e deploy
- Componentes shadcn/ui são customizados com temas extensivos via variáveis CSS
- Tokens de autenticação e sessões de usuário persistem no localStorage
- Todas as rotas protegidas requerem autenticação, algumas requerem roles específicas