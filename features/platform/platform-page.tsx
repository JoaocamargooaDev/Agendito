"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertCircle, Building2, CheckCircle2, Copy, ExternalLink, KeyRound, LayoutTemplate, LogOut, Pencil, Plus, Store, Trash2 } from "lucide-react";
import { PasswordField } from "@/components/auth";
import { GlassButton, GlassInput, GlassModal, GlassSelect, GlassSurface } from "@/components/ui";
import { useAuth } from "@/features/auth";
import {
  deleteEstablishment, getPageConfig, hashPlatformPassword, isAccountEmailAvailable,
  listAllEstablishments, listAllUsers, saveCreatedEstablishment, saveEstablishment,
  savePageConfig, savePlatformUser, type StoredPlatformUser,
} from "@/features/platform";
import type { Establishment, PublicPageConfig, PublicPaletteId, PublicTemplateId } from "@/types";

const emptyForm = { name: "", adminName: "", adminEmail: "", city: "", phone: "", password: "", confirmation: "" };
const emptyCredentials = { name: "", email: "", password: "", confirmation: "" };
const palettes: Array<{ id: PublicPaletteId; label: string; description: string; color: string }> = [
  { id: "moss", label: "Moss", description: "Verde natural e acolhedor", color: "#3f5845" },
  { id: "copper", label: "Copper", description: "Terracota sofisticado", color: "#b06f49" },
  { id: "sand", label: "Sand", description: "Neutros quentes", color: "#a98258" },
  { id: "ink", label: "Ink", description: "Contraste contemporâneo", color: "#28312c" },
  { id: "sage", label: "Sage", description: "Verde claro e sereno", color: "#758276" },
];
const templates: Array<{ id: PublicTemplateId; label: string; description: string }> = [
  { id: "editorial", label: "Editorial", description: "Imagem forte e textos em destaque" },
  { id: "atelier", label: "Ateliê", description: "Elegante, calmo e autoral" },
  { id: "barber", label: "Barbearia", description: "Contraste e foco nos serviços" },
  { id: "minimal", label: "Minimal", description: "Direto, leve e objetivo" },
  { id: "studio", label: "Studio", description: "Visual contemporâneo e amplo" },
  { id: "heritage", label: "Heritage", description: "Clássico com personalidade" },
];

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function validPassword(value: string) { return value.length >= 10 && /[A-Z]/.test(value) && /\d/.test(value); }
function defaultConfig(establishment: Establishment): PublicPageConfig {
  return {
    establishmentId: establishment.id, template: "editorial", palette: "moss",
    heroTitle: establishment.name, heroSubtitle: establishment.description,
    aboutText: establishment.description, backgroundColor: "#f4f2ec",
    coverUrl: establishment.coverUrl, logoUrl: establishment.logoUrl, updatedAt: new Date().toISOString(),
  };
}

export function PlatformEstablishmentsPage() {
  const { user, logout } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [credentials, setCredentials] = useState(emptyCredentials);
  const [, setRefresh] = useState(0);
  const [editing, setEditing] = useState<Establishment | null>(null);
  const [editor, setEditor] = useState<PublicPageConfig | null>(null);
  const [feedback, setFeedback] = useState("");
  const [createFeedback, setCreateFeedback] = useState<{ tone: "error" | "success"; message: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Establishment | null>(null);
  const establishments = listAllEstablishments();

  function update(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setCreateFeedback(null);
  }
  function startEditing(establishment: Establishment) {
    const admin = listAllUsers().find((candidate) => establishment.adminUserIds.includes(candidate.id));
    setEditing(establishment);
    setEditor(getPageConfig(establishment.id) ?? defaultConfig(establishment));
    setCredentials({ name: admin?.name ?? "", email: admin?.email ?? "", password: "", confirmation: "" });
    setFeedback("");
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateFeedback(null);
    const name = form.name.trim();
    const adminName = form.adminName.trim();
    const email = form.adminEmail.trim().toLowerCase();
    if (!name || !adminName || !/^\S+@\S+\.\S+$/.test(email)) {
      setCreateFeedback({ tone: "error", message: "Informe o nome do estabelecimento, o responsável e um e-mail válido." });
      return;
    }
    if (!isAccountEmailAvailable(email)) {
      setCreateFeedback({ tone: "error", message: "Este e-mail já pertence a uma conta. Use outro e-mail para o novo gestor ou edite o estabelecimento já vinculado." });
      return;
    }
    if (!validPassword(form.password) || form.password !== form.confirmation) {
      setCreateFeedback({ tone: "error", message: "A senha deve ter ao menos 10 caracteres, uma letra maiúscula e um número, e as duas senhas devem ser iguais." });
      return;
    }
    setCreating(true);
    try {
      const id = `est-${crypto.randomUUID()}`;
      const adminId = `usr-admin-${crypto.randomUUID()}`;
      const establishment: Establishment = {
        id, name, slug: `${slugify(name)}-${id.slice(-6)}`,
        description: "Novo estabelecimento no Agendito.", phone: form.phone.trim(),
        address: { street: "", number: "", district: "", city: form.city.trim(), state: "", postalCode: "" },
        timezone: "America/Sao_Paulo", adminUserIds: [adminId], active: true,
      };
      const admin: StoredPlatformUser = {
        id: adminId, name: adminName, email, role: "ADMIN", createdAt: new Date().toISOString(),
        passwordHash: await hashPlatformPassword(form.password), establishmentId: id,
      };
      if (!saveCreatedEstablishment(establishment, admin) || !savePageConfig(defaultConfig(establishment))) {
        setCreateFeedback({ tone: "error", message: "Não foi possível salvar a página neste navegador. Verifique o armazenamento local e tente novamente." });
        return;
      }
      setRefresh((value) => value + 1);
      setForm(emptyForm);
      setCreateFeedback({ tone: "success", message: `Página criada com sucesso. O gestor poderá entrar com ${email}.` });
    } catch {
      setCreateFeedback({ tone: "error", message: "Ocorreu um erro ao preparar a página. Tente novamente." });
    } finally {
      setCreating(false);
    }
  }

  function saveEditor() {
    if (!editing || !editor) return;
    const next = { ...editing, name: editor.heroTitle || editing.name, description: editor.heroSubtitle, logoUrl: editor.logoUrl, coverUrl: editor.coverUrl };
    if (!saveEstablishment(next) || !savePageConfig({ ...editor, establishmentId: editing.id, updatedAt: new Date().toISOString() })) {
      setFeedback("Não foi possível salvar a página.");
      return;
    }
    setEditing(next);
    setRefresh((value) => value + 1);
    setFeedback("Página atualizada com sucesso.");
  }

  async function saveCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setFeedback("");
    const adminId = editing.adminUserIds[0];
    const admin = listAllUsers().find((candidate) => candidate.id === adminId);
    const name = credentials.name.trim();
    const email = credentials.email.trim().toLowerCase();
    if (!admin || !name || !/^\S+@\S+\.\S+$/.test(email)) {
      setFeedback("Informe um gestor e um e-mail válido.");
      return;
    }
    if (!isAccountEmailAvailable(email, admin.id)) {
      setFeedback("Este e-mail já pertence a outra conta.");
      return;
    }
    if (credentials.password && (!validPassword(credentials.password) || credentials.password !== credentials.confirmation)) {
      setFeedback("A nova senha deve ter 10 caracteres, uma maiúscula e um número, e a confirmação deve ser igual.");
      return;
    }
    const existingHash = "passwordHash" in admin ? (admin as StoredPlatformUser).passwordHash : undefined;
    if (!credentials.password && !existingHash) {
      setFeedback("Defina uma senha para esta conta antes de salvar.");
      return;
    }
    const updated: StoredPlatformUser = {
      ...admin, name, email, establishmentId: editing.id,
      passwordHash: credentials.password ? await hashPlatformPassword(credentials.password) : existingHash!,
    };
    if (!savePlatformUser(updated)) {
      setFeedback("Não foi possível salvar o acesso neste navegador.");
      return;
    }
    setCredentials({ name, email, password: "", confirmation: "" });
    setFeedback("Acesso do gestor atualizado. A nova senha será usada no próximo login.");
  }

  function confirmRemove(establishment: Establishment) {
    if (deleteEstablishment(establishment.id)) {
      setEditing((current) => current?.id === establishment.id ? null : current);
      setEditor(null);
      setPendingDelete(null);
      setRefresh((value) => value + 1);
      setFeedback("");
    }
  }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setFeedback("Link copiado."); }
    catch { setFeedback(value); }
  }

  return <main className="platform-shell">
    <header className="platform-header">
      <div><span className="eyebrow">Console do proprietário</span><h1>Suas páginas</h1><p>Crie, edite e publique uma experiência personalizada para cada salão ou barbearia.</p></div>
      <div className="platform-header-actions">
        {user && <div className="platform-account" aria-label={`Perfil: ${user.name}, ${user.email}`}>
          <span className="platform-account-avatar" aria-hidden="true">{user.name.slice(0, 1)}</span>
          <span className="platform-account-name" title={user.name}>{user.name}</span>
          <span className="platform-account-separator" aria-hidden="true">·</span>
          <span className="platform-account-email" title={user.email}>{user.email}</span>
        </div>}
        <GlassButton variant="quiet" className="platform-logout" onClick={logout} aria-label="Sair"><LogOut size={16} /><span className="platform-logout-label">Sair</span></GlassButton>
      </div>
    </header>
    {feedback && !feedback.toLocaleLowerCase("pt-BR").includes("página excluída") && <p className="platform-feedback platform-global-feedback" role="status">{feedback}</p>}
    <div className="platform-grid">
      <GlassSurface material="frosted" className="platform-create">
        <div className="platform-section-heading"><span className="platform-icon"><Plus size={18} /></span><div><h2>Nova página</h2><p>Crie o estabelecimento e defina o acesso inicial do gestor.</p></div></div>
        <form onSubmit={create} className="platform-form platform-create-form">
          <GlassInput label="Nome do estabelecimento" value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Ex.: Barbearia Estilo" required />
          <GlassInput label="Nome do gestor" value={form.adminName} onChange={(event) => update("adminName", event.target.value)} placeholder="Ex.: Lucas Martins" required />
          <GlassInput label="E-mail de acesso definitivo" type="email" autoComplete="off" value={form.adminEmail} onChange={(event) => update("adminEmail", event.target.value)} placeholder="gestor@exemplo.com" required />
          <GlassInput label="Cidade" value={form.city} onChange={(event) => update("city", event.target.value)} placeholder="São Paulo" />
          <GlassInput label="Telefone" value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="(11) 00000-0000" />
          <PasswordField label="Senha inicial do gestor" autoComplete="new-password" value={form.password} onChange={(event) => update("password", event.target.value)} hint="Ao menos 10 caracteres, uma maiúscula e um número." required />
          <PasswordField label="Confirmar senha inicial" autoComplete="new-password" value={form.confirmation} onChange={(event) => update("confirmation", event.target.value)} required />
          <p className="platform-credential-note">O gestor poderá atualizar os dados de acesso a qualquer momento.</p>
          {createFeedback && <p className={`platform-form-feedback is-${createFeedback.tone}`} role={createFeedback.tone === "error" ? "alert" : "status"}>{createFeedback.tone === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}{createFeedback.message}</p>}
          <GlassButton type="submit" variant="primary" loading={creating} disabled={creating}><Building2 size={16} />Criar página</GlassButton>
        </form>
      </GlassSurface>
      <section className={`platform-list${establishments.length === 0 ? " is-empty" : ""}`}>
        {establishments.length > 0 && <div className="platform-section-heading"><span className="platform-icon"><Store size={18} /></span><div><h2>Páginas cadastradas</h2><p>{establishments.length} {establishments.length === 1 ? "página cadastrada" : "páginas cadastradas"}.</p></div></div>}
        {establishments.length === 0 && <GlassSurface material="regular" className="platform-empty-state">
          <span className="platform-empty-icon"><Building2 size={22} aria-hidden="true" /></span>
          <div><h3>Nenhum estabelecimento ainda</h3><p>As páginas criadas aparecerão aqui. Cadastre o primeiro estabelecimento para começar.</p></div>
        </GlassSurface>}
        {establishments.map((establishment) => <GlassSurface key={establishment.id} material="regular" className="platform-establishment-row">
          <div className="platform-establishment-copy"><strong>{establishment.name}</strong><span>{establishment.address.city || "Cidade não informada"} · {establishment.active === false ? "Rascunho" : "Página ativa"}</span><small>/e/{establishment.slug}</small></div>
          <div className="platform-establishment-actions">
            <GlassButton size="sm" variant="quiet" onClick={() => startEditing(establishment)}><Pencil size={14} />Editar</GlassButton>
            <GlassButton size="sm" variant="quiet" onClick={() => copy(`${window.location.origin}/e/${establishment.slug}`)}><Copy size={14} />Link</GlassButton>
            <GlassButton asChild size="sm" variant="ghost"><Link href={`/e/${establishment.slug}`} target="_blank"><ExternalLink size={14} />Abrir</Link></GlassButton>
            <GlassButton size="sm" variant="danger" onClick={() => setPendingDelete(establishment)} aria-label={`Excluir ${establishment.name}`}><Trash2 size={14} /></GlassButton>
          </div>
        </GlassSurface>)}
      </section>
    </div>
    {editing && editor && <section className="platform-editor">
      <div className="platform-editor-heading"><div><span className="eyebrow">Editor visual</span><h2>{editing.name}</h2><p>Escolha um modelo, uma paleta e personalize os conteúdos da página.</p></div><GlassButton variant="quiet" onClick={() => { setEditing(null); setEditor(null); }}>Fechar editor</GlassButton></div>
      <div className="platform-editor-grid">
        <GlassSurface material="frosted" className="platform-editor-panel">
          <div className="platform-subheading"><LayoutTemplate size={17} /><h3>Modelo da página</h3></div>
          <div className="template-grid">{templates.map((template) => <button type="button" className={`template-option ${editor.template === template.id ? "is-selected" : ""}`} key={template.id} onClick={() => setEditor({ ...editor, template: template.id })}><span className={`template-preview template-${template.id}`} /><strong>{template.label}</strong><small>{template.description}</small></button>)}</div>
          <div className="platform-subheading"><Store size={17} /><h3>Paleta de cores</h3></div>
          <div className="palette-grid">{palettes.map((palette) => <button type="button" className={`palette-option ${editor.palette === palette.id ? "is-selected" : ""}`} key={palette.id} onClick={() => setEditor({ ...editor, palette: palette.id })}><span style={{ background: palette.color }} /><strong>{palette.label}</strong><small>{palette.description}</small></button>)}</div>
        </GlassSurface>
        <GlassSurface material="frosted" className="platform-editor-panel">
          <div className="platform-subheading"><Pencil size={17} /><h3>Conteúdo e aparência</h3></div>
          <div className="platform-form">
            <GlassInput label="Título principal" value={editor.heroTitle} onChange={(event) => setEditor({ ...editor, heroTitle: event.target.value })} />
            <GlassInput label="Texto de destaque" value={editor.heroSubtitle} onChange={(event) => setEditor({ ...editor, heroSubtitle: event.target.value })} />
            <GlassInput label="Texto sobre o estabelecimento" value={editor.aboutText} onChange={(event) => setEditor({ ...editor, aboutText: event.target.value })} />
            <GlassInput label="URL da foto ou logo circular" value={editor.logoUrl ?? ""} onChange={(event) => setEditor({ ...editor, logoUrl: event.target.value })} placeholder="/brand/minha-logo.svg" />
            <GlassInput label="URL da capa horizontal" value={editor.coverUrl ?? ""} onChange={(event) => setEditor({ ...editor, coverUrl: event.target.value })} placeholder="/images/minha-capa.jpg" />
            <div className="platform-form-row">
              <GlassInput label="Cor de fundo" value={editor.backgroundColor} onChange={(event) => setEditor({ ...editor, backgroundColor: event.target.value })} placeholder="#f4f2ec" />
              <GlassSelect label="Status da página" value={editing.active === false ? "inactive" : "active"} onChange={(event) => setEditing({ ...editing, active: event.target.value === "active" })} options={[{ value: "active", label: "Publicada" }, { value: "inactive", label: "Rascunho" }]} />
            </div>
            <div className="platform-editor-actions"><GlassButton variant="primary" onClick={saveEditor}>Salvar alterações</GlassButton><GlassButton variant="danger" onClick={() => setPendingDelete(editing)}><Trash2 size={15} />Excluir página</GlassButton></div>
          </div>
        </GlassSurface>
      </div>
      <GlassSurface material="frosted" className="platform-editor-panel platform-access-panel">
        <div className="platform-subheading"><KeyRound size={17} /><h3>Acesso do gestor</h3></div>
        <p>O proprietário do Agendito define o e-mail de acesso e pode redefinir a senha inicial. O gestor também pode alterá-la no próprio painel.</p>
        <form className="platform-access-form" onSubmit={saveCredentials}>
          <GlassInput label="Nome do gestor" value={credentials.name} onChange={(event) => setCredentials({ ...credentials, name: event.target.value })} required />
          <GlassInput label="E-mail de acesso" type="email" value={credentials.email} onChange={(event) => setCredentials({ ...credentials, email: event.target.value })} required />
          <PasswordField label="Nova senha (opcional)" autoComplete="new-password" value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} hint="Deixe em branco para manter a senha atual." />
          <PasswordField label="Confirmar nova senha" autoComplete="new-password" value={credentials.confirmation} onChange={(event) => setCredentials({ ...credentials, confirmation: event.target.value })} />
          <GlassButton type="submit" variant="primary">Salvar acesso</GlassButton>
        </form>
      </GlassSurface>
    </section>}
    <GlassModal open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)} title="Excluir página" description={pendingDelete ? `A página de ${pendingDelete.name} deixará de aparecer no console e no endereço público.` : ""} footer={<><GlassButton variant="quiet" onClick={() => setPendingDelete(null)}>Cancelar</GlassButton><GlassButton variant="danger" onClick={() => pendingDelete && confirmRemove(pendingDelete)}><Trash2 size={15} />Excluir página</GlassButton></>}><p>Essa ação também remove a conta gestora criada exclusivamente para esta página quando ela estiver armazenada neste navegador.</p></GlassModal>
    <footer className="platform-footer"><span>Agendito</span><span aria-hidden="true">·</span><span>Console do proprietário</span></footer>
  </main>;
}
