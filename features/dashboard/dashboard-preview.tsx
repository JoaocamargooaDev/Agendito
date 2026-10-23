import {
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  Clock3,
  Cog,
  Scissors,
  UserRound,
  Users,
  UsersRound,
} from "lucide-react";
import { AgenditoLogo } from "@/components/brand/agendito-logo";
import { GlassSurface } from "@/components/ui";

const metrics = [
  { label: "Hoje", value: "8", detail: "agendamentos registrados", tone: "accent" },
  { label: "Pendentes", value: "3", detail: "agendados ou confirmados" },
  { label: "Concluídos", value: "4", detail: "R$ 320,00 em serviços" },
  { label: "Em atendimento", value: "1", detail: "atendimento em andamento" },
  { label: "Cancelamentos", value: "1", detail: "não entra nos valores ativos", tone: "warning" },
  { label: "Valor previsto", value: "R$ 240", detail: "agendamentos ativos de hoje", tone: "accent" },
];

const appointments = [
  { time: "10:30", name: "Marcos Oliveira", service: "Corte degradê · Lucas", status: "Confirmado" },
  { time: "11:15", name: "Rafael Santos", service: "Barba · André", status: "Agendado" },
  { time: "13:00", name: "Bruno Lima", service: "Corte + barba · Lucas", status: "Agendado" },
];

const weekly = [
  { day: "Seg", value: 4 },
  { day: "Ter", value: 7 },
  { day: "Qua", value: 5 },
  { day: "Qui", value: 9 },
  { day: "Sex", value: 6 },
  { day: "Sáb", value: 10 },
  { day: "Dom", value: 2 },
];

const navItems = [
  { label: "Visão geral", Icon: BarChart3, active: true },
  { label: "Agenda", Icon: CalendarDays },
  { label: "Clientes", Icon: Users },
  { label: "Equipe", Icon: UsersRound },
  { label: "Serviços", Icon: Scissors },
  { label: "Configurações", Icon: Cog },
];

export function DashboardPreview() {
  return (
    <div className="admin-shell preview-dashboard-shell">
      <aside className="admin-sidebar preview-dashboard-sidebar" aria-label="Prévia do menu administrativo">
        <div className="admin-sidebar-top"><span className="admin-brand"><AgenditoLogo size="medium" /></span></div>
        <nav className="admin-nav" aria-label="Seções da prévia">
          {navItems.map(({ label, Icon, active }) => (
            <span className={`admin-nav-item${active ? " nav-item-active" : ""}`} key={label}><Icon size={18} aria-hidden /><span>{label}</span></span>
          ))}
        </nav>
        <div className="admin-sidebar-bottom"><div className="sidebar-user"><span className="user-avatar">A</span><span className="sidebar-user-copy"><strong>Alex Silva</strong><small>Administrador</small></span></div></div>
      </aside>

      <div className="admin-workspace preview-dashboard-workspace">
        <header className="admin-header">
          <div className="admin-header-title"><div><span className="header-context"><span>Barbearia Vicente</span><i /> Administração</span><h1>Visão geral</h1></div></div>
          <div className="admin-header-actions" aria-hidden="true"><span className="icon-trigger"><Bell size={18} /></span><span className="profile-trigger"><UserRound size={18} /></span></div>
        </header>

        <main className="admin-main">
          <div className="admin-page-container" aria-label="Prévia visual da dashboard">
            <div className="preview-banner"><span>PRÉVIA</span><p>Dados demonstrativos — nada aqui é salvo.</p></div>

            <section className="admin-page-header dashboard-welcome">
              <div><span className="eyebrow">Barbearia Vicente</span><h1>Bom dia, Alex.</h1><p>Quarta-feira, 21 de outubro · 8 agendamentos registrados hoje.</p></div>
              <span className="glass-button button-primary">Abrir agenda <CalendarDays size={16} /></span>
            </section>

            <GlassSurface material="regular" className="dashboard-public-link">
              <span className="dashboard-public-link-icon" aria-hidden><CalendarDays size={19} /></span>
              <div className="dashboard-public-link-copy"><span className="eyebrow">Link público para clientes</span><strong>Compartilhe sua página de agendamento</strong><code>agendito.com/e/barbearia-vicente</code><p>Seus clientes podem conhecer o espaço e escolher um horário.</p></div>
              <div className="dashboard-public-link-actions"><span className="glass-button button-secondary">Copiar link</span><span className="glass-button button-quiet">Abrir página</span></div>
            </GlassSurface>

            <section className="dashboard-metric-grid" aria-label="Indicadores demonstrativos">
              {metrics.map(({ label, value, detail, tone = "quiet" }) => <div className={`dashboard-metric metric-${tone}`} key={label}><span className="token-label">{label}</span><strong>{value}</strong><span>{detail}</span></div>)}
            </section>

            <div className="dashboard-grid">
              <section className="dashboard-primary">
                <GlassSurface material="frosted" className="dashboard-section">
                  <div className="dashboard-section-header"><div><span className="eyebrow">Operação de hoje</span><h2>Agenda do dia</h2></div><span className="dashboard-subtle">8 registros</span></div>
                  <div className="today-appointments" role="list">{appointments.map((appointment) => <article className="today-appointment" key={appointment.time} role="listitem"><time className="appointment-time">{appointment.time}</time><div className="appointment-main"><strong>{appointment.name}</strong><span>{appointment.service}</span><span className="appointment-meta">30 min · R$ 80,00</span></div><span className="status-badge status-CONFIRMED"><Check size={13} aria-hidden />{appointment.status}</span></article>)}</div>
                </GlassSurface>
                <GlassSurface material="frosted" className="dashboard-section">
                  <div className="dashboard-section-header"><div><span className="eyebrow">Ritmo da semana</span><h2>Resumo semanal</h2></div><span className="dashboard-subtle">agendamentos</span></div>
                  <div className="weekly-chart" aria-label="Agendamentos demonstrativos por dia">{weekly.map(({ day, value }) => <div className="weekly-column" key={day}><span className="weekly-value">{value}</span><div className="weekly-bar-track"><div className="weekly-bar" style={{ height: `${value * 10}%` }} /></div><span>{day}</span></div>)}</div>
                </GlassSurface>
              </section>

              <aside className="dashboard-rail">
                <GlassSurface material="thick" className="next-appointment"><span className="eyebrow">Próximo atendimento</span><time>10:30</time><h2>Marcos Oliveira</h2><p>Corte degradê com Lucas</p><span className="status-badge status-CONFIRMED"><Clock3 size={13} aria-hidden />Confirmado</span></GlassSurface>
                <GlassSurface material="frosted" className="dashboard-section"><div className="dashboard-section-header"><div><span className="eyebrow">Equipe</span><h2>Profissionais do dia</h2></div><Users size={18} aria-hidden /></div><div className="staff-list"><div className="staff-row"><span className="avatar-fallback">L</span><div><strong>Lucas Ferreira</strong><span>09:00–18:00</span></div><small>2/5 concluídos</small></div><div className="staff-row"><span className="avatar-fallback">A</span><div><strong>André Costa</strong><span>10:00–19:00</span></div><small>2/3 concluídos</small></div></div></GlassSurface>
              </aside>
            </div>
          </div>
        </main>

        <nav className="admin-mobile-nav preview-mobile-nav" aria-label="Menu demonstrativo"><span className="mobile-nav-active"><BarChart3 size={19} /><span>Início</span></span><span><CalendarDays size={19} /><span>Agenda</span></span><span><Users size={19} /><span>Clientes</span></span><span><Cog size={19} /><span>Mais</span></span></nav>
      </div>
    </div>
  );
}
