"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, ImagePlus, Palette, Plus, Save, UsersRound, X } from "lucide-react";
import { PasswordField } from "@/components/auth";
import { GlassButton, GlassInput, GlassModal, GlassSelect, GlassSurface } from "@/components/ui";
import { SectionHeader } from "@/components/admin/page-layout";
import type { Establishment, PublicPageConfig } from "@/types";
import { hashPlatformPassword, isAccountEmailAvailable, listPlatformEstablishments, type StoredPlatformUser } from "./storage";
import { getInitialSettings, createDefaultOnboardingForm, applyEstablishmentPreset, establishmentPresets, ESTABLISHMENT_ONBOARDING_DRAFT_KEY, isValidEstablishmentSlug, onboardingFeatureOptions, slugifyEstablishment, type EstablishmentOnboardingForm, type EstablishmentPresetId } from "./establishment-onboarding";
import { provisionEstablishment } from "./provision-establishment";
import { recordPlatformAction } from "./owner-dashboard";
import { applyPublicPageTemplate, getCatalogTemplateId, PUBLIC_PAGE_TEMPLATES } from "./public-page-templates";

const steps = ["Informações", "Identidade", "Funcionalidades", "Revisão"];
const templates = PUBLIC_PAGE_TEMPLATES.map(({ id, name }) => ({ value: id, label: name }));
const paletteOptions = [{ value: "moss", label: "Moss" }, { value: "copper", label: "Copper" }, { value: "sand", label: "Sand" }, { value: "ink", label: "Ink" }, { value: "sage", label: "Sage" }];
const timezones = ["America/Sao_Paulo", "America/Manaus", "America/Cuiaba", "America/Belem", "America/Fortaleza", "America/Recife", "America/Bahia", "America/Noronha", "America/Rio_Branco", "Europe/Lisbon"];
const validPassword = (value: string) => value.length >= 10 && /[A-Z]/.test(value) && /\d/.test(value);

export function EstablishmentProvisioningWizard({ onCreated }: { onCreated: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [form, setForm] = useState(createDefaultOnboardingForm);
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const duplicateSlug = useMemo(() => Boolean(form.slug) && listPlatformEstablishments().some((establishment) => establishment.slug.toLowerCase() === form.slug.toLowerCase()), [form.slug]);

  function change<K extends keyof EstablishmentOnboardingForm>(field: K, value: EstablishmentOnboardingForm[K]) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "establishmentName") {
        const oldName = current.establishmentName.trim();
        const nextName = String(value);
        if (!current.publicName || current.publicName === oldName) next.publicName = nextName;
        if (!slugEdited) next.slug = slugifyEstablishment(next.publicName || nextName);
      }
      if (field === "publicName" && !slugEdited) next.slug = slugifyEstablishment(String(value));
      return next;
    });
    setError(""); setNotice("");
  }

  function changeSlug(value: string) {
    setSlugEdited(true);
    change("slug", slugifyEstablishment(value));
  }

  function selectPreset(value: EstablishmentPresetId) {
    setForm((current) => {
      const next = applyEstablishmentPreset(current, value);
      if (!slugEdited) next.slug = slugifyEstablishment(next.publicName || next.establishmentName);
      return next;
    });
    setError(""); setNotice("");
  }

  function requestAbandon() { setConfirmAbandon(true); }
  function abandon() {
    window.localStorage.removeItem(ESTABLISHMENT_ONBOARDING_DRAFT_KEY);
    setForm(createDefaultOnboardingForm()); setSlugEdited(false); setOpen(false); setConfirmAbandon(false); setError(""); setNotice("");
  }

  function saveDraftAndClose() {
    const safeForm = { ...form } as Partial<EstablishmentOnboardingForm>;
    delete safeForm.managerPassword;
    delete safeForm.managerPasswordConfirmation;
    try {
      window.localStorage.setItem(ESTABLISHMENT_ONBOARDING_DRAFT_KEY, JSON.stringify(safeForm));
      setNotice("Rascunho salvo neste navegador. A senha do gestor será solicitada quando você retomar."); setOpen(false);
      onCreated("Progresso do assistente salvo. Você pode retomá-lo no painel do proprietário.");
    } catch { setError("Não foi possível salvar o rascunho neste navegador."); }
  }

  function resumeDraft() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(ESTABLISHMENT_ONBOARDING_DRAFT_KEY) ?? "null") as Partial<EstablishmentOnboardingForm> | null;
      if (!saved) { setNotice("Não há rascunho salvo para retomar."); return; }
      const legacyStep = Math.min(4, Math.max(0, saved.step ?? 0));
      const nextStep = legacyStep <= 1 ? legacyStep : legacyStep <= 3 ? 2 : 3;
      const next = { ...createDefaultOnboardingForm(), ...saved, managerPassword: "", managerPasswordConfirmation: "", step: nextStep };
      setForm(next); setSlugEdited(Boolean(next.slug)); setOpen(true); setNotice("Rascunho retomado. Informe novamente a senha inicial do gestor."); setError("");
    } catch { setError("Não foi possível abrir o rascunho salvo."); }
  }

  function validateStep(step: number) {
    if (step === 0) {
      if (!form.establishmentName.trim() || !form.managerName.trim() || !form.managerEmail.trim()) return "Informe nome do estabelecimento, responsável e e-mail.";
      if (!/^\S+@\S+\.\S+$/.test(form.managerEmail.trim())) return "Informe um e-mail válido para o responsável.";
      if (!isAccountEmailAvailable(form.managerEmail)) return "Este e-mail já pertence a uma conta. Informe outro endereço.";
      if (!validPassword(form.managerPassword) || form.managerPassword !== form.managerPasswordConfirmation) return "A senha inicial deve ter 10 caracteres, uma letra maiúscula e um número; a confirmação deve ser igual.";
      if (!form.timezone) return "Selecione o fuso horário do estabelecimento.";
    }
    if (step === 1) {
      if (!form.publicName.trim()) return "Informe o nome que será exibido na página pública.";
      if (!isValidEstablishmentSlug(form.slug)) return "O identificador deve usar letras minúsculas, números e hífens, com até 60 caracteres.";
      if (duplicateSlug) return "Este endereço público já está em uso. Escolha outro identificador.";
      if (!/^#[0-9a-f]{6}$/i.test(form.primaryColor) || !/^#[0-9a-f]{6}$/i.test(form.secondaryColor)) return "Informe cores válidas para a identidade pública.";
    }
    return "";
  }

  function goNext() {
    const validation = validateStep(form.step);
    if (validation) { setError(validation); return; }
    setForm((current) => ({ ...current, step: Math.min(3, current.step + 1) })); setError(""); setNotice("");
  }

  async function finishProvisioning() {
    const validation = validateStep(0) || validateStep(1);
    if (validation) { setError(validation); setForm((current) => ({ ...current, step: validation.includes("públic") || validation.includes("identificador") || validation.includes("endereço") || validation.includes("cor") ? 1 : 0 })); return; }
    setSaving(true); setError("");
    try {
      const now = new Date().toISOString();
      const id = `est-${crypto.randomUUID()}`;
      const managerId = `usr-admin-${crypto.randomUUID()}`;
      const publishing = form.publishAfterCreate;
      const establishment: Establishment = {
        id,
        status: publishing ? "ACTIVE" : "INACTIVE",
        active: publishing,
        name: form.establishmentName.trim(),
        slug: form.slug,
        segment: form.segment.trim() || "Serviços",
        description: form.description.trim(),
        phone: form.managerPhone.trim(),
        logoUrl: form.logoUrl || undefined,
        createdAt: now,
        timezone: form.timezone,
        enabledFeatures: [...form.enabledFeatures],
        featureConfigVersion: 2,
        adminUserIds: [managerId],
        address: { street: form.street.trim(), number: form.number.trim(), district: form.district.trim(), city: form.city.trim(), state: form.state.trim(), postalCode: form.postalCode.trim() },
        settings: getInitialSettings(),
      };
      const manager: StoredPlatformUser = {
        id: managerId, name: form.managerName.trim(), email: form.managerEmail.trim().toLowerCase(), phone: form.managerPhone.trim(), role: "ADMIN", createdAt: now, establishmentId: id,
        passwordHash: await hashPlatformPassword(form.managerPassword),
      };
      const publicPageContent = applyPublicPageTemplate({
        template: form.template, palette: form.palette,
        heroTitle: form.publicName.trim(), heroSubtitle: form.description.trim(), aboutText: form.description.trim(), backgroundColor: "#f4f2ec",
        primaryColor: form.primaryColor, secondaryColor: form.secondaryColor, logoUrl: form.logoUrl || undefined,
      }, getCatalogTemplateId(form.template));
      const publicPage: PublicPageConfig = {
        ...publicPageContent, establishmentId: id, status: publishing ? "PUBLISHED" : "DRAFT", updatedAt: now,
      };
      const result = provisionEstablishment({ establishment, manager, publicPage });
      if (!result.ok) { setError(result.reason); return; }
      try { recordPlatformAction(establishment, "Estabelecimento provisionado pelo assistente"); } catch { /* provisioning is already committed; history is best-effort */ }
      window.localStorage.removeItem(ESTABLISHMENT_ONBOARDING_DRAFT_KEY);
      setOpen(false); setForm(createDefaultOnboardingForm()); setSlugEdited(false);
      onCreated(`${establishment.name} criado como ${publishing ? "ativo, com página publicada" : "inativo, com página em rascunho"}. Link: ${window.location.origin}/e/${establishment.slug}`);
    } catch {
      setError("Não foi possível concluir o cadastro. Nenhuma alteração parcial foi confirmada. Tente novamente.");
    } finally { setSaving(false); }
  }

  function handleLogoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 1024 * 1024) { setError("Escolha uma imagem de até 1 MB."); event.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") change("logoUrl", reader.result); };
    reader.onerror = () => setError("Não foi possível carregar a imagem escolhida.");
    reader.readAsDataURL(file);
  }

  return <>
    <GlassSurface material="frosted" className="platform-create onboarding-launcher">
      <SectionHeader className="platform-section-heading"><span className="platform-icon"><Plus size={18} /></span><div><h2>Novo estabelecimento</h2><p>Configure os dados cadastrais, a página pública e os recursos em etapas.</p></div></SectionHeader>
      <div className="onboarding-launch-actions"><GlassButton variant="primary" onClick={() => { setForm(createDefaultOnboardingForm()); setSlugEdited(false); setOpen(true); }}><Building2 size={16} />Iniciar cadastro</GlassButton><GlassButton variant="quiet" onClick={resumeDraft}><ArrowRight size={15} />Retomar rascunho</GlassButton></div>
      {notice && !open && <p className="onboarding-launch-notice" role="status"><CheckCircle2 size={15} />{notice}</p>}
    </GlassSurface>

    <GlassModal open={open} onClose={requestAbandon} title="Provisionar estabelecimento" description="Configure o cadastro em quatro etapas. A operação será definida pelo gestor no painel do estabelecimento.">
      <div className="onboarding-wizard">
        <ol className="onboarding-stepper" aria-label="Etapas do cadastro">{steps.map((label, index) => <li key={label} className={index === form.step ? "is-current" : index < form.step ? "is-complete" : ""}><span>{index < form.step ? <Check size={14} /> : index + 1}</span><small>{label}</small></li>)}</ol>
        {notice && <p className="onboarding-notice" role="status">{notice}</p>}
        {error && <p className="onboarding-error" role="alert"><AlertCircle size={16} />{error}</p>}

        {form.step === 0 && <section className="onboarding-step"><h3><Building2 size={18} />Informações do estabelecimento</h3><GlassSelect label="Modelo inicial editável" value={form.preset} onChange={(event) => selectPreset(event.target.value as EstablishmentPresetId)} options={establishmentPresets.map(({ id, name }) => ({ value: id, label: name }))} /><div className="onboarding-fields"><GlassInput label="Nome do estabelecimento *" value={form.establishmentName} onChange={(event) => change("establishmentName", event.target.value)} required /><GlassInput label="Nome do responsável *" value={form.managerName} onChange={(event) => change("managerName", event.target.value)} required /><GlassInput label="E-mail de acesso do responsável *" type="email" value={form.managerEmail} onChange={(event) => change("managerEmail", event.target.value)} required /><GlassInput label="Telefone" type="tel" value={form.managerPhone} onChange={(event) => change("managerPhone", event.target.value)} /><PasswordField label="Senha inicial do gestor *" autoComplete="new-password" value={form.managerPassword} onChange={(event) => change("managerPassword", event.target.value)} hint="Mínimo de 10 caracteres, uma maiúscula e um número." /><PasswordField label="Confirmar senha inicial *" autoComplete="new-password" value={form.managerPasswordConfirmation} onChange={(event) => change("managerPasswordConfirmation", event.target.value)} /><GlassInput label="Segmento" value={form.segment} onChange={(event) => change("segment", event.target.value)} placeholder="Ex.: Barbearia" /><GlassInput label="Descrição" value={form.description} onChange={(event) => change("description", event.target.value)} /><GlassInput label="Rua" value={form.street} onChange={(event) => change("street", event.target.value)} /><GlassInput label="Número" value={form.number} onChange={(event) => change("number", event.target.value)} /><GlassInput label="Bairro" value={form.district} onChange={(event) => change("district", event.target.value)} /><GlassInput label="CEP" value={form.postalCode} onChange={(event) => change("postalCode", event.target.value)} /><GlassInput label="Cidade" value={form.city} onChange={(event) => change("city", event.target.value)} /><GlassInput label="Estado" value={form.state} onChange={(event) => change("state", event.target.value)} /><GlassSelect label="Fuso horário" value={form.timezone} onChange={(event) => change("timezone", event.target.value)} options={timezones.map((timezone) => ({ value: timezone, label: timezone.replaceAll("_", " ") }))} /></div></section>}

        {form.step === 1 && <section className="onboarding-step"><h3><Palette size={18} />Identidade da página pública</h3><div className="onboarding-fields"><GlassInput label="Nome público" value={form.publicName || form.establishmentName} onChange={(event) => change("publicName", event.target.value)} required /><GlassInput label="Endereço / identificador público" value={form.slug} onChange={(event) => changeSlug(event.target.value)} hint={`Prévia: /e/${form.slug || "seu-endereco"}`} error={duplicateSlug ? "Este endereço já está sendo usado." : undefined} required /><GlassSelect label="Modelo visual" value={form.template} onChange={(event) => change("template", event.target.value as EstablishmentOnboardingForm["template"])} options={templates} /><GlassSelect label="Paleta base" value={form.palette} onChange={(event) => change("palette", event.target.value as EstablishmentOnboardingForm["palette"])} options={paletteOptions} /><GlassInput label="Cor principal" type="color" value={form.primaryColor} onChange={(event) => change("primaryColor", event.target.value)} /><GlassInput label="Cor secundária" type="color" value={form.secondaryColor} onChange={(event) => change("secondaryColor", event.target.value)} /><label className="onboarding-upload"><ImagePlus size={17} /><span>Logo do estabelecimento <small>Imagem de até 1 MB. Você também pode informar URL no campo abaixo.</small></span><input type="file" accept="image/*" onChange={handleLogoUpload} /></label><GlassInput label="URL da logo (opcional)" value={form.logoUrl.startsWith("data:") ? "Imagem selecionada" : form.logoUrl} onChange={(event) => change("logoUrl", event.target.value)} placeholder="https://exemplo.com/logo.png" disabled={form.logoUrl.startsWith("data:")} /></div>{form.logoUrl && <div className="onboarding-logo-preview"><img src={form.logoUrl} alt="Prévia da logo" /><GlassButton size="sm" variant="quiet" onClick={() => change("logoUrl", "")}><X size={14} />Remover logo</GlassButton></div>}</section>}

        {form.step === 2 && <section className="onboarding-step"><h3><UsersRound size={18} />Funcionalidades habilitadas</h3><p>Marque os recursos que estarão disponíveis para este estabelecimento.</p><div className="onboarding-feature-list">{onboardingFeatureOptions.map((feature) => <label key={feature.id}><input type="checkbox" checked={form.enabledFeatures.includes(feature.id)} onChange={(event) => change("enabledFeatures", event.target.checked ? [...form.enabledFeatures, feature.id] : form.enabledFeatures.filter((item) => item !== feature.id))} /><span><strong>{feature.label}</strong><small>{feature.description}</small></span></label>)}</div></section>}

        {form.step === 3 && <section className="onboarding-step"><h3><CheckCircle2 size={18} />Revise antes de criar</h3><div className="onboarding-review"><article><b>Informações</b><span>{form.establishmentName || "Sem nome"} · {form.segment || "Segmento não informado"}</span><span>{form.managerName} · {form.managerEmail}</span><span>{[form.street, form.number, form.district, form.city, form.state].filter(Boolean).join(", ") || "Endereço não informado"}</span><span>{form.timezone}</span></article><article><b>Identidade pública</b><span>{form.publicName || form.establishmentName} · /e/{form.slug || "—"}</span><span>Modelo: {templates.find((item) => item.value === form.template)?.label}</span><span>Cores: {form.primaryColor} · {form.secondaryColor}</span><span>Logo {form.logoUrl ? "adicionada" : "não adicionada"}</span></article><article><b>Operação</b><span>Horários, serviços e políticas serão definidos pelo gestor no painel do estabelecimento.</span></article><article><b>Recursos</b><span>{form.enabledFeatures.length ? onboardingFeatureOptions.filter((item) => form.enabledFeatures.includes(item.id)).map((item) => item.label).join(" · ") : "Nenhum recurso marcado"}</span></article></div><label className="onboarding-publish-choice"><input type="checkbox" checked={form.publishAfterCreate} onChange={(event) => change("publishAfterCreate", event.target.checked)} /><span><strong>Publicar a página ao concluir</strong><small>Desmarcado por padrão. Sem esta escolha, o estabelecimento fica inativo e a página em rascunho.</small></span></label></section>}

        <div className="onboarding-wizard-footer"><GlassButton variant="quiet" onClick={requestAbandon}>Abandonar</GlassButton><div>{form.step > 0 && <GlassButton variant="quiet" onClick={() => { setForm((current) => ({ ...current, step: current.step - 1 })); setError(""); }}><ArrowLeft size={15} />Voltar</GlassButton>}<GlassButton variant="ghost" onClick={saveDraftAndClose}><Save size={15} />Salvar rascunho</GlassButton>{form.step < 3 ? <GlassButton variant="primary" onClick={goNext}>Continuar<ArrowRight size={15} /></GlassButton> : <GlassButton variant="primary" loading={saving} disabled={saving} onClick={finishProvisioning}><Building2 size={15} />{form.publishAfterCreate ? "Criar e publicar" : "Criar como rascunho"}</GlassButton>}</div></div>
      </div>
    </GlassModal>
    <GlassModal open={confirmAbandon} onClose={() => setConfirmAbandon(false)} title="Abandonar o cadastro?" description="As informações não salvas serão descartadas.">
      <div className="onboarding-confirm-abandon"><p>Se quiser continuar depois, escolha <strong>Salvar rascunho</strong> antes. Ao confirmar o abandono, o rascunho anterior também será removido.</p><div><GlassButton variant="quiet" onClick={() => setConfirmAbandon(false)}>Continuar cadastro</GlassButton><GlassButton variant="danger" onClick={abandon}>Descartar e sair</GlassButton></div></div>
    </GlassModal>
  </>;
}

