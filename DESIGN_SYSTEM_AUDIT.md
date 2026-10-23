# Agendito — auditoria do design system

Data do inventário: 22/10/2026. Resultado inicial, não declaração de conclusão. Foram identificados 37 arquivos `page.tsx` (rotas incluindo segmentos dinâmicos), três layouts (root, admin e console do proprietário), dez arquivos em `components/admin`, 21 em `components/ui`, `components/brand` e `components/auth` combinados, e oito folhas CSS antes da limpeza (cinco restantes). A inspeção desta execução abriu `/`, `/login` e `/customer/register` em browser desktop para smoke estrutural de renderização/acessibilidade; não houve medição visual automatizada em breakpoints. Por isso nenhuma linha recebe status “Concluído e verificado”.

## Inventário de rotas

“Layout base” indica o root layout com `AuthProvider` e CSS global. Admin também recebe `AuthGuard` e `AdminShell`; customer e employee recebem seus shells próprios. “Público” resolve estabelecimento por slug e configurações isoladas. Rota dinâmica depende de registro local válido.

| Rota | Layout / módulos | Margens | Bordas | Tipo | Responsividade | Problemas/observações e pendências | Status |
|---|---|---|---|---|---|---|---|
| `/` | Root; landing | Pendente | Pendente | Pendente | Pendente | Smoke desktop no browser; precisa QA visual e breakpoints | Implementado, não validado visualmente |
| `/login` | Root; AuthLayout/LoginForm | Pendente | Pendente | Pendente | Pendente | Smoke desktop no browser; campo/form precisam matriz responsiva | Implementado, não validado visualmente |
| `/forgot-password` | Root; AuthLayout/PasswordResetForm | Pendente | Pendente | Pendente | Pendente | Fluxo e visual pendentes de QA | Pendente |
| `/customer/register` | Root; AuthLayout/CustomerRegistrationForm | Pendente | Pendente | Pendente | Pendente | Smoke desktop no browser; formulário comprido precisa validar teclado/scroll mobile | Implementado, não validado visualmente |
| `/customer/login` | Root; redirect | N/A | N/A | N/A | Pendente | Validar destino/redirect | Pendente |
| `/platform/login` | Root; redirect | N/A | N/A | N/A | Pendente | Validar destino/redirect | Pendente |
| `/dashboard` | AdminShell; AdminDashboard | Pendente | Pendente | Pendente | Pendente | Header global existe; alinhamento de margens entre módulos pendente | Pendente |
| `/agenda` | AdminShell; AgendaPage | Pendente | Pendente | Pendente | Pendente | Grade temporal é exceção intencional; testar densidade e filtros | Pendente |
| `/appointments` | AdminShell; redirect | N/A | N/A | N/A | Pendente | Validar destino/redirect | Pendente |
| `/customers` | AdminShell; CustomersPage | Pendente | Pendente | Pendente | Pendente | Tabela/lista, filtros e detalhe pendentes de inspeção | Pendente |
| `/customers/[id]` | AdminShell; CustomersPage | Pendente | Pendente | Pendente | Pendente | Estado de cliente válido/inexistente pendente | Pendente |
| `/employees` | AdminShell; EmployeesPage | Pendente | Pendente | Pendente | Pendente | Formulários/listas/estados pendentes | Pendente |
| `/employees/[id]` | AdminShell; EmployeesPage | Pendente | Pendente | Pendente | Pendente | Detalhe válido/inexistente pendente | Pendente |
| `/services` | AdminShell; ServicesPage | Pendente | Pendente | Pendente | Pendente | Formulários e catálogo pendentes | Pendente |
| `/settings` | AdminShell; SettingsPage | Pendente | Pendente | Pendente | Pendente | Campos, tabs e uploads pendentes | Pendente |
| `/settings/access` | AdminShell; AdminPasswordChange | Pendente | Pendente | Pendente | Pendente | Formulário de acesso pendente | Pendente |
| `/features` | AdminShell; AdvancedFeaturesPage | Pendente | Pendente | Pendente | Pendente | Cards/toggles/estado vazio pendentes | Pendente |
| `/employee` | EmployeeShell; EmployeeHome | Pendente | Pendente | Pendente | Pendente | Navegação e cards pendentes | Pendente |
| `/employee/appointments` | EmployeeShell; EmployeeAppointments | Pendente | Pendente | Pendente | Pendente | Lista/detalhe de atendimento pendentes | Pendente |
| `/employee/availability` | EmployeeShell; EmployeeAvailability | Pendente | Pendente | Pendente | Pendente | Formulário e horários pendentes | Pendente |
| `/employee/clients` | EmployeeShell; EmployeeClients | Pendente | Pendente | Pendente | Pendente | Lista/detalhe pendentes | Pendente |
| `/employee/profile` | EmployeeShell; EmployeeProfile | Pendente | Pendente | Pendente | Pendente | Formulário/upload pendentes | Pendente |
| `/employee/schedule` | EmployeeShell; EmployeeSchedule | Pendente | Pendente | Pendente | Pendente | Grade/calendário pendente | Pendente |
| `/customer` | CustomerShell; CustomerHome | Pendente | Pendente | Pendente | Pendente | Header/nav/cartões pendentes | Pendente |
| `/customer/appointments` | CustomerShell; CustomerAppointments | Pendente | Pendente | Pendente | Pendente | Lista/ações/estado vazio pendentes | Pendente |
| `/customer/appointments/[id]` | CustomerShell; CustomerAppointmentDetails | Pendente | Pendente | Pendente | Pendente | Detalhe/ações condicionais pendentes | Pendente |
| `/customer/appointments/[id]/reschedule` | CustomerShell; CustomerReschedule | Pendente | Pendente | Pendente | Pendente | Calendário/form pendentes | Pendente |
| `/customer/history` | CustomerShell; CustomerHistory | Pendente | Pendente | Pendente | Pendente | Lista e filtros pendentes | Pendente |
| `/customer/profile` | CustomerShell; CustomerProfile | Pendente | Pendente | Pendente | Pendente | Formulário pendente | Pendente |
| `/customer/forgot-password` | AuthLayout; PasswordResetForm | Pendente | Pendente | Pendente | Pendente | QA visual/fluxo pendentes | Pendente |
| `/e/[slug]` | Root; PublicEstablishmentRoute/Page | Pendente | Pendente | Pendente | Pendente | Tema isolado por `.public-page`; validar status/slug e templates | Pendente |
| `/e/[slug]/booking` | Root; PublicBookingRoute/Page | Pendente | Pendente | Pendente | Pendente | Fluxo de reserva e teclado móvel pendentes | Pendente |
| `/platform/establishments` | Platform AuthGuard; PlatformEstablishmentsPage | Pendente | Pendente | Pendente | Pendente | Tabela longa; wrapper local com scroll; QA pendente | Pendente |
| `/platform/establishments/[id]/page-builder` | Platform AuthGuard; PublicPageBuilderPage | Pendente | Pendente | Pendente | Pendente | Editor/preview responsivo pendentes | Pendente |
| `/platform/pages` | Platform AuthGuard; PublicPagesManagementPage | Pendente | Pendente | Pendente | Pendente | Lista/ações/modais pendentes | Pendente |
| `/platform/pages/[id]/preview` | Platform AuthGuard; OwnerPublicPagePreview | Pendente | Pendente | Pendente | Pendente | Preview privilegiado; validar banner e tema do tenant | Pendente |
| `/preview/dashboard` | Root; DashboardPreview/notFound | Pendente | Pendente | Pendente | Pendente | Estado autorizado/notFound pendente | Pendente |

## Achados transversais

- A importação efetiva era `globals.css` → `base.css` → `agendito.css` → `layout-audit.css`. Uma camada `design-system.css` já havia sido adicionada como final na execução anterior.
- `globals.css` carregava um conjunto de tokens de tema claro conflitante com o tema escuro semântico de `base.css`. Esse bloco duplicado foi removido; a identidade atual vem de `base.css`.
- `readability.css`, `refinement.css` e `visual-refresh.css` não tinham importação nem referência em código no repositório. Foram removidos após busca global; não eram parte da cascata entregue pelo root layout.
- `layout-audit.css` é usado e contém layout/responsividade extensos. `agendito.css` também mistura tokens, estilo de componentes, regras por tela e diversos overrides; simplificação ampla ainda pendente.
- Há estilos antigos ainda presentes em `globals.css` e `base.css`; sua remoção requer migração por módulo e verificação visual antes de apagar.
- `GlassButton`, `GlassInput`, `GlassSelect`, `GlassModal`, `GlassPopover`, `GlassSurface`, `AdminShell`, `CustomerShell` e `EmployeeShell` são os componentes compartilhados de base identificados.
- `AdminPageContainer` é reutilizado em páginas admin, mas `AdminPageHeader` é um slot para ações do `AdminHeader`, não um PageHeader de conteúdo. A proposta do anexo para `PageShell/PageHeader` ainda não está implementada integralmente.
- Existem especificidades de agenda e preview público; devem permanecer exceções documentadas, não forçadas a uma grade genérica.
- O escopo das cores públicas está sob `.public-page`/`data-public-*`; não foram migradas nem apagadas personalizações do tenant.

## Estado de execução

| Fase | Estado | Evidência / pendência |
|---|---|---|
| 1. Inventário | Parcial | 37 páginas e layouts listados; árvore de dependências não cobre cada subcomponente interno nem estados condicionais. |
| 2. Design tokens | Parcial | Tokens centralizados em `base.css`; redundância do antigo bloco de `globals.css` removida. Valores mágicos restantes ainda exigem migração. |
| 3. Componentes compartilhados | Parcial | Componentes base existentes; ainda há regras e variantes visuais duplicadas. |
| 4. Layout global | Parcial | Shells existentes, mas PageShell/PageHeader e margens não foram verificados uniformemente em todas as telas. |
| 5. Todas as rotas | Pendente | Não migradas/inspecionadas visualmente. |
| 6. Responsividade | Pendente | Nenhuma matriz completa de viewports foi executada. |
| 7. Estados/acessibilidade | Parcial | Foco/reduced motion e modal foram cobertos pelo CSS compartilhado; estados e ARIA precisam de auditoria por módulo. |
| 8. Limpeza | Parcial | Três arquivos comprovadamente não importados removidos; overrides nas folhas ativas permanecem. |
| 9. Validação | Parcial | TypeScript/lint foram executados anteriormente; browser smoke desktop em três rotas; build falhou com `EPERM` ao criar `.next/server/app/(admin)/customers`. |

## Comandos e resultados conhecidos

- `npm run typecheck`: passou na execução anterior à ampliação do anexo; repetir após próximas fases.
- `npm run lint`: zero erros, seis avisos (um hook e cinco usos de `<img>`) antes desta execução; repetir depois da remoção dos CSS.
- `npm run build`: não validado devido ao erro de permissão `EPERM` ao criar diretório em `.next`.
- Navegador desktop: `/`, `/login` e `/customer/register` carregaram e expuseram árvore de acessibilidade; isso é smoke estrutural, não QA visual certificado.

Atualizar esta matriz em cada etapa. Use “Concluído e verificado” apenas com evidência visual e funcional específica da rota e dos viewports declarados.
