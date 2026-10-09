'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, ArrowDown, ArrowLeft, ArrowUp, ArrowUpRight, CalendarDays, CheckCircle2, Crown, Eye, FileText, LayoutDashboard, ListChecks, Medal, Minus, Package, Pencil, Plus, RefreshCw, Trash2, Trophy, UserCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  adminMutation,
  createLaunch,
  createEmploymentNote,
  deleteEmploymentNotesForParticipant,
  deleteLaunch,
  getCampaign,
  getCampaignAssociations,
  loadAdminData,
  loadBootstrap,
  loadPreview,
  loadScoreboard,
  listCampaigns,
  publishScoreboard,
  startNewCampaign,
  updateCampaignAssociations,
  updateLaunch,
  updateEmploymentNote,
  type AdminData,
  type ArchivedCampaign,
  type BootstrapData,
  type CampaignSummary,
  type CampaignAssociations,
  type ConnectionMode,
  type EnrollmentRow,
  type EmploymentNoteRow,
  type PreviewData,
  type RankingRow,
  type ScoreboardData,
} from '@/lib/integration';

type PageName = 'dashboard' | 'participants' | 'products' | 'enrollments' | 'archive';
const emptyBootstrap: BootstrapData = { participants: [], products: [], history: [], employmentNotes: [], totalNotes: 0 };
const emptyScoreboard: ScoreboardData = { ranking: [], version: 0, published: false, totalNotes: 0 };
const emptyAdmin: AdminData = { participants: [], products: [] };
const pageTitles: Record<PageName, string> = { dashboard: 'Visão geral', participants: 'Participantes', products: 'Produtos', enrollments: 'Inscrições', archive: 'Arquivo' };

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
  const [employmentNoteOpen, setEmploymentNoteOpen] = useState(false);
  const [editingEmploymentNote, setEditingEmploymentNote] = useState<EmploymentNoteRow | null>(null);
  const [newCampaignOpen, setNewCampaignOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<ArchivedCampaign[]>([]);
  const [localPreviewCampaign, setLocalPreviewCampaign] = useState<CampaignSummary | null>(null);
  const [scoreboardData, setScoreboardData] = useState<ScoreboardData>(emptyScoreboard);
  const [scoreboardCompatibility, setScoreboardCompatibility] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [associationsOpen, setAssociationsOpen] = useState(false);
  const [associations, setAssociations] = useState<CampaignAssociations | null>(null);

  useEffect(() => {
    setView(new URLSearchParams(window.location.search).get('view') === 'scoreboard' ? 'scoreboard' : 'admin');
    setRouteReady(true);
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      const [live, admin] = await Promise.all([loadBootstrap(), loadAdminData()]);
      setBootstrap(live);
      setAdminData(admin);
      setCampaigns(live.campaign === undefined ? [] : await listCampaigns().catch(() => []));
      setMode('live');
      return live;
    } catch (error) {
      setMode('error');
      throw error;
    }
  }, []);

  const refreshScoreboard = useCallback(async () => {
    try {
      const published = await loadScoreboard();
      setScoreboardData(published);
      setScoreboardCompatibility(false);
      setMode('live');
      return published;
    } catch (error) {
      if (!(error instanceof Error && (error as Error & { code?: string }).code === 'ACTION_NOT_ALLOWED')) {
        setMode('error');
        return null;
      }
      try {
        const live = await loadBootstrap();
        const compatibility = { campaign: live.campaign, ranking: live.participants, version: 0, publishedAt: '', published: Boolean(live.participants.length), totalNotes: live.totalNotes || 0 };
        setScoreboardData(compatibility);
        setScoreboardCompatibility(true);
        setMode('live');
        return compatibility;
      } catch {
        setMode('error');
        return null;
      }
    }
  }, []);

  useEffect(() => {
    if (!routeReady) return;
    const controller = new AbortController();
    if (view === 'scoreboard') {
      void refreshScoreboard();
      return () => controller.abort();
    }
    setMode('loading');
    void Promise.all([loadBootstrap(controller.signal), loadAdminData(controller.signal)]).then(async ([live, admin]) => {
      setBootstrap(live);
      setAdminData(admin);
      setCampaigns(live.campaign === undefined ? [] : await listCampaigns(controller.signal).catch(() => []));
      setMode('live');
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setMode('error');
    });
    return () => controller.abort();
  }, [routeReady, view, refreshScoreboard]);

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
  const openNewEmploymentNote = () => { setEditingEmploymentNote(null); setEmploymentNoteOpen(true); };
  const openNewCampaign = () => setNewCampaignOpen(true);
  const openAssociations = () => {
    setAssociationsOpen(true);
    void getCampaignAssociations().then(setAssociations).catch((error: unknown) => {
      setAssociationsOpen(false);
      setMessageIsError(true);
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar as associações.');
    });
  };
  const openPreview = async () => {
    setPreviewLoading(true);
    setMessage('');
    try {
      setPreviewData(await loadPreview());
      setPreviewOpen(true);
    } catch (error) {
      setMessageIsError(true);
      setMessage(error instanceof Error ? error.message : 'Não foi possível gerar a prévia do placar.');
    } finally {
      setPreviewLoading(false);
    }
  };
  const publish = async () => {
    setPublishing(true);
    try {
      const result = await publishScoreboard();
      setBootstrap(result.bootstrap);
      setPreviewOpen(false);
      setPreviewData(null);
      setMessageIsError(false);
      setMessage(`Placar publicado na versão ${result.version}.`);
    } catch (error) {
      setMessageIsError(true);
      setMessage(error instanceof Error ? error.message : 'Não foi possível publicar o placar.');
      throw error;
    } finally {
      setPublishing(false);
    }
  };
  const displayBootstrap = localPreviewCampaign ? { ...bootstrap, participants: [], products: [], history: [], employmentNotes: [], totalNotes: 0 } : bootstrap;
  const displayAdminData = localPreviewCampaign ? { ...adminData, products: [] } : adminData;
  const activeCampaign = localPreviewCampaign || bootstrap.campaign || null;
  const totalRegistrations = displayBootstrap.participants.reduce((sum, item) => sum + item.registrations, 0);

  if (!routeReady) return <LoadingScreen />;
  if (view === 'scoreboard') return <Scoreboard data={scoreboardData} compatibility={scoreboardCompatibility} mode={mode} onReload={refreshScoreboard} />;

  const navItems: Array<{ id: PageName; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'dashboard', label: 'Visão geral', icon: LayoutDashboard },
    { id: 'participants', label: 'Participantes', icon: Users },
    { id: 'products', label: 'Produtos', icon: Package },
    { id: 'enrollments', label: 'Inscrições', icon: ListChecks },
    { id: 'archive', label: 'Arquivo', icon: Archive },
  ];

  return <>
    <main className="admin-shell min-h-screen text-slate-950">
      <aside className="sidebar-panel">
        <div className="brand-block"><div className="brand-logo-wrap"><img src="/capacity-logo.png" alt="Capacity" /></div></div>
        <nav aria-label="Navegação principal" className="nav-list">{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setPage(item.id)} className={page === item.id ? 'nav-item active' : 'nav-item'}><Icon size={19} />{item.label}</button>; })}</nav>
      </aside>
      <section className="main-panel">
        <header className="topbar">
          <div><div className="topbar-kicker"><p className="eyebrow">Gestão comercial</p><ConnectionBadge mode={mode} hasData={adminData.participants.length + adminData.products.length > 0} campaignApiReady={bootstrap.campaign !== undefined || Boolean(localPreviewCampaign)} /></div><h1>{pageTitles[page]}</h1></div>
          <div className="topbar-actions"><Button variant="outline" className="rounded-full" onClick={openScoreboard}><Eye size={17}/> Ver placar da TV</Button><Button variant="outline" className="rounded-full" disabled={mode !== 'live'} onClick={openNewCampaign}><CalendarDays size={17}/> Nova campanha</Button><Button className="primary-action rounded-full" disabled={mode !== 'live'} onClick={openNewEmploymentNote}><FileText size={17}/> Registrar nota</Button><Button className="primary-action rounded-full" disabled={mode !== 'live'} onClick={openNewEnrollment}><Plus size={18}/> Registrar inscrição</Button></div>
        </header>
        <div className="content-wrap">
          {message && <p className={messageIsError ? 'success-banner error' : 'success-banner'} role={messageIsError ? 'alert' : 'status'}>{message}</p>}
          {mode === 'error' && <ConnectionError onRetry={() => { void refreshAll().catch(() => undefined); }} />}
          {page === 'dashboard' && <Dashboard participants={displayAdminData.participants.filter((item) => item.active).length} products={displayAdminData.products.filter((item) => item.active).length} total={totalRegistrations} totalNotes={displayBootstrap.totalNotes || 0} leader={displayBootstrap.participants[0]} history={displayBootstrap.history} campaign={activeCampaign} campaignApiReady={bootstrap.campaign !== undefined || Boolean(localPreviewCampaign)} previewMode={Boolean(localPreviewCampaign)} onConfigureAssociations={openAssociations} onPreview={openPreview} previewLoading={previewLoading} />}
          {page === 'participants' && <ParticipantsView data={displayAdminData} previewMode={Boolean(localPreviewCampaign)} onMutate={mutate} />}
          {page === 'products' && <ProductsView data={displayAdminData} campaignActive={Boolean(localPreviewCampaign || bootstrap.campaign)} previewMode={Boolean(localPreviewCampaign)} onMutate={mutate} />}
          {page === 'enrollments' && <EnrollmentsView history={displayBootstrap.history} employmentNotes={displayBootstrap.employmentNotes || []} campaignActive={Boolean(localPreviewCampaign || bootstrap.campaign)} onNew={openNewEnrollment} onNewNote={openNewEmploymentNote} onEdit={(row) => { setEditingEnrollment(row); setEnrollmentOpen(true); }} onEditNote={(row) => { setEditingEmploymentNote(row); setEmploymentNoteOpen(true); }} onDeleted={async (id) => { setBootstrap(await deleteLaunch(id)); setMessageIsError(false); setMessage('Inscrição excluída. O placar foi atualizado.'); }} onDeletedNote={async (participantId) => { const noteIds = (displayBootstrap.employmentNotes || []).filter((note) => note.participantId === participantId && note.quantity > 0).map((note) => note.id); setBootstrap(await deleteEmploymentNotesForParticipant(participantId, noteIds)); setMessageIsError(false); setMessage('Notas de empenho do participante excluídas e o placar foi atualizado.'); }} />}
          {page === 'archive' && <ArchiveView campaigns={campaigns} currentCampaignId={bootstrap.campaign?.id} apiReady={bootstrap.campaign !== undefined} previewMode={Boolean(localPreviewCampaign)} onLoadCampaign={getCampaign} />}
        </div>
      </section>
    </main>
    <EnrollmentDialog open={enrollmentOpen} onOpenChange={setEnrollmentOpen} editing={editingEnrollment} participants={displayAdminData.participants.filter((item) => item.active)} products={displayAdminData.products.filter((item) => item.active)} campaignActive={Boolean(localPreviewCampaign || bootstrap.campaign)} onSaved={async (input) => { const live = editingEnrollment ? await updateLaunch({ id: editingEnrollment.id, ...input }) : await createLaunch(input); setBootstrap(live); setAdminData(await loadAdminData()); setEnrollmentOpen(false); setEditingEnrollment(null); setMessageIsError(false); setMessage(editingEnrollment ? 'Inscrição atualizada e pendente de publicação.' : 'Inscrição registrada e pendente de publicação.'); }} />
    <EmploymentNoteDialog open={employmentNoteOpen} onOpenChange={setEmploymentNoteOpen} editing={editingEmploymentNote} participants={displayAdminData.participants.filter((item) => item.active)} products={displayAdminData.products.filter((item) => item.active)} campaignActive={Boolean(localPreviewCampaign || bootstrap.campaign)} onSaved={async (input) => { const live = editingEmploymentNote ? await updateEmploymentNote({ id: editingEmploymentNote.id, ...input }) : await createEmploymentNote(input); setBootstrap(live); setEmploymentNoteOpen(false); setEditingEmploymentNote(null); setMessageIsError(false); setMessage(editingEmploymentNote ? 'Nota de empenho atualizada e o placar foi sincronizado.' : 'Nota de empenho registrada e o placar foi sincronizado.'); }} />
    <PublicationDialog open={previewOpen} onOpenChange={setPreviewOpen} pending={displayBootstrap.history.filter((row) => row.pendingPublication).length} total={totalRegistrations} preview={previewData} publishing={publishing} onPublish={publish} />
    <NewCampaignDialog open={newCampaignOpen} onOpenChange={setNewCampaignOpen} onSave={async (input) => {
      if (bootstrap.campaign !== undefined) {
        const result = await startNewCampaign(input);
        setBootstrap(result.bootstrap);
        setAdminData(result.adminData);
        setCampaigns(result.campaigns);
        setLocalPreviewCampaign(null);
        setNewCampaignOpen(false);
        setPage('archive');
        setMessageIsError(false);
        setMessage(`Campanha “${result.campaign.name}” iniciada${result.archive ? ', com o resultado anterior arquivado.' : '.'}`);
        return;
      }
      const startDate = `${input.year}-${input.month}-01`;
      const previewId = `preview-${Date.now()}`;
      const endDate = `${input.year}-${input.month}-${String(new Date(input.year, Number(input.month), 0).getDate()).padStart(2, '0')}`;
      const previewCampaign = { id: previewId, name: input.name, status: 'ATIVA', startDate, endDate, publishedVersion: 0 };
      setLocalPreviewCampaign(previewCampaign);
      setBootstrap({ campaign: previewCampaign, participants: [], products: [], history: [] });
      setAdminData((current) => ({ ...current, products: [] }));
      setNewCampaignOpen(false);
      setPage('archive');
      setMessageIsError(false);
      setMessage(`Prévia local: “${input.name}” foi configurada. A gravação do arquivo será conectada ao Apps Script na próxima etapa.`);
    }} />
    <CampaignAssociationsDialog open={associationsOpen} onOpenChange={setAssociationsOpen} data={associations} onSave={async (input) => {
      const saved = await updateCampaignAssociations(input);
      setAssociations(saved);
      const [live, admin] = await Promise.all([loadBootstrap(), loadAdminData()]);
      setBootstrap(live);
      setAdminData(admin);
      setMessageIsError(false);
      setMessage('Associações da campanha atualizadas.');
    }} />
  </>;
}

function ConnectionBadge({ mode, hasData, campaignApiReady }: { mode: ConnectionMode; hasData: boolean; campaignApiReady: boolean }) {
  const compatibility = mode === 'live' && !campaignApiReady;
  const text = mode === 'loading' ? 'Carregando dados…' : mode === 'error' ? 'Erro de conexão' : compatibility ? 'Compatibilidade · Apps Script antigo' : hasData ? 'Conectado à planilha' : 'Conectado · base vazia';
  return <span className={`integration-badge ${compatibility ? 'demo' : mode}`} aria-live="polite">{text}</span>;
}

function LoadingScreen() { return <main className="loading-screen" aria-live="polite"><p>Carregando o painel…</p></main>; }

function ConnectionError({ onRetry }: { onRetry: () => void }) { return <section className="connection-error"><div><strong>Não foi possível acessar a planilha.</strong><span>Os últimos dados válidos foram mantidos. Tente novamente.</span></div><Button variant="outline" onClick={onRetry}><RefreshCw size={16}/> Tentar novamente</Button></section>; }

function Dashboard({ participants, products, total, totalNotes, leader, history, campaign, campaignApiReady, previewMode, onConfigureAssociations, onPreview, previewLoading }: { participants: number; products: number; total: number; totalNotes: number; leader?: RankingRow; history: EnrollmentRow[]; campaign: CampaignSummary | null; campaignApiReady: boolean; previewMode: boolean; onConfigureAssociations: () => void; onPreview: () => Promise<void>; previewLoading: boolean }) {
  const pending = history.filter((row) => row.pendingPublication);
  const pendingTotal = pending.reduce((sum, row) => sum + row.quantity, 0);
  const pendingParticipants = new Set(pending.map((row) => row.participantId)).size;
  return <div className="simple-dashboard">
    {campaignApiReady && <section className={campaign ? 'campaign-context-card' : 'campaign-context-card empty'}><div><p className="eyebrow">Campanha atual</p><h2>{campaign?.name || 'Nenhuma campanha ativa'}</h2>{campaign && <span>{formatDate(campaign.startDate || '')} a {formatDate(campaign.endDate || '')}</span>}</div><div className="campaign-context-actions"><strong>{campaign ? 'ATIVA' : 'Aguardando criação'}</strong>{campaign && <Button variant="outline" disabled={previewMode} onClick={onConfigureAssociations}>Configurar associações</Button>}</div></section>}
    {!previewMode && pending.length > 0 && <section className="status-banner"><div className="status-icon"><ArrowUpRight size={20}/></div><div className="status-copy"><strong>{pending.length} alterações aguardam publicação</strong><span>{pendingTotal} inscrições líquidas · {pendingParticipants} participantes afetadas · a TV continua mostrando a última versão publicada.</span></div><Button className="publish-button" disabled={previewLoading} onClick={() => { void onPreview(); }}>{previewLoading ? 'Gerando prévia…' : 'Revisar e publicar'} <ArrowUpRight size={16}/></Button></section>}
    <section className="metrics-grid simple-metrics">
      <Metric label="Participantes ativos" value={String(participants)} icon={<UserCheck/>}/><Metric label="Produtos ativos" value={String(products)} icon={<Package/>}/><Metric label="Total de inscrições" value={String(total)} icon={<ListChecks/>}/><Metric label="Total de Empenhos" value={String(totalNotes)} icon={<FileText/>}/><Metric label="Líder atual" value={leader?.name || 'Ainda não definido'} detail={leader ? `${leader.registrations} inscrições` : 'Aguardando registros'} icon={<Medal/>} featured/>
    </section>
    <RecentEnrollments history={history.slice(0, 6)} />
  </div>;
}

function PublicationDialog({ open, onOpenChange, pending, total, preview, publishing, onPublish }: { open: boolean; onOpenChange: (open: boolean) => void; pending: number; total: number; preview: PreviewData | null; publishing: boolean; onPublish: () => Promise<void> }) {
  const changes = preview?.changes || [];
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="publication-dialog"><DialogHeader><DialogTitle>Prévia da atualização</DialogTitle><DialogDescription>Confira o cálculo do servidor antes de liberar a nova versão para a TV.</DialogDescription></DialogHeader><div className="preview-summary"><div><span>Alterações pendentes</span><strong>{preview?.pendingCount ?? pending}</strong></div><div><span>Inscrições publicadas</span><strong>{preview?.publishedTotal ?? 0}</strong></div><ArrowUpRight/><div><span>Novo total</span><strong>{preview?.currentTotal ?? total}</strong></div></div><div className="preview-list"><p className="eyebrow">Comparação com a versão {preview?.publishedVersion ?? 0}</p>{changes.length ? changes.map((row) => <div key={row.id}><span className="avatar">{row.initials || row.name.slice(0, 2).toUpperCase()}</span><strong>{row.name}</strong><span>{row.previousPosition ? `${row.previousPosition}º → ${row.newPosition || '—'}º` : `— → ${row.newPosition || '—'}º`} · {row.previousRegistrations} → {row.newRegistrations} inscrições · {row.movement}</span></div>) : <p>Nenhuma alteração pendente.</p>}</div><div className="publication-warning"><RefreshCw size={18}/><p><strong>A versão anterior será preservada.</strong><span>A TV só mudará após a confirmação no servidor.</span></p></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={publishing}><ArrowLeft size={16}/> Cancelar e revisar</Button><Button className="primary-action" onClick={() => { void onPublish().catch(() => undefined); }} disabled={publishing || !(preview?.pendingCount ?? pending)}><CheckCircle2 size={17}/> {publishing ? 'Publicando…' : 'Confirmar atualização'}</Button></DialogFooter></DialogContent></Dialog>;
}

function Metric({ label, value, detail, icon, featured = false }: { label: string; value: string; detail?: string; icon: React.ReactNode; featured?: boolean }) { return <article className={featured ? 'metric-card featured' : 'metric-card'}><div className="metric-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div></article>; }

function enrollmentStatus(row: EnrollmentRow) {
  if (row.status === 'INATIVADO') return { label: 'Inativado', className: 'inactive' };
  if (row.status === 'ATIVO') return { label: 'Ativa', className: 'active' };
  return { label: 'Excluída', className: '' };
}

function RecentEnrollments({ history }: { history: EnrollmentRow[] }) { return <section className="panel-card list-page"><div className="list-page-head"><div><p className="eyebrow">Atividade recente</p></div></div>{history.length ? <div className="simple-table"><div className="simple-table-head" aria-hidden="true"><span>Data</span><span>Participante</span><span>Produto</span><span>Nº de inscrições</span><span>Status</span></div>{history.map((row) => { const status = enrollmentStatus(row); return <div className="simple-row" key={row.id}><span>{formatDate(row.date)}</span><strong>{row.participant}</strong><span>{row.product}</span><b>{row.quantity}</b><em className={status.className}>{status.label}</em></div>; })}</div> : <EmptyState text="Nenhuma inscrição registrada."/>}</section>; }

function ArchiveView({ campaigns, currentCampaignId, apiReady, previewMode, onLoadCampaign }: { campaigns: ArchivedCampaign[]; currentCampaignId?: string | null; apiReady: boolean; previewMode: boolean; onLoadCampaign: (id: string) => Promise<{ campaign: { name: string; startDate?: string; endDate?: string }; ranking: RankingRow[] }> }) {
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [selected, setSelected] = useState<{ name: string; startDate?: string; endDate?: string; ranking: RankingRow[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const years = Array.from(new Set(campaigns.map((campaign) => campaign.startDate?.slice(0, 4)).filter(Boolean))).sort().reverse();
  const filtered = campaigns.filter((campaign) => campaign.id !== currentCampaignId && campaign.status.trim().toUpperCase() === 'ARQUIVADA' && (!month || campaign.startDate?.slice(5, 7) === month) && (!year || campaign.startDate?.slice(0, 4) === year));
  const openCampaign = async (id: string) => {
    setSelectedId(id); setLoading(true);
    try { const result = await onLoadCampaign(id); setSelected({ ...result.campaign, ranking: result.ranking }); } finally { setLoading(false); }
  };
  return <section className="panel-card list-page archive-page">
    <div className="list-page-head"><div><p className="eyebrow">Histórico de campanhas</p><h2>Arquivo</h2></div>{(!apiReady || previewMode) && <span className="integration-badge demo">Prévia local</span>}</div>
    <div className="archive-filters"><label><span>Mês</span><select value={month} onChange={(event) => setMonth(event.target.value)}><option value="">Todos</option>{['01','02','03','04','05','06','07','08','09','10','11','12'].map((value) => <option key={value} value={value}>{new Date(2000, Number(value) - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })}</option>)}</select></label><label><span>Ano</span><select value={year} onChange={(event) => setYear(event.target.value)}><option value="">Todos</option>{years.map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div>
    {filtered.length ? <div className="archive-list">{filtered.map((campaign) => <button className={selectedId === campaign.id ? 'archive-card selected' : 'archive-card'} key={campaign.id} onClick={() => void openCampaign(campaign.id)}><Archive size={18}/><span><strong>{campaign.name}</strong><small>{formatDate(campaign.startDate || '')} · {campaign.participantCount} participantes · {campaign.totalRegistrations} inscrições</small></span><span className="archive-card-arrow">›</span></button>)}</div> : <div className="archive-intro"><Archive size={22}/><div><strong>{apiReady && !previewMode ? 'Nenhuma campanha arquivada' : previewMode ? 'Prévia local sem arquivamento' : 'Arquivo disponível após a integração'}</strong><p>{apiReady && !previewMode ? 'Campanhas arquivadas aparecerão aqui para consulta por mês e ano.' : previewMode ? 'A nova campanha foi preparada localmente. O snapshot será gravado no Arquivo pelo Apps Script.' : 'A prévia local mantém a estrutura do Arquivo. A leitura real será ativada quando a nova versão do Apps Script estiver publicada.'}</p></div></div>}
    {loading && <p className="archive-loading">Carregando placar arquivado…</p>}
    {selected && !loading && <div className="archive-detail"><div className="archive-detail-head"><div><p className="eyebrow">Placar arquivado</p><h3>{selected.name}</h3></div><span>{formatDate(selected.startDate || '')}</span></div>{selected.ranking.length ? <div className="archive-table"><div className="archive-table-row head"><span>Posição</span><span>Participante</span><span>Inscrições</span></div>{selected.ranking.map((person, index) => <div className="archive-table-row" key={person.id}><b>{index + 1}º</b><strong>{person.name}</strong><span>{person.registrations}</span></div>)}</div> : <EmptyState text="Esta campanha não possui placar arquivado."/>}</div>}
  </section>;
}

function ParticipantsView({ data, previewMode, onMutate }: { data: AdminData; previewMode: boolean; onMutate: (action: string, input: Record<string, unknown>, success: string) => Promise<void> }) {
  const [editing, setEditing] = useState<AdminData['participants'][number] | null>(null); const [open, setOpen] = useState(false); const [confirm, setConfirm] = useState<AdminData['participants'][number] | null>(null);
  return <section className="panel-card list-page"><div className="list-page-head"><div><p className="eyebrow">Cadastros</p><h2>Participantes</h2></div><Button className="primary-action" disabled={previewMode} onClick={() => { setEditing(null); setOpen(true); }}><Plus size={16}/> Nova participante</Button></div>{previewMode && <p className="preview-lock-note">Prévia local: alterações de cadastro ficam bloqueadas até a integração da nova campanha.</p>}{data.participants.length ? <div className="people-grid">{data.participants.map((item) => <article className="person-card" key={item.id}><Avatar name={item.name} url={item.avatarUrl}/><div><strong>{item.name}</strong><p>{item.active ? 'Ativa' : 'Inativa'} · {item.historyCount} registros</p></div><div className="admin-row-actions"><Button variant="outline" disabled={previewMode} onClick={() => { setEditing(item); setOpen(true); }}><Pencil/> Editar</Button><Button variant="outline" disabled={previewMode} onClick={() => void onMutate(item.active ? 'deactivateParticipant' : 'activateParticipant', { id: item.id }, item.active ? 'Participante desativada.' : 'Participante reativada.')}>{item.active ? 'Desativar' : 'Reativar'}</Button><Button variant="destructive" disabled={previewMode} onClick={() => setConfirm(item)}><Trash2/> Excluir</Button></div></article>)}</div> : <EmptyState text="Nenhuma participante cadastrada."/>}<ParticipantDialog open={open} onOpenChange={setOpen} editing={editing} onSave={async (input) => { await onMutate(editing ? 'updateParticipant' : 'createParticipant', editing ? { id: editing.id, ...input } : input, editing ? 'Participante atualizada.' : 'Participante cadastrada.'); setOpen(false); }}/><ConfirmDialog open={Boolean(confirm)} title={confirm?.historyCount ? 'Desativar participante?' : 'Excluir participante?'} description={confirm?.historyCount ? 'Esta participante possui histórico e não pode ser excluída. Ela será desativada e deixará de aparecer em novas inscrições.' : 'Esta participante será removida definitivamente.'} confirmLabel={confirm?.historyCount ? 'Desativar' : 'Excluir'} onOpenChange={(value) => !value && setConfirm(null)} onConfirm={async () => { if (!confirm) return; await onMutate(confirm.historyCount ? 'deactivateParticipant' : 'deleteParticipant', { id: confirm.id }, confirm.historyCount ? 'Participante desativada.' : 'Participante excluída.'); setConfirm(null); }}/></section>;
}

function ProductsView({ data, campaignActive, previewMode, onMutate }: { data: AdminData; campaignActive: boolean; previewMode: boolean; onMutate: (action: string, input: Record<string, unknown>, success: string) => Promise<void> }) {
  const [editing, setEditing] = useState<AdminData['products'][number] | null>(null); const [open, setOpen] = useState(false); const [confirm, setConfirm] = useState<AdminData['products'][number] | null>(null);
  return <section className="panel-card list-page"><div className="list-page-head"><div><p className="eyebrow">Cadastros</p><h2>Produtos</h2></div><Button className="primary-action" disabled={previewMode} onClick={() => { setEditing(null); setOpen(true); }}><Plus size={16}/> Novo produto</Button></div>{previewMode && <p className="preview-lock-note">Prévia local: alterações de cadastro ficam bloqueadas até a integração da nova campanha.</p>}{data.products.length ? <div className="products-table" role="table" aria-label="Produtos cadastrados"><div className="products-row products-row-head" role="row"><span>Produto</span><span>Categoria</span><span>Status</span><span>Registros</span><span>Ações</span></div>{data.products.map((item) => <article className="products-row" role="row" key={item.id}><div className="product-identity"><strong title={item.name}>{item.name}</strong></div><span className="product-category">{item.category || 'Sem categoria'}</span><span className={item.active ? 'product-status active' : 'product-status inactive'}>{item.active ? 'Ativo' : 'Inativo'}</span><strong className="product-records">{item.historyCount} <small>{item.historyCount === 1 ? 'registro' : 'registros'}</small></strong><div className="admin-row-actions"><Button variant="outline" disabled={previewMode} onClick={() => { setEditing(item); setOpen(true); }}><Pencil/> Editar</Button><Button variant="outline" disabled={previewMode} onClick={() => void onMutate(item.active ? 'deactivateProduct' : 'activateProduct', { id: item.id }, item.active ? 'Produto desativado.' : 'Produto reativado.')}>{item.active ? 'Desativar' : 'Reativar'}</Button><Button variant="destructive" disabled={previewMode} onClick={() => setConfirm(item)}><Trash2/> Excluir</Button></div></article>)}</div> : <EmptyState text={campaignActive ? 'Nenhum produto associado à campanha atual. Cadastre um produto para começar.' : 'Nenhum produto cadastrado.'}/>}<ProductDialog open={open} onOpenChange={setOpen} editing={editing} onSave={async (input) => { await onMutate(editing ? 'updateProduct' : 'createProduct', editing ? { id: editing.id, ...input } : input, editing ? 'Produto atualizado.' : 'Produto cadastrado.'); setOpen(false); }}/><ConfirmDialog open={Boolean(confirm)} title={confirm?.historyCount ? 'Desativar produto?' : 'Excluir produto?'} description={confirm?.historyCount ? 'Este produto possui histórico. Ele será desativado e deixará de aparecer em novas inscrições.' : 'Este produto será removido definitivamente.'} confirmLabel={confirm?.historyCount ? 'Desativar' : 'Excluir'} onOpenChange={(value) => !value && setConfirm(null)} onConfirm={async () => { if (!confirm) return; await onMutate(confirm.historyCount ? 'deactivateProduct' : 'deleteProduct', { id: confirm.id }, confirm.historyCount ? 'Produto desativado.' : 'Produto excluído.'); setConfirm(null); }}/></section>;
}

function EnrollmentsView({ history, employmentNotes, campaignActive, onNew, onNewNote, onEdit, onEditNote, onDeleted, onDeletedNote }: { history: EnrollmentRow[]; employmentNotes: EmploymentNoteRow[]; campaignActive: boolean; onNew: () => void; onNewNote: () => void; onEdit: (row: EnrollmentRow) => void; onEditNote: (row: EmploymentNoteRow) => void; onDeleted: (id: string) => Promise<void>; onDeletedNote: (participantId: string) => Promise<void> }) {
  const [confirm, setConfirm] = useState<EnrollmentRow | null>(null);
  const [confirmNote, setConfirmNote] = useState<EmploymentNoteRow | null>(null);
  const visibleEmploymentNotes = employmentNotes.filter((row) => row.quantity > 0);
  return <div className="enrollments-sections"><section className="panel-card list-page"><div className="list-page-head"><div><p className="eyebrow">Movimentações</p><h2>Inscrições</h2></div><Button className="primary-action" onClick={onNew}><Plus size={16}/> Nova inscrição</Button></div>{history.length ? <div className="enrollment-table"><div className="enrollment-row head"><span>Data</span><span>Participante</span><span>Produto</span><span>Quantidade</span><span>Situação</span><span>Ações</span></div>{history.map((row) => { const status = enrollmentStatus(row); return <div className="enrollment-row" key={row.id}><span>{formatDate(row.date)}</span><strong>{row.participant || 'Cadastro indisponível'}</strong><span>{row.product || 'Cadastro indisponível'}</span><b>{row.quantity}</b><em className={status.className}>{status.label}</em><div>{row.status === 'ATIVO' && <><Button variant="outline" onClick={() => onEdit(row)}><Pencil/> Editar</Button><Button variant="destructive" onClick={() => setConfirm(row)}><Trash2/> Excluir</Button></>}</div></div>; })}</div> : <EmptyState text={campaignActive ? 'Nenhuma inscrição registrada nesta campanha.' : 'Nenhuma inscrição registrada.'}/>}<ConfirmDialog open={Boolean(confirm)} title="Excluir inscrição?" description="A inscrição deixará de contar no placar, mas permanecerá registrada para auditoria." confirmLabel="Excluir inscrição" onOpenChange={(value) => !value && setConfirm(null)} onConfirm={async () => { if (!confirm) return; await onDeleted(confirm.id); setConfirm(null); }}/></section><section className="panel-card list-page"><div className="list-page-head"><div><p className="eyebrow">Operação financeira</p><h2>Notas de empenho</h2><p className="list-page-subtitle">Quantidade registrada por participante e produto. O painel e o placar são atualizados automaticamente.</p></div><Button className="primary-action" onClick={onNewNote}><FileText size={16}/> Registrar nota</Button></div>{visibleEmploymentNotes.length ? <div className="enrollment-table employment-note-table"><div className="enrollment-row head"><span>Data</span><span>Participante</span><span>Produto</span><span>Quantidade</span><span>Situação</span><span>Ações</span></div>{visibleEmploymentNotes.map((row) => <div className="enrollment-row" key={row.id}><span>{formatDate(row.date)}</span><strong>{row.participant || 'Cadastro indisponível'}</strong><span>{row.product || 'Cadastro indisponível'}</span><b>{row.quantity}</b><em className="active">Registrada</em><div><Button variant="outline" onClick={() => onEditNote(row)}><Pencil/> Editar</Button><Button variant="destructive" onClick={() => setConfirmNote(row)}><Trash2/> Excluir</Button></div></div>)}</div> : <EmptyState text={campaignActive ? 'Nenhuma nota de empenho registrada nesta campanha.' : 'Nenhuma nota de empenho registrada.'}/>}<ConfirmDialog open={Boolean(confirmNote)} title="Excluir notas de empenho do participante?" description={confirmNote ? `Todas as notas de empenho registradas para ${confirmNote.participant || 'este participante'} nesta campanha serão excluídas da operação financeira e deixarão de contar no placar. Deseja continuar?` : ''} confirmLabel="Sim, excluir todas" cancelLabel="Não" onOpenChange={(value) => !value && setConfirmNote(null)} onConfirm={async () => { if (!confirmNote) return; await onDeletedNote(confirmNote.participantId); setConfirmNote(null); }}/></section></div>;
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

function EnrollmentDialog({ open, onOpenChange, editing, participants, products, campaignActive, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; editing: EnrollmentRow | null; participants: AdminData['participants']; products: AdminData['products']; campaignActive: boolean; onSaved: (input: { participantId: string; productId: string; quantity: number; date: string; notes?: string }) => Promise<void> }) {
  const [participantId, setParticipantId] = useState(''); const [productId, setProductId] = useState(''); const [quantity, setQuantity] = useState(1); const [date, setDate] = useState(today()); const [notes, setNotes] = useState(''); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (!open) return; setParticipantId(editing?.participantId || participants[0]?.id || ''); setProductId(editing?.productId || products[0]?.id || ''); setQuantity(editing?.quantity || 1); setDate(editing?.date?.slice(0,10) || today()); setNotes(editing?.notes || ''); setError(''); }, [open, editing, participants, products]);
  const canSave = participantId && productId && Number.isInteger(quantity) && quantity > 0 && date;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="entity-dialog enrollment-dialog"><DialogHeader><DialogTitle>{editing ? 'Editar inscrição' : 'Registrar inscrição'}</DialogTitle><DialogDescription>A inscrição ficará pendente até a gestão confirmar a publicação do placar.</DialogDescription></DialogHeader>{participants.length && products.length ? <div className="form-grid"><Field label="Participante" id="enrollment-participant"><select id="enrollment-participant" value={participantId} onChange={(e) => setParticipantId(e.target.value)}>{participants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Produto" id="enrollment-product"><select id="enrollment-product" value={productId} onChange={(e) => setProductId(e.target.value)}>{products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Quantidade" id="enrollment-quantity"><Input id="enrollment-quantity" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}/></Field><Field label="Data" id="enrollment-date"><Input id="enrollment-date" type="date" value={date} onChange={(e) => setDate(e.target.value)}/></Field><div className="field full"><Label htmlFor="enrollment-notes">Observação (opcional)</Label><Input id="enrollment-notes" value={notes} onChange={(e) => setNotes(e.target.value)}/></div></div> : <EmptyState text={campaignActive ? 'Cadastre um produto associado à campanha atual antes de registrar uma inscrição.' : 'Cadastre ao menos uma participante e um produto ativos antes de registrar uma inscrição.'}/>} {error && <p className="form-error" role="alert">{error}</p>}<DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button className="primary-action" disabled={saving || !canSave} onClick={() => { setSaving(true); setError(''); void onSaved({ participantId, productId, quantity, date, notes: notes.trim() }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Não foi possível salvar.')).finally(() => setSaving(false)); }}>{saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Registrar inscrição'}</Button></DialogFooter></DialogContent></Dialog>;
}

function EmploymentNoteDialog({ open, onOpenChange, editing, participants, products, campaignActive, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; editing: EmploymentNoteRow | null; participants: AdminData['participants']; products: AdminData['products']; campaignActive: boolean; onSaved: (input: { participantId: string; productId: string; quantity: number; date: string }) => Promise<void> }) {
  const [participantId, setParticipantId] = useState(''); const [productId, setProductId] = useState(''); const [quantity, setQuantity] = useState(1); const [date, setDate] = useState(today()); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (!open) return; setParticipantId(editing?.participantId || participants[0]?.id || ''); setProductId(editing?.productId || products[0]?.id || ''); setQuantity(editing?.quantity ?? 1); setDate(editing?.date?.slice(0, 10) || today()); setError(''); }, [open, editing, participants, products]);
  const canSave = participantId && productId && Number.isInteger(quantity) && quantity >= 1 && date;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="entity-dialog enrollment-dialog"><DialogHeader><DialogTitle>{editing ? 'Editar nota de empenho' : 'Registrar nota de empenho'}</DialogTitle><DialogDescription>Registre somente a quantidade de notas vinculada ao participante e ao produto. O placar será sincronizado automaticamente.</DialogDescription></DialogHeader>{participants.length && products.length ? <div className="form-grid"><Field label="Participante" id="employment-note-participant"><select id="employment-note-participant" value={participantId} onChange={(e) => setParticipantId(e.target.value)}>{participants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Produto" id="employment-note-product"><select id="employment-note-product" value={productId} onChange={(e) => setProductId(e.target.value)}>{products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Quantidade" id="employment-note-quantity"><Input id="employment-note-quantity" type="number" min={1} step={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}/></Field><Field label="Data" id="employment-note-date"><Input id="employment-note-date" type="date" value={date} onChange={(e) => setDate(e.target.value)}/></Field></div> : <EmptyState text={campaignActive ? 'Associe participantes e produtos à campanha antes de registrar uma nota.' : 'Cadastre ao menos uma participante e um produto ativos antes de registrar uma nota.'}/>} {error && <p className="form-error" role="alert">{error}</p>}<DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button className="primary-action" disabled={saving || !canSave} onClick={() => { setSaving(true); setError(''); void onSaved({ participantId, productId, quantity, date }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Não foi possível salvar.')).finally(() => setSaving(false)); }}>{saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Registrar nota'}</Button></DialogFooter></DialogContent></Dialog>;
}

function NewCampaignDialog({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; onSave: (input: { name: string; month: string; year: number; archiveCurrent: boolean }) => Promise<void> }) {
  const now = new Date();
  const [name, setName] = useState('');
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState(now.getFullYear());
  const [archiveCurrent, setArchiveCurrent] = useState(true);
  const [skipArchiveConfirmed, setSkipArchiveConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setName(''); setMonth(String(new Date().getMonth() + 1).padStart(2, '0')); setYear(new Date().getFullYear()); setArchiveCurrent(true); setSkipArchiveConfirmed(false); setError(''); } }, [open]);
  const canSave = name.trim().length >= 2 && month && year >= 2020 && year <= 2100;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="entity-dialog campaign-dialog"><DialogHeader><DialogTitle>Nova campanha</DialogTitle><DialogDescription>Prepare a próxima campanha sem perder o resultado da anterior.</DialogDescription></DialogHeader><div className="campaign-callout"><Archive size={18}/><p><strong>O que acontece com os dados?</strong><span>O placar geral da campanha atual será arquivado. Participantes permanecem disponíveis para reutilização.</span></p></div><div className="form-grid"><Field label="Nome da campanha" id="campaign-name"><Input id="campaign-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Campanha Outubro 2026" autoFocus/></Field><Field label="Mês" id="campaign-month"><select id="campaign-month" value={month} onChange={(e) => setMonth(e.target.value)}>{['01','02','03','04','05','06','07','08','09','10','11','12'].map((value) => <option key={value} value={value}>{new Date(2000, Number(value) - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })}</option>)}</select></Field><Field label="Ano" id="campaign-year"><Input id="campaign-year" type="number" min={2020} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value))}/></Field></div><label className="campaign-check"><input type="checkbox" checked={archiveCurrent} onChange={(e) => { setArchiveCurrent(e.target.checked); setSkipArchiveConfirmed(false); }}/><span><strong>Arquivar resultados da última campanha</strong><small>Recomendado: salva o placar final no menu Arquivo antes de iniciar a nova campanha.</small></span></label>{!archiveCurrent && <p className="campaign-warning" role="alert">O resultado atual não ficará disponível no Arquivo. Clique novamente em “Confirmar sem arquivar” para prosseguir.</p>}{error && <p className="form-error" role="alert">{error}</p>}<DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button className="primary-action" disabled={saving || !canSave} onClick={() => { if (!archiveCurrent && !skipArchiveConfirmed) { setSkipArchiveConfirmed(true); return; } setSaving(true); setError(''); void onSave({ name: name.trim(), month, year, archiveCurrent }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Não foi possível preparar a campanha.')).finally(() => setSaving(false)); }}>{saving ? 'Preparando…' : !archiveCurrent && skipArchiveConfirmed ? 'Confirmar sem arquivar' : 'Criar campanha'}</Button></DialogFooter></DialogContent></Dialog>;
}

function CampaignAssociationsDialog({ open, onOpenChange, data, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; data: CampaignAssociations | null; onSave: (input: { participantIds: string[]; productIds: string[] }) => Promise<void> }) {
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open || !data) return;
    setParticipantIds(data.participants.filter((item) => item.associated).map((item) => item.id));
    setProductIds(data.products.filter((item) => item.associated).map((item) => item.id));
    setError('');
  }, [open, data]);
  const toggle = (current: string[], id: string) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
  const activeParticipants = data?.participants.filter((item) => item.active) || [];
  const activeProducts = data?.products.filter((item) => item.active) || [];
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="entity-dialog association-dialog"><DialogHeader><DialogTitle>Associações da campanha</DialogTitle><DialogDescription>{data ? `Selecione os participantes e produtos de ${data.campaign.name}.` : 'Carregando as opções disponíveis…'}</DialogDescription></DialogHeader>{data ? <div className="association-columns"><AssociationColumn title="Participantes" items={activeParticipants} selected={participantIds} onToggle={(id) => setParticipantIds((current) => toggle(current, id))}/><AssociationColumn title="Produtos" items={activeProducts} selected={productIds} onToggle={(id) => setProductIds((current) => toggle(current, id))}/></div> : <div className="association-loading">Carregando associações…</div>}{error && <p className="form-error" role="alert">{error}</p>}<DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button className="primary-action" disabled={!data || saving} onClick={() => { setSaving(true); setError(''); void onSave({ participantIds, productIds }).then(() => onOpenChange(false)).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Não foi possível salvar as associações.')).finally(() => setSaving(false)); }}>{saving ? 'Salvando…' : 'Salvar associações'}</Button></DialogFooter></DialogContent></Dialog>;
}

function AssociationColumn({ title, items, selected, onToggle }: { title: string; items: Array<{ id: string; name: string }>; selected: string[]; onToggle: (id: string) => void }) {
  return <section className="association-column"><div className="association-column-head"><strong>{title}</strong><small>{selected.length} selecionado(s)</small></div>{items.length ? <div className="association-options">{items.map((item) => <label key={item.id} className="association-option"><input type="checkbox" checked={selected.includes(item.id)} onChange={() => onToggle(item.id)}/><span>{item.name}</span></label>)}</div> : <div className="association-empty">Nenhum cadastro ativo.</div>}</section>;
}

function ConfirmDialog({ open, title, description, confirmLabel, cancelLabel = 'Cancelar', onOpenChange, onConfirm }: { open: boolean; title: string; description: string; confirmLabel: string; cancelLabel?: string; onOpenChange: (open: boolean) => void; onConfirm: () => Promise<void> }) { const [busy, setBusy] = useState(false); const [error, setError] = useState(''); useEffect(() => { if (open) setError(''); }, [open]); return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>{error && <p className="form-error" role="alert">{error}</p>}<DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>{cancelLabel}</Button><Button variant="destructive" disabled={busy} onClick={() => { setBusy(true); setError(''); void onConfirm().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Não foi possível concluir.')).finally(() => setBusy(false)); }}>{busy ? 'Processando…' : confirmLabel}</Button></DialogFooter></DialogContent></Dialog>; }

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) { return <div className="field"><Label htmlFor={id}>{label}</Label>{children}</div>; }
function EmptyState({ text }: { text: string }) { return <div className="empty-state"><ListChecks size={23}/><p>{text}</p></div>; }
function Avatar({ name, url }: { name: string; url?: string }) { return url ? <img className="avatar large avatar-image" src={url} alt=""/> : <span className="avatar large">{name.slice(0,2).toUpperCase()}</span>; }
function today() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function formatDate(value: string) { if (!value) return '—'; const date = new Date(value.length === 10 ? `${value}T12:00:00` : value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR'); }
function formatDateTime(value: string) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); }

type ScoreMovement = { direction: 'up' | 'down' | 'same' | 'new'; delta: number; previousRegistrations?: number };

function Scoreboard({ data, compatibility, mode, onReload }: { data: ScoreboardData; compatibility: boolean; mode: ConnectionMode; onReload: () => Promise<ScoreboardData | null> }) {
  const ranking = data.ranking;
  const previousRef = useRef<RankingRow[] | null>(null);
  const signatureRef = useRef('');
  const [movements, setMovements] = useState<Record<string, ScoreMovement>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [newLeader, setNewLeader] = useState(false);
  const [pulse, setPulse] = useState(false);
  useEffect(() => { const timer = window.setInterval(() => { void onReload(); }, 15000); return () => window.clearInterval(timer); }, [onReload]);
  useEffect(() => {
    const signature = ranking.map((person) => `${person.id}:${person.registrations}`).join('|');
    if (signature === signatureRef.current) return;
    const previous = previousRef.current;
    if (previous) {
      const next: Record<string, ScoreMovement> = {};
      ranking.forEach((person, index) => {
        const oldIndex = previous.findIndex((item) => item.id === person.id);
        const old = previous.find((item) => item.id === person.id);
        if (oldIndex < 0) next[person.id] = { direction: 'new', delta: 0, previousRegistrations: 0 };
        else next[person.id] = { direction: oldIndex > index ? 'up' : oldIndex < index ? 'down' : 'same', delta: oldIndex - index, previousRegistrations: old.registrations };
      });
      setMovements(next);
      const leaderChanged = Boolean(previous.length && ranking.length && previous[0].id !== ranking[0].id);
      setNewLeader(leaderChanged);
      setPulse(true);
      const pulseTimer = window.setTimeout(() => { setPulse(false); setNewLeader(false); }, 4200);
      return () => window.clearTimeout(pulseTimer);
    }
    previousRef.current = ranking;
    signatureRef.current = signature;
    setLastUpdated(new Date());
  }, [ranking]);
  useEffect(() => {
    if (signatureRef.current === ranking.map((person) => `${person.id}:${person.registrations}`).join('|')) return;
    signatureRef.current = ranking.map((person) => `${person.id}:${person.registrations}`).join('|');
    previousRef.current = ranking;
    setLastUpdated(new Date());
  }, [ranking]);

  const total = ranking.reduce((sum, person) => sum + person.registrations, 0);
  const totalNotes = data.totalNotes ?? ranking.reduce((sum, person) => sum + (person.noteCount || 0), 0);
  const podium = [ranking[1], ranking[0], ranking[2]].filter(Boolean);
  const rest = ranking.slice(3, 13);
  const motivation = scoreboardMotivation(ranking, movements, newLeader);
  const connectionLabel = mode === 'error' ? 'Conexão instável' : mode === 'loading' ? 'Conectando' : compatibility ? 'Modo compatibilidade' : data.published ? 'Placar publicado' : 'Conectado · sem publicação';
  const updatedLabel = data.publishedAt ? formatDateTime(data.publishedAt) : lastUpdated ? lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';

  return <main className="scoreboard-shell min-h-screen text-white">
    <header className="scoreboard-header">
      <div className="scoreboard-title"><div className="score-logo-wrap"><img src="/capacity-logo.png" alt="Capacity"/></div><div><span className="score-brand">Campanha Comercial Capacity</span><h1>Ranking ao vivo</h1></div></div>
      <div className="scoreboard-stats"><div><strong>{total}</strong><span>Total de inscrições</span></div><div><strong>{ranking.length}</strong><span>Participantes</span></div><div><strong>{totalNotes}</strong><span>Notas de empenho</span></div><div><strong>{updatedLabel}</strong><span>Última atualização</span></div></div>
      <div className="scoreboard-controls"><span className={`score-connection ${mode}`}><i/> {connectionLabel}</span><button className="score-reload" onClick={() => void onReload()} aria-label="Recarregar placar"><RefreshCw size={14}/> Atualizar</button></div>
    </header>
    {mode === 'loading' && !ranking.length ? <section className="scoreboard-empty-screen"><div className="score-empty"><RefreshCw size={38}/><h2>Carregando ranking…</h2><p>Buscando os resultados mais recentes.</p></div></section> : !data.published && !compatibility ? <section className="scoreboard-empty-screen"><div className="score-empty"><Trophy size={48}/><h2>Placar ainda não publicado</h2><p>A gestão ainda não publicou resultados para esta campanha.</p></div></section> : ranking.length ? <section className={`scoreboard-main ${pulse ? 'scoreboard-pulse' : ''}`}>
      {newLeader && <div className="leader-alert"><Crown size={17}/> Nova liderança: <strong>{ranking[0].name}</strong></div>}
      <div className="scoreboard-intro"><div><h2>Classificação atual</h2></div><p>{motivation}</p></div>
      <div className="scoreboard-grid">
        <section className="podium-deck" aria-label="Pódio">
          {podium.map((person) => { const position = ranking.findIndex((item) => item.id === person.id) + 1; const movement = movements[person.id]; const tied = ranking.some((item) => item.id !== person.id && item.registrations === person.registrations); return <PodiumCard key={person.id} person={person} position={position} movement={movement} tied={tied}/>; })}
        </section>
        {rest.length > 0 && <section className="score-rankings" aria-label="Demais participantes"><div className="score-rankings-head"><span>Posição</span><span>Participante</span><span>Inscrições</span><span>N. Empenho</span><span>Movimento</span></div>{rest.map((person, index) => { const position = index + 4; const above = ranking[position - 2]; const movement = movements[person.id]; const gap = above ? Math.max(above.registrations - person.registrations, 0) : 0; return <RankingLine key={person.id} person={person} position={position} movement={movement} gap={gap} tied={Boolean(above && above.registrations === person.registrations)}/>; })}</section>}
      </div>
    </section> : <section className="scoreboard-empty-screen"><div className="score-empty"><Trophy size={48}/><h2>{compatibility ? 'A competição vai começar' : 'Placar ainda não publicado'}</h2><p>{compatibility ? 'As primeiras inscrições aparecerão aqui.' : 'A gestão ainda não publicou resultados para esta campanha.'}</p></div></section>}
    <footer className="score-ticker"><span className="live-dot"/><strong>Atualização automática a cada 15s</strong><p>{ranking[0] ? `${ranking[0].name} lidera com ${ranking[0].registrations} inscrições.` : data.published ? 'Nenhum participante pontuou nesta publicação.' : 'Aguardando publicação da gestão.'}</p><span>{data.version ? `Versão publicada ${data.version}` : compatibility ? 'Modo compatibilidade' : 'Sem publicação'}</span></footer>
  </main>;
}

function PodiumCard({ person, position, movement, tied }: { person: RankingRow; position: number; movement?: ScoreMovement; tied: boolean }) {
  const isLeader = position === 1;
  return <article className={`podium-card podium-place-${position} ${movement?.direction && movement.direction !== 'same' ? `movement-${movement.direction}` : ''}`}>
    <div className="podium-rank"><span>{position}º</span>{isLeader ? <Crown size={18}/> : null}</div>
    <Avatar name={person.name} url={person.avatarUrl}/><h3>{person.name}</h3>{isLeader && <span className="leader-tag">Líder</span>}{tied && <span className="podium-tie">Empate</span>}
    <AnimatedCount value={person.registrations} from={movement?.previousRegistrations}/><span className="podium-caption">{person.noteCount || 0} notas</span>
  </article>;
}

function RankingLine({ person, position, movement, gap, tied }: { person: RankingRow; position: number; movement?: ScoreMovement; gap: number; tied: boolean }) {
  const label = movement?.direction === 'up' ? `Subiu ${movement.delta} ${movement.delta === 1 ? 'posição' : 'posições'}` : movement?.direction === 'down' ? `Caiu ${Math.abs(movement.delta)} ${Math.abs(movement.delta) === 1 ? 'posição' : 'posições'}` : tied ? 'Empate' : gap > 0 ? `Faltam ${gap} para subir` : 'Manteve';
  return <article className={`score-rank-row movement-${movement?.direction || 'same'}`}><strong className="rank-number">{position}º</strong><div className="rank-person"><Avatar name={person.name} url={person.avatarUrl}/><strong>{person.name}</strong></div><strong className="rank-score"><AnimatedCount value={person.registrations} from={movement?.previousRegistrations}/></strong><strong className="rank-notes">{person.noteCount || 0}</strong><span className={`rank-movement ${movement?.direction || 'same'}`}>{movement?.direction === 'up' ? <ArrowUp size={14}/> : movement?.direction === 'down' ? <ArrowDown size={14}/> : <Minus size={14}/>} {label}</span></article>;
}

function AnimatedCount({ value, from }: { value: number; from?: number }) {
  const [display, setDisplay] = useState(from ?? value);
  useEffect(() => {
    if (from === undefined || from === value) { setDisplay(value); return; }
    const started = performance.now(); const duration = 650; let frame = 0;
    const tick = (now: number) => { const progress = Math.min((now - started) / duration, 1); setDisplay(Math.round((from + (value - from) * (1 - Math.pow(1 - progress, 3))))); if (progress < 1) frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [from, value]);
  return <>{display}</>;
}

function scoreboardMotivation(ranking: RankingRow[], movements: Record<string, ScoreMovement>, newLeader: boolean) {
  if (newLeader && ranking[0]) return `Nova liderança de ${ranking[0].name}`;
  if (ranking[1] && ranking[2] && ranking[1].registrations === ranking[2].registrations) return 'Empate acirrado na disputa pelo pódio';
  if (ranking[1] && ranking[2] && ranking[1].registrations - ranking[2].registrations <= 1) return `Apenas ${ranking[1].registrations - ranking[2].registrations || 1} inscrição separa o 2º do 3º lugar`;
  const biggestAdvance = Object.values(movements).filter((item) => item.direction === 'up').sort((a, b) => b.delta - a.delta)[0];
  if (biggestAdvance) return 'Maior avanço da rodada';
  return 'Disputa acirrada pelo pódio';
}
