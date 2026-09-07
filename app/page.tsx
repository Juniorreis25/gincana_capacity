'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, LayoutDashboard, ListChecks, Medal, Package, Pencil, Plus, RefreshCw, Trash2, UserCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  adminMutation,
  createLaunch,
  deleteLaunch,
  loadAdminData,
  loadBootstrap,
  updateLaunch,
  type AdminData,
  type BootstrapData,
  type ConnectionMode,
  type EnrollmentRow,
  type RankingRow,
} from '@/lib/integration';

type PageName = 'dashboard' | 'participants' | 'products' | 'enrollments';
const emptyBootstrap: BootstrapData = { participants: [], products: [], history: [] };
const emptyAdmin: AdminData = { participants: [], products: [] };
const pageTitles: Record<PageName, string> = { dashboard: 'Visão geral', participants: 'Participantes', products: 'Produtos', enrollments: 'Inscrições' };

export default function Home() {
  const [view, setView] = useState<'admin' | 'scoreboard'>('admin');
  const [routeReady, setRouteReady] = useState(false);
  const [page, setPage] = useState<PageName>('dashboard');
  const [mode, setMode] = useState<ConnectionMode>('loading');
  const [bootstrap, setBootstrap] = useState<BootstrapData>(emptyBootstrap);
  const [adminData, setAdminData] = useState<AdminData>(emptyAdmin);
  const [message, setMessage] = useState('');
  const [messageIsError, setMessageIsError] = useState(false);
  const [enrollmentOpen, setEnrollmentOpen] = useState(false);
  const [editingEnrollment, setEditingEnrollment] = useState<EnrollmentRow | null>(null);

  useEffect(() => {
    setView(new URLSearchParams(window.location.search).get('view') === 'scoreboard' ? 'scoreboard' : 'admin');
    setRouteReady(true);
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      const [live, admin] = await Promise.all([loadBootstrap(), loadAdminData()]);
      setBootstrap(live);
      setAdminData(admin);
      setMode('live');
      return live;
    } catch (error) {
      setMode('error');
      throw error;
    }
  }, []);

  const refreshScoreboard = useCallback(async () => {
    try {
      const live = await loadBootstrap();
      setBootstrap(live);
      setMode('live');
      return live;
    } catch {
      setMode('error');
      return null;
    }
  }, []);

  useEffect(() => {
    if (!routeReady) return;
    const controller = new AbortController();
    setMode('loading');
    void Promise.all([loadBootstrap(controller.signal), loadAdminData(controller.signal)]).then(([live, admin]) => {
      setBootstrap(live);
      setAdminData(admin);
      setMode('live');
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setMode('error');
    });
    return () => controller.abort();
  }, [routeReady]);

  const mutate = async (action: string, input: Record<string, unknown>, success: string) => {
    setMessage('');
    try {
      const admin = await adminMutation(action, input);
      const live = await loadBootstrap();
      setAdminData(admin);
      setBootstrap(live);
      setMode('live');
      setMessageIsError(false);
      setMessage(success);
    } catch (error) {
      setMessageIsError(true);
      setMessage(error instanceof Error ? error.message : 'Não foi possível concluir a operação.');
      throw error;
    }
  };

  const openScoreboard = () => {
    const next = window.open(`${window.location.origin}/?view=scoreboard`, '_blank', 'noopener,noreferrer');
    if (next) next.opener = null;
  };

  const openNewEnrollment = () => { setEditingEnrollment(null); setEnrollmentOpen(true); };
  const totalRegistrations = bootstrap.participants.reduce((sum, item) => sum + item.registrations, 0);

  if (!routeReady) return <LoadingScreen />;
  if (view === 'scoreboard') return <Scoreboard ranking={bootstrap.participants} mode={mode} onReload={refreshScoreboard} />;

  const navItems: Array<{ id: PageName; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'dashboard', label: 'Visão geral', icon: LayoutDashboard },
    { id: 'participants', label: 'Participantes', icon: Users },
    { id: 'products', label: 'Produtos', icon: Package },
    { id: 'enrollments', label: 'Inscrições', icon: ListChecks },
  ];

  return <>
    <main className="admin-shell min-h-screen text-slate-950">
      <aside className="sidebar-panel">
        <div className="brand-block"><div className="brand-logo-wrap"><img src="/capacity-logo.png" alt="Capacity" /></div><span>Placar comercial</span></div>
        <nav aria-label="Navegação principal" className="nav-list">{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setPage(item.id)} className={page === item.id ? 'nav-item active' : 'nav-item'}><Icon size={19} />{item.label}</button>; })}</nav>
        <div className="sidebar-footer"><div className="user-chip"><span>MS</span><div><strong>Marina Souza</strong><small>Supervisora</small></div></div></div>
      </aside>
      <section className="main-panel">
        <header className="topbar">
          <div><div className="topbar-kicker"><p className="eyebrow">Gestão comercial</p><ConnectionBadge mode={mode} hasData={adminData.participants.length + adminData.products.length > 0} /></div><h1>{pageTitles[page]}</h1></div>
          <div className="topbar-actions"><Button variant="outline" className="rounded-full" onClick={openScoreboard}><Eye size={17}/> Ver placar da TV</Button><Button className="primary-action rounded-full" disabled={mode !== 'live'} onClick={openNewEnrollment}><Plus size={18}/> Registrar inscrição</Button></div>
        </header>
        <div className="content-wrap">
          {message && <p className={messageIsError ? 'success-banner error' : 'success-banner'} role={messageIsError ? 'alert' : 'status'}>{message}</p>}
          {mode === 'error' && <ConnectionError onRetry={() => { void refreshAll().catch(() => undefined); }} />}
          {page === 'dashboard' && <Dashboard participants={adminData.participants.filter((item) => item.active).length} products={adminData.products.filter((item) => item.active).length} total={totalRegistrations} leader={bootstrap.participants[0]} history={bootstrap.history} onRegister={openNewEnrollment} onScoreboard={openScoreboard} />}
          {page === 'participants' && <ParticipantsView data={adminData} onMutate={mutate} />}
          {page === 'products' && <ProductsView data={adminData} onMutate={mutate} />}
          {page === 'enrollments' && <EnrollmentsView history={bootstrap.history} onNew={openNewEnrollment} onEdit={(row) => { setEditingEnrollment(row); setEnrollmentOpen(true); }} onDeleted={async (id) => { setBootstrap(await deleteLaunch(id)); setMessageIsError(false); setMessage('Inscrição excluída. O placar foi atualizado.'); }} />}
        </div>
      </section>
    </main>
    <EnrollmentDialog open={enrollmentOpen} onOpenChange={setEnrollmentOpen} editing={editingEnrollment} participants={adminData.participants.filter((item) => item.active)} products={adminData.products.filter((item) => item.active)} onSaved={async (input) => { const live = editingEnrollment ? await updateLaunch({ id: editingEnrollment.id, ...input }) : await createLaunch(input); setBootstrap(live); setAdminData(await loadAdminData()); setEnrollmentOpen(false); setEditingEnrollment(null); setMessageIsError(false); setMessage(editingEnrollment ? 'Inscrição atualizada. O placar foi recalculado.' : 'Inscrição registrada. O placar foi atualizado.'); }} />
  </>;
}

function ConnectionBadge({ mode, hasData }: { mode: ConnectionMode; hasData: boolean }) {
  const text = mode === 'loading' ? 'Carregando dados…' : mode === 'error' ? 'Erro de conexão' : hasData ? 'Conectado à planilha' : 'Conectado · base vazia';
  return <span className={`integration-badge ${mode}`} aria-live="polite">{text}</span>;
}

function LoadingScreen() { return <main className="loading-screen"><img src="/capacity-logo.png" alt="Capacity"/><p>Carregando o painel…</p></main>; }

function ConnectionError({ onRetry }: { onRetry: () => void }) { return <section className="connection-error"><div><strong>Não foi possível acessar a planilha.</strong><span>Os últimos dados válidos foram mantidos. Tente novamente.</span></div><Button variant="outline" onClick={onRetry}><RefreshCw size={16}/> Tentar novamente</Button></section>; }

function Dashboard({ participants, products, total, leader, history, onRegister, onScoreboard }: { participants: number; products: number; total: number; leader?: RankingRow; history: EnrollmentRow[]; onRegister: () => void; onScoreboard: () => void }) {
  return <div className="simple-dashboard">
    <section className="metrics-grid simple-metrics">
      <Metric label="Participantes ativos" value={String(participants)} icon={<UserCheck/>}/><Metric label="Produtos ativos" value={String(products)} icon={<Package/>}/><Metric label="Total de inscrições" value={String(total)} icon={<ListChecks/>}/><Metric label="Líder atual" value={leader?.name || 'Ainda não definido'} detail={leader ? `${leader.registrations} inscrições` : 'Aguardando registros'} icon={<Medal/>} featured/>
    </section>
    <section className="quick-actions panel-card"><div><p className="eyebrow">Ações rápidas</p><h2>O essencial, em poucos cliques</h2></div><div><Button className="primary-action" onClick={onRegister}><Plus size={17}/> Registrar inscrição</Button><Button variant="outline" onClick={onScoreboard}><Eye size={17}/> Ver placar da TV</Button></div></section>
    <RecentEnrollments history={history.slice(0, 6)} />
  </div>;
}

function Metric({ label, value, detail, icon, featured = false }: { label: string; value: string; detail?: string; icon: React.ReactNode; featured?: boolean }) { return <article className={featured ? 'metric-card featured' : 'metric-card'}><div className="metric-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div></article>; }

function RecentEnrollments({ history }: { history: EnrollmentRow[] }) { return <section className="panel-card list-page"><div className="list-page-head"><div><p className="eyebrow">Atividade recente</p><h2>Últimos registros</h2></div></div>{history.length ? <div className="simple-table">{history.map((row) => <div className="simple-row" key={row.id}><span>{formatDate(row.date)}</span><strong>{row.participant}</strong><span>{row.product}</span><b>{row.quantity}</b><em className={row.status === 'ATIVO' ? 'active' : ''}>{row.status === 'ATIVO' ? 'Ativa' : 'Excluída'}</em></div>)}</div> : <EmptyState text="Nenhuma inscrição registrada."/>}</section>; }

function ParticipantsView({ data, onMutate }: { data: AdminData; onMutate: (action: string, input: Record<string, unknown>, success: string) => Promise<void> }) {
  const [editing, setEditing] = useState<AdminData['participants'][number] | null>(null); const [open, setOpen] = useState(false); const [confirm, setConfirm] = useState<AdminData['participants'][number] | null>(null);
  return <section className="panel-card list-page"><div className="list-page-head"><div><p className="eyebrow">Cadastros</p><h2>Participantes</h2></div><Button className="primary-action" onClick={() => { setEditing(null); setOpen(true); }}><Plus size={16}/> Nova participante</Button></div>{data.participants.length ? <div className="people-grid">{data.participants.map((item) => <article className="person-card" key={item.id}><Avatar name={item.name} url={item.avatarUrl}/><div><strong>{item.name}</strong><p>{item.active ? 'Ativa' : 'Inativa'} · {item.historyCount} registros</p></div><div className="admin-row-actions"><Button variant="outline" onClick={() => { setEditing(item); setOpen(true); }}><Pencil/> Editar</Button><Button variant="outline" onClick={() => void onMutate(item.active ? 'deactivateParticipant' : 'activateParticipant', { id: item.id }, item.active ? 'Participante desativada.' : 'Participante reativada.')}>{item.active ? 'Desativar' : 'Reativar'}</Button><Button variant="destructive" onClick={() => setConfirm(item)}><Trash2/> Excluir</Button></div></article>)}</div> : <EmptyState text="Nenhuma participante cadastrada."/>}<ParticipantDialog open={open} onOpenChange={setOpen} editing={editing} onSave={async (input) => { await onMutate(editing ? 'updateParticipant' : 'createParticipant', editing ? { id: editing.id, ...input } : input, editing ? 'Participante atualizada.' : 'Participante cadastrada.'); setOpen(false); }}/><ConfirmDialog open={Boolean(confirm)} title={confirm?.historyCount ? 'Desativar participante?' : 'Excluir participante?'} description={confirm?.historyCount ? 'Esta participante possui histórico e não pode ser excluída. Ela será desativada e deixará de aparecer em novas inscrições.' : 'Esta participante será removida definitivamente.'} confirmLabel={confirm?.historyCount ? 'Desativar' : 'Excluir'} onOpenChange={(value) => !value && setConfirm(null)} onConfirm={async () => { if (!confirm) return; await onMutate(confirm.historyCount ? 'deactivateParticipant' : 'deleteParticipant', { id: confirm.id }, confirm.historyCount ? 'Participante desativada.' : 'Participante excluída.'); setConfirm(null); }}/></section>;
}

function ProductsView({ data, onMutate }: { data: AdminData; onMutate: (action: string, input: Record<string, unknown>, success: string) => Promise<void> }) {
  const [editing, setEditing] = useState<AdminData['products'][number] | null>(null); const [open, setOpen] = useState(false); const [confirm, setConfirm] = useState<AdminData['products'][number] | null>(null);
  return <section className="panel-card list-page"><div className="list-page-head"><div><p className="eyebrow">Cadastros</p><h2>Produtos</h2></div><Button className="primary-action" onClick={() => { setEditing(null); setOpen(true); }}><Plus size={16}/> Novo produto</Button></div>{data.products.length ? <div className="people-grid">{data.products.map((item) => <article className="person-card" key={item.id}><span className="avatar large">{item.name.slice(0,2).toUpperCase()}</span><div><strong>{item.name}</strong><p>{item.category || 'Sem categoria'} · {item.active ? 'Ativo' : 'Inativo'} · {item.historyCount} registros</p></div><div className="admin-row-actions"><Button variant="outline" onClick={() => { setEditing(item); setOpen(true); }}><Pencil/> Editar</Button><Button variant="outline" onClick={() => void onMutate(item.active ? 'deactivateProduct' : 'activateProduct', { id: item.id }, item.active ? 'Produto desativado.' : 'Produto reativado.')}>{item.active ? 'Desativar' : 'Reativar'}</Button><Button variant="destructive" onClick={() => setConfirm(item)}><Trash2/> Excluir</Button></div></article>)}</div> : <EmptyState text="Nenhum produto cadastrado."/>}<ProductDialog open={open} onOpenChange={setOpen} editing={editing} onSave={async (input) => { await onMutate(editing ? 'updateProduct' : 'createProduct', editing ? { id: editing.id, ...input } : input, editing ? 'Produto atualizado.' : 'Produto cadastrado.'); setOpen(false); }}/><ConfirmDialog open={Boolean(confirm)} title={confirm?.historyCount ? 'Desativar produto?' : 'Excluir produto?'} description={confirm?.historyCount ? 'Este produto possui histórico e não pode ser excluído. Ele será desativado e deixará de aparecer em novas inscrições.' : 'Este produto será removido definitivamente.'} confirmLabel={confirm?.historyCount ? 'Desativar' : 'Excluir'} onOpenChange={(value) => !value && setConfirm(null)} onConfirm={async () => { if (!confirm) return; await onMutate(confirm.historyCount ? 'deactivateProduct' : 'deleteProduct', { id: confirm.id }, confirm.historyCount ? 'Produto desativado.' : 'Produto excluído.'); setConfirm(null); }}/></section>;
}

function EnrollmentsView({ history, onNew, onEdit, onDeleted }: { history: EnrollmentRow[]; onNew: () => void; onEdit: (row: EnrollmentRow) => void; onDeleted: (id: string) => Promise<void> }) {
  const [confirm, setConfirm] = useState<EnrollmentRow | null>(null);
  return <section className="panel-card list-page"><div className="list-page-head"><div><p className="eyebrow">Movimentações</p><h2>Inscrições</h2></div><Button className="primary-action" onClick={onNew}><Plus size={16}/> Nova inscrição</Button></div>{history.length ? <div className="enrollment-table"><div className="enrollment-row head"><span>Data</span><span>Participante</span><span>Produto</span><span>Quantidade</span><span>Situação</span><span>Ações</span></div>{history.map((row) => <div className="enrollment-row" key={row.id}><span>{formatDate(row.date)}</span><strong>{row.participant || 'Cadastro indisponível'}</strong><span>{row.product || 'Cadastro indisponível'}</span><b>{row.quantity}</b><em className={row.status === 'ATIVO' ? 'active' : ''}>{row.status === 'ATIVO' ? 'Ativa' : 'Excluída'}</em><div>{row.status === 'ATIVO' && <><Button variant="outline" onClick={() => onEdit(row)}><Pencil/> Editar</Button><Button variant="destructive" onClick={() => setConfirm(row)}><Trash2/> Excluir</Button></>}</div></div>)}</div> : <EmptyState text="Nenhuma inscrição registrada."/>}<ConfirmDialog open={Boolean(confirm)} title="Excluir inscrição?" description="A inscrição deixará de contar no placar, mas permanecerá registrada para auditoria." confirmLabel="Excluir inscrição" onOpenChange={(value) => !value && setConfirm(null)} onConfirm={async () => { if (!confirm) return; await onDeleted(confirm.id); setConfirm(null); }}/></section>;
}

function ParticipantDialog({ open, onOpenChange, editing, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; editing: AdminData['participants'][number] | null; onSave: (input: { name: string; avatarUrl: string }) => Promise<void> }) {
  const [name, setName] = useState(''); const [avatarUrl, setAvatarUrl] = useState(''); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (open) { setName(editing?.name || ''); setAvatarUrl(editing?.avatarUrl || ''); setError(''); } }, [open, editing]);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="entity-dialog"><DialogHeader><DialogTitle>{editing ? 'Editar participante' : 'Nova participante'}</DialogTitle><DialogDescription>Informe apenas os dados necessários para o cadastro.</DialogDescription></DialogHeader><div className="form-grid one-column"><Field label="Nome" id="participant-name"><Input id="participant-name" value={name} onChange={(e) => setName(e.target.value)}/></Field><Field label="URL do avatar (opcional)" id="participant-avatar"><Input id="participant-avatar" type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..."/></Field></div>{error && <p className="form-error" role="alert">{error}</p>}<DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button className="primary-action" disabled={saving || !name.trim()} onClick={() => { setSaving(true); setError(''); void onSave({ name: name.trim(), avatarUrl: avatarUrl.trim() }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Não foi possível salvar.')).finally(() => setSaving(false)); }}>{saving ? 'Salvando…' : 'Salvar'}</Button></DialogFooter></DialogContent></Dialog>;
}

function ProductDialog({ open, onOpenChange, editing, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; editing: AdminData['products'][number] | null; onSave: (input: { name: string; category: string }) => Promise<void> }) {
  const [name, setName] = useState(''); const [category, setCategory] = useState(''); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (open) { setName(editing?.name || ''); setCategory(editing?.category || ''); setError(''); } }, [open, editing]);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="entity-dialog"><DialogHeader><DialogTitle>{editing ? 'Editar produto' : 'Novo produto'}</DialogTitle><DialogDescription>Cadastre o produto vendido pela supervisora.</DialogDescription></DialogHeader><div className="form-grid one-column"><Field label="Nome do produto" id="product-name"><Input id="product-name" value={name} onChange={(e) => setName(e.target.value)}/></Field><Field label="Categoria (opcional)" id="product-category"><Input id="product-category" value={category} onChange={(e) => setCategory(e.target.value)}/></Field></div>{error && <p className="form-error" role="alert">{error}</p>}<DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button className="primary-action" disabled={saving || !name.trim()} onClick={() => { setSaving(true); setError(''); void onSave({ name: name.trim(), category: category.trim() }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Não foi possível salvar.')).finally(() => setSaving(false)); }}>{saving ? 'Salvando…' : 'Salvar'}</Button></DialogFooter></DialogContent></Dialog>;
}

function EnrollmentDialog({ open, onOpenChange, editing, participants, products, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; editing: EnrollmentRow | null; participants: AdminData['participants']; products: AdminData['products']; onSaved: (input: { participantId: string; productId: string; quantity: number; date: string; notes?: string }) => Promise<void> }) {
  const [participantId, setParticipantId] = useState(''); const [productId, setProductId] = useState(''); const [quantity, setQuantity] = useState(1); const [date, setDate] = useState(today()); const [notes, setNotes] = useState(''); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (!open) return; setParticipantId(editing?.participantId || participants[0]?.id || ''); setProductId(editing?.productId || products[0]?.id || ''); setQuantity(editing?.quantity || 1); setDate(editing?.date?.slice(0,10) || today()); setNotes(editing?.notes || ''); setError(''); }, [open, editing, participants, products]);
  const canSave = participantId && productId && Number.isInteger(quantity) && quantity > 0 && date;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="entity-dialog enrollment-dialog"><DialogHeader><DialogTitle>{editing ? 'Editar inscrição' : 'Registrar inscrição'}</DialogTitle><DialogDescription>O placar será recalculado automaticamente após salvar.</DialogDescription></DialogHeader>{participants.length && products.length ? <div className="form-grid"><Field label="Participante" id="enrollment-participant"><select id="enrollment-participant" value={participantId} onChange={(e) => setParticipantId(e.target.value)}>{participants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Produto" id="enrollment-product"><select id="enrollment-product" value={productId} onChange={(e) => setProductId(e.target.value)}>{products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Quantidade" id="enrollment-quantity"><Input id="enrollment-quantity" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}/></Field><Field label="Data" id="enrollment-date"><Input id="enrollment-date" type="date" value={date} onChange={(e) => setDate(e.target.value)}/></Field><div className="field full"><Label htmlFor="enrollment-notes">Observação (opcional)</Label><Input id="enrollment-notes" value={notes} onChange={(e) => setNotes(e.target.value)}/></div></div> : <EmptyState text="Cadastre ao menos uma participante e um produto ativos antes de registrar uma inscrição."/>}{error && <p className="form-error" role="alert">{error}</p>}<DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button className="primary-action" disabled={saving || !canSave} onClick={() => { setSaving(true); setError(''); void onSaved({ participantId, productId, quantity, date, notes: notes.trim() }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Não foi possível salvar.')).finally(() => setSaving(false)); }}>{saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Registrar inscrição'}</Button></DialogFooter></DialogContent></Dialog>;
}

function ConfirmDialog({ open, title, description, confirmLabel, onOpenChange, onConfirm }: { open: boolean; title: string; description: string; confirmLabel: string; onOpenChange: (open: boolean) => void; onConfirm: () => Promise<void> }) { const [busy, setBusy] = useState(false); const [error, setError] = useState(''); useEffect(() => { if (open) setError(''); }, [open]); return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>{error && <p className="form-error" role="alert">{error}</p>}<DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button variant="destructive" disabled={busy} onClick={() => { setBusy(true); setError(''); void onConfirm().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Não foi possível concluir.')).finally(() => setBusy(false)); }}>{busy ? 'Processando…' : confirmLabel}</Button></DialogFooter></DialogContent></Dialog>; }

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) { return <div className="field"><Label htmlFor={id}>{label}</Label>{children}</div>; }
function EmptyState({ text }: { text: string }) { return <div className="empty-state"><ListChecks size={23}/><p>{text}</p></div>; }
function Avatar({ name, url }: { name: string; url?: string }) { return url ? <img className="avatar large avatar-image" src={url} alt=""/> : <span className="avatar large">{name.slice(0,2).toUpperCase()}</span>; }
function today() { return new Date().toISOString().slice(0,10); }
function formatDate(value: string) { if (!value) return '—'; const date = new Date(value.length === 10 ? `${value}T12:00:00` : value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR'); }

function Scoreboard({ ranking, mode, onReload }: { ranking: RankingRow[]; mode: ConnectionMode; onReload: () => Promise<BootstrapData | null> }) {
  useEffect(() => { const timer = window.setInterval(() => { void onReload(); }, 15000); return () => window.clearInterval(timer); }, [onReload]);
  return <main className="scoreboard-shell min-h-screen text-white"><header className="scoreboard-header"><div className="scoreboard-title"><div className="score-logo-wrap"><img src="/capacity-logo.png" alt="Capacity"/></div><div><span className="score-brand">Placar comercial</span><h1>Classificação por inscrições</h1></div></div><div className="scoreboard-meta"><strong>{mode === 'error' ? 'Tentando reconectar' : mode === 'loading' ? 'Carregando placar' : 'Atualização automática'}</strong><button className="score-reload" onClick={() => void onReload()}><RefreshCw size={14}/> Recarregar</button></div></header>{mode === 'loading' && !ranking.length ? <section className="scoreboard-content"><div className="score-empty"><RefreshCw size={38}/><h2>Carregando placar…</h2></div></section> : ranking.length ? <section className="scoreboard-list">{ranking.map((person, index) => <article className="scoreboard-row" key={person.id}><span className={`score-position position-${Math.min(index + 1,3)}`}>{index + 1}º</span><Avatar name={person.name} url={person.avatarUrl}/><h2>{person.name}</h2><strong>{person.registrations}<small> inscrições</small></strong></article>)}</section> : <section className="scoreboard-content"><div className="score-empty"><Medal size={42}/><h2>Placar ainda sem inscrições</h2><p>Os registros aparecerão aqui automaticamente.</p></div></section>}<footer className="score-ticker"><span className="live-dot"/><strong>Atualização automática</strong><p>{ranking[0] ? `${ranking[0].name} está na liderança com ${ranking[0].registrations} inscrições.` : 'Aguardando a primeira inscrição.'}</p></footer></main>;
}
