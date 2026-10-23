# Agendito — guia do design system

## Estado

Guia inicial da consolidação incremental iniciada em 22/10/2026. A identidade administrativa continua baseada no tema escuro azul, acentos ciano/lavanda e superfícies de vidro do Agendito. Este guia descreve o padrão em vigor e as lacunas que ainda precisam de migração; não significa que todas as rotas já foram convertidas.

## Tokens e ordem de estilos

O ponto de entrada é `app/layout.tsx`. A ordem atual é:

1. `styles/globals.css` — Tailwind e estilos históricos dos módulos.
2. `styles/base.css` — tokens semânticos e fundamentos do tema.
3. `styles/agendito.css` — identidade e estilos dos componentes/áreas Agendito.
4. `styles/layout-audit.css` — correções de geometria e estilos de módulos.
5. `styles/design-system.css` — regras compartilhadas finais e acessibilidade.

Use os tokens já definidos em `styles/base.css`: `--ag-bg`, `--ag-bg-secondary`, `--ag-surface`, `--ag-primary`, `--ag-cyan`, `--ag-lavender`, `--ag-text`, `--ag-text-secondary`, `--ag-line`, `--ag-r-*`, `--ag-shadow*`, `--ag-motion*`, `--ag-page-width` e `--ag-page-gutter`. Aliases de compatibilidade (`--ink`, `--moss`, `--radius-*`, `--focus`, entre outros) permanecem para evitar regressão nos estilos existentes.

Escala de espaçamento central: `--ag-space-1/2/3/4/6/8/12` (4, 8, 12, 16, 24, 32 e 48 px em base 16 px). `--ag-control-height` é 44 px. Valores específicos de agenda, preview e navegação só devem divergir quando a densidade/interação exigir, e essa exceção deve ser documentada.

## Componentes reutilizáveis existentes

- Ações: `GlassButton` com variantes `primary`, `secondary`, `quiet`, `danger`, `ghost` e tamanhos `sm`, `md`, `lg`, `icon`.
- Superfícies: `GlassSurface`, `FrostedPanel` e `LiquidGlass`.
- Campos: `GlassInput`, `GlassSelect` e `PasswordField`.
- Sobreposições: `GlassModal`, `GlassPopover`, `GlassNavigation` e `GlassTooltip`.
- Estruturas: `AdminShell`, `AdminHeader`, `AdminSidebar`, `CustomerShell` e `EmployeeShell`.
- Página admin: `AdminPageContainer` existe. `AdminPageHeader` atualmente atua como slot de ações no header global; não é um cabeçalho de conteúdo autônomo.

Antes de criar um equivalente, estenda esses componentes quando isso não comprometer a API/semântica de módulos já existentes. Loading deve usar `loading` de `GlassButton`; campos devem manter label, hint/error associados; modais devem usar `GlassModal`.

## Regras de layout e responsividade

- Para largura de conteúdo, usar `--ag-page-width` e `--ag-page-gutter` ou o container compartilhado do respectivo contexto.
- Em grids flexíveis, usar `minmax(0, 1fr)` e `min-width: 0` em filhos que contenham texto/campos.
- A navegação administrativa no desktop pertence ao `AdminShell`; em telas estreitas, usar os componentes de navegação móvel do contexto.
- Tabelas complexas podem rolar dentro de wrapper próprio; não devem aumentar a largura da página. No mobile, considerar cartões se a densidade da tabela impedir leitura/ação.
- Modais têm rolagem interna e limite de altura de viewport; preservar `safe-area-inset` em dispositivos móveis.
- Não depender de hover para ações disponíveis a toque/teclado.
- Respeitar `prefers-reduced-motion`; manter anel de foco visível.

## Isolamento das páginas públicas

Personalizações públicas pertencem ao escopo `.public-page` e aos atributos `data-public-*`. Não definir cores administrativas em seletores globais para componentes internos de páginas públicas. Tokens globais fornecem defaults; variáveis de página devem ser locais ao estabelecimento. A prévia do construtor pode ter dimensões próprias, sem alterar os estilos da página pública real.

## Exceções intencionais

- Agenda: grade/colunas e densidade temporal têm dimensões próprias para representar horários sem ambiguidade.
- Editor público: a moldura do preview simula desktop/tablet/smartphone e deve rolar internamente.
- Tabelas de gestão extensas podem ter largura mínima, desde que a rolagem fique contida no wrapper.
- Páginas públicas podem variar tipografia, cor, imagens, seções e layout conforme a configuração do estabelecimento.

## Próximas regras de migração

1. Migrar containers e headers administrativos para contrato compartilhado, sem duplicar o `AdminHeader` global.
2. Converter estilos de botão/campo em variantes/tokens, removendo overrides por módulo após validar cada grupo de rotas.
3. Unificar superfícies, formulários, estados vazios e barras de filtro por contexto.
4. Auditar tabelas e calendário em desktop e mobile.
5. Eliminar CSS legado apenas após confirmar ausência de import e dependência visual.
6. Atualizar `DESIGN_SYSTEM_AUDIT.md` com evidência de viewport/rota real a cada migração.
