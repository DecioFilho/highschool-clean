# Diretrizes de Desenvolvimento - HighSchool

**Projeto:** HighSchool  
**Fonte:** Guidelines D:\Dev\Projects\guidelines + Especificações do Cliente

## 🎯 Princípios Fundamentais

### 1. **Metodologia de Trabalho**
- ✅ **SEMPRE** planejar antes de implementar
- ✅ Salvar planos em `task/{taskname}.md`
- ✅ Dividir tarefas em subtarefas gerenciáveis
- ✅ Atualizar planos conforme progresso
- ✅ Consultar guidelines regularmente

### 2. **Fidelidade ao Design Existente**
- 🎨 **MANTER** padrões dos componentes já existentes
- 🎨 **SEGUIR** mesmo padrão visual e de interação
- 🎨 **NÃO FAZER** alterações drásticas na interface
- 🎨 **DESENVOLVER** novas funcionalidades adaptando-se ao existente
- 🎨 **CORRIGIR** problemas mantendo consistência visual

### 3. **Segurança e Privacidade**
- 🔒 **JAMAIS** expor dados sensíveis no código
- 🔒 Usar variáveis de ambiente (.env) para credenciais
- 🔒 Validar 100% dos inputs do usuário
- 🔒 Implementar controle de acesso baseado em roles
- 🔒 Headers de segurança configurados

### 4. **Qualidade de Código**
- 📝 Type Safety: 0% uso de 'any' em produção
- 📝 Componentes React com memo quando necessário
- 📝 Hooks com dependências corretas
- 📝 Validação com Zod para formulários
- 📝 Nomenclatura clara e consistente

## 🚀 Stack Técnica Aprovada

### Core
- **Frontend:** React 18 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS (versão estável)
- **Backend:** Supabase + Supabase Auth
- **UI Components:** shadcn/ui

### Dependências Essenciais
```json
{
  "react": "^18.3.1",
  "typescript": "^5.5.3",
  "vite": "^5.4.1",
  "@supabase/supabase-js": "^2.52.1",
  "tailwindcss": "^3.4.1",
  "@tanstack/react-query": "^5.56.2",
  "react-hook-form": "^7.53.0",
  "zod": "^3.23.8"
}
```

## 🎨 Padrões de Interface Existentes (MANTER)

### Estrutura de Páginas
```typescript
// Padrão existente a ser seguido:
<div className="space-y-6">
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Título</h1>
      <p className="text-muted-foreground">Descrição</p>
    </div>
    {/* Botão de ação (se admin) */}
  </div>
  {/* Conteúdo da página */}
</div>
```

### Componentes de Formulário
- Usar Dialog para modais
- Input, Label, Button do shadcn/ui
- Validações com feedback visual
- Loading states consistentes

### Cards e Listagens
- Grid responsivo (md:grid-cols-2 lg:grid-cols-3)
- Cards com CardHeader, CardContent
- Badges para status
- Botões de ação uniformes

## 👥 Controle de Acesso por Roles

### **Admin** (Controle Total)
- ✅ Gerenciar usuários (CRUD completo)
- ✅ Gerenciar matérias (CRUD completo)
- ✅ Gerenciar turmas (CRUD completo)
- ✅ Gerenciar matrículas (CRUD completo)
- ✅ Gerenciar competências de professores
- ✅ Gerenciar associações turma-matéria
- ✅ Visualizar todas as informações do sistema
- ✅ **Único** que pode cadastrar novos usuários

### **Professor** (Acesso Específico)
- 📖 Visualizar suas turmas e matérias
- 📖 Lançar notas apenas das suas matérias
- 📖 Registrar frequência apenas das suas aulas
- 📖 Visualizar alunos das suas turmas
- ❌ Não pode gerenciar usuários
- ❌ Não pode gerenciar turmas/matérias

### **Aluno** (Acesso Limitado)
- 👁️ Visualizar suas notas
- 👁️ Visualizar sua frequência
- 👁️ Visualizar suas turmas e matérias
- ❌ Não pode alterar nenhuma informação

## 🗄️ Compatibilidade com Schema do Banco

### Tabelas e Relacionamentos Obrigatórios
```sql
-- Usuários com roles específicos
users (id, email, full_name, role, status, student_registration)

-- Matérias
subjects (id, name, code, description, status)

-- Turmas
classes (id, name, code, description, year, semester, status)

-- Matrículas (aluno x turma)
class_enrollments (id, student_id, class_id, enrollment_date, status)

-- Competências (professor x matéria)
teacher_competencies (id, teacher_id, subject_id)

-- Associação turma x matéria x professor
class_subjects (id, class_id, subject_id, teacher_id, workload_hours)

-- Notas
grades (id, student_id, class_subject_id, teacher_id, grade_value, grade_type, evaluation_date)

-- Frequência
attendance (id, student_id, class_subject_id, teacher_id, absence_date, absence_count, justified)
```

## 📋 Validações Obrigatórias

### Formulários
```typescript
// Exemplo: Validação de usuário
const userSchema = z.object({
  email: z.string().email("Email inválido"),
  full_name: z.string().min(2, "Nome muito curto"),
  role: z.enum(["admin", "professor", "aluno"]),
  student_registration: z.string().optional()
});
```

### Regras de Negócio
- ✅ Aluno não pode ter matrícula duplicada na mesma turma
- ✅ Professor não pode ter competência duplicada na mesma matéria
- ✅ Notas devem estar entre 0-10
- ✅ Professor só pode lançar notas das suas matérias
- ✅ Email fictício permitido para admin (sem verificação)

## 🚫 Funcionalidades NÃO Implementar (Por Enquanto)

- ❌ Gráficos e estatísticas
- ❌ Relatórios complexos
- ❌ Dashboard com métricas avançadas
- ❌ Sistema de notificações
- ❌ Chat ou mensageria
- ❌ Backup automático
- ❌ Integrações externas

## 🔧 Configurações Essenciais

### Variáveis de Ambiente (.env)
```env
VITE_SUPABASE_URL=sua_url_aqui
VITE_SUPABASE_ANON_KEY=sua_chave_aqui
```

### Arquivo .gitignore
```gitignore
.env
.env.local
.env.production
```

## 📊 Métricas de Qualidade (Guidelines)

- **Type Safety**: 0% uso de 'any'
- **Input Validation**: 100% inputs validados
- **Security Headers**: Todos configurados
- **Performance**: Bundle < 250KB
- **Code Duplication**: < 5%
- **Test Coverage**: 80%+ (quando implementarmos testes)

## 🔄 Processo de Desenvolvimento

### Por Tarefa:
1. 📋 **Planejar** - Criar/atualizar docloud/task/{nome}.md
2. 🔍 **Consultar** - Verificar guidelines e diretrizes
3. 🛠️ **Implementar** - Seguir padrões estabelecidos
4. ✅ **Validar** - Testar funcionalidade
5. 📝 **Documentar** - Atualizar plano com o que foi feito

### Por Sprint:
- Revisão semanal das diretrizes
- Retrospectiva de qualidade
- Atualização de padrões quando necessário

## 🎯 Foco Atual: Funcionalidades Core

### Prioridade Alta
1. Segurança (variáveis de ambiente)
2. Correção das páginas existentes
3. CRUD completo e compatível
4. Controle de acesso por roles

### Prioridade Baixa (Futuro)
- Otimizações avançadas
- Funcionalidades extras
- Integrações complexas

---

**LEMBRE-SE**: Consulte este documento a cada desenvolvimento e mantenha-o atualizado conforme o projeto evolui.