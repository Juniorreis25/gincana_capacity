'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowUpRight, BarChart3, Check, CheckCircle2,
  Clock3, Eye, LayoutDashboard, ListChecks, Medal, Plus, Radio, RefreshCw,
  Settings2, Trophy, Users, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  approveCancellation as approveLiveCancellation,
  createLaunch,
  loadBootstrap,
  loadPreview,
  publishScoreboard,
  rejectCancellation as rejectLiveCancellation,
  requestCancellation as requestLiveCancellation,
  loadAdminData,
  adminMutation,
  setGameAssociations,
  type BootstrapData,
  type AdminData,
  type LiveCancellation,
  type LiveHistoryRow,
  type PreviewData,
} from '@/lib/integration';

declare global {
  interface Document {
    modelContext?: {
      registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void>;
    };
  }
}

type Person = {
  id?: string; name: string; team: string; initials: string; registrations: number; progress: number;
};

const initialRanking: Person[] = [
  { name: 'Jaqueline', team: 'Congressos', initials: 'JA', registrations: 18, progress: 90 },
  { name: 'Alana', team: 'Cursos', initials: 'AL', registrations: 16, progress: 80 },
  { name: 'Danyelle', team: 'Congressos', initials: 'DA', registrations: 14, progress: 70 },
  { name: 'Priscila', team: 'Cursos', initials: 'PR', registrations: 11, progress: 55 },
  { name: 'Eveline', team: 'In Company', initials: 'EV', registrations: 8, progress: 53 },
  { name: 'Kalini', team: 'Congressos', initials: 'KA', registrations: 3, progress: 20 },
  { name: 'Lorena', team: 'Cursos', initials: 'LO', registrations: 2, progress: 13 },
  { name: 'Hellaine', team: 'Cursos', initials: 'HE', registrations: 1, progress: 7 },
  { name: 'Iandra', team: 'Congressos', initials: 'IA', registrations: 1, progress: 7 },
];

const navItems = [
  { id: 'dashboard', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'history', label: 'Lançamentos', icon: ListChecks },
  { id: 'participants', label: 'Participantes', icon: Users },
  { id: 'teams', label: 'Equipes', icon: Users },
  { id: 'products', label: 'Produtos', icon: ListChecks },
  { id: 'games', label: 'Gincanas', icon: Trophy },
  { id: 'approvals', label: 'Aprovações', icon: CheckCircle2 },
] as const;

const pageNames: Record<string, string> = {
  dashboard: 'Gincana Rumo ao Topo', history: 'Lançamentos', participants: 'Participantes',
  games: 'Gincanas', approvals: 'Aprovações',
  teams: 'Equipes', products: 'Produtos',
};

export default function Home() {
  const [view, setView] = useState<'admin' | 'scoreboard'>('admin');
  const [page, setPage] = useState('dashboard');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pending, setPending] = useState(3);
  const [version, setVersion] = useState(12);
  const [publishedTotal, setPublishedTotal] = useState(74);
  const [ranking, setRanking] = useState(initialRanking);
  const [publishedRanking, setPublishedRanking] = useState(initialRanking);
  const [participant, setParticipant] = useState('Jaqueline');
  const [product, setProduct] = useState('CONBROP');
  const [products, setProducts] = useState<Array<{ id?: string; name: string }>>([{ name: 'CONBROP' }, { name: 'Formação em Licitações' }, { name: 'Pregão Eletrônico' }, { name: 'Treinamento In Company' }]);
  const [quantity, setQuantity] = useState(1);
  const [lastPublished, setLastPublished] = useState('hoje, 10:42');
  const [integrationMode, setIntegrationMode] = useState<'demo' | 'loading' | 'live' | 'error'>('loading');
  const [history, setHistory] = useState<LiveHistoryRow[]>([]);
  const [cancellations, setCancellations] = useState<LiveCancellation[]>([]);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [adminData, setAdminData] = useState<AdminData>({ teams: [], participants: [], products: [], games: [] });
  const [activeGameName, setActiveGameName] = useState('Nenhuma gincana ativa');

  const total = useMemo(() => ranking.reduce((sum, person) => sum + person.registrations, 0), [ranking]);
  const pendingCancellations = useMemo(() => cancellations.filter((item) => item.status === 'PENDENTE').length, [cancellations]);
  const changedPeople = useMemo(() => ranking.filter((person) => person.registrations !== publishedRanking.find((published) => published.name === person.name)?.registrations), [ranking, publishedRanking]);

  const openScoreboard = () => {
    const scoreboardUrl = `${window.location.origin}/?view=scoreboard`;
    const scoreboardWindow = window.open(scoreboardUrl, '_blank', 'noopener,noreferrer');
    if (scoreboardWindow) scoreboardWindow.opener = null;
  };

  const applyBootstrap = useCallback((bootstrap: BootstrapData) => {
    const liveRanking = bootstrap.participants.filter((person) => person.name).map((person) => ({
      id: person.id,
      name: person.name,
      team: person.team || 'Sem equipe',
      initials: person.initials || person.name.slice(0, 2).toUpperCase(),
      registrations: person.registrations,
      progress: person.progress ?? Math.min(100, person.registrations * 5),
    }));
    setActiveGameName(bootstrap.activeGame?.name || 'Nenhuma gincana ativa');
    setRanking(liveRanking);
    if (bootstrap.products.length) {
      const liveProducts = bootstrap.products.map((item) => ({ ...item, name: item.name.replace(/^\[DEMO\]\s*/i, '') })).filter((item) => item.name);
      if (liveProducts.length) {
        setProducts(liveProducts);
        setProduct((current) => liveProducts.some((item) => item.name === current) ? current : liveProducts[0].name);
      }
    } else setProducts([]);
    const published = bootstrap.published;
    if (published?.ranking?.length) setPublishedRanking(published.ranking.map((person) => ({ name: person.name, team: person.team || 'Sem equipe', initials: person.initials || person.name.slice(0, 2).toUpperCase(), registrations: person.registrations, progress: person.progress ?? Math.min(100, person.registrations * 5) })));
    else setPublishedRanking([]);
    setHistory(bootstrap.history || []);
    setCancellations(bootstrap.cancellations || []);
    setPending(bootstrap.pendingCount);
    if (published) { setPublishedTotal(published.total); setVersion(published.version); setLastPublished(published.publishedAt || 'ainda não publicada'); }
    else { setPublishedTotal(0); setVersion(0); setLastPublished('ainda não publicada'); }
    setIntegrationMode('live');
  }, []);

  const reloadIntegration = useCallback(async () => {
    const bootstrap = await loadBootstrap();
    if (!bootstrap) { setIntegrationMode('demo'); return null; }
    applyBootstrap(bootstrap);
    return bootstrap;
  }, [applyBootstrap]);

  const reloadAdmin = useCallback(async () => {
    try { setAdminData(await loadAdminData()); } catch { /* mantém a leitura principal e exibe o estado atual */ }
  }, []);

  const mutateAdmin = async (action: string, input: Record<string, unknown> = {}) => {
    try { setAdminData(await adminMutation(action, input)); } catch (error) { window.alert(error instanceof Error ? error.message : 'Não foi possível concluir a operação.'); }
  };

  const registerMovement = async (name = participant, amount = quantity, _item = product) => {
    const safeQuantity = Number(amount);
    if (!name || !Number.isInteger(safeQuantity) || safeQuantity < 1) throw new Error('Informe uma quantidade válida.');
    const selectedPerson = ranking.find((person) => person.name === name);
    const selectedProduct = products.find((item) => item.name === _item);
    if (integrationMode === 'live') {
      if (!selectedPerson?.id || !selectedProduct?.id) throw new Error('Participante ou produto sem identificador na planilha.');
      const bootstrap = await createLaunch({ participantId: selectedPerson.id, productId: selectedProduct.id, quantity: safeQuantity });
      applyBootstrap(bootstrap);
      void reloadAdmin();
      setRegisterOpen(false);
      return { status: 'pending_publication', participant: name, quantity: safeQuantity, persisted: true };
    }
    setRanking((current) => current
      .map((person) => person.name === name ? { ...person, registrations: person.registrations + safeQuantity, progress: Math.min(100, person.progress + safeQuantity * 5) } : person)
      .sort((a, b) => b.registrations - a.registrations));
    setPending((current) => current + 1);
    setRegisterOpen(false);
    return { status: 'pending_publication', participant: name, quantity: safeQuantity };
  };

  const openPreview = async () => {
    setPreviewLoading(true);
    try { setPreviewData(await loadPreview()); setPreviewOpen(true); }
    finally { setPreviewLoading(false); }
  };

  const publish = async () => {
    const result = await publishScoreboard();
    applyBootstrap(result.bootstrap);
    setPreviewOpen(false);
    setPreviewData(null);
    return { status: 'published', version: result.version, total: result.bootstrap.published?.total || total };
  };

  const requestCancellation = async (launchId: string) => {
    const reason = window.prompt('Informe o motivo do cancelamento:');
    if (!reason?.trim()) return;
    applyBootstrap(await requestLiveCancellation({ launchId, reason: reason.trim() }));
  };

  const approveCancellation = async (cancellationId: string) => {
    applyBootstrap(await approveLiveCancellation(cancellationId));
  };

  const rejectCancellation = async (cancellationId: string) => {
    const justification = window.prompt('Informe a justificativa da rejeição:');
    if (!justification?.trim()) return;
    applyBootstrap(await rejectLiveCancellation(cancellationId, justification.trim()));
  };

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('view') === 'scoreboard') {
      setView('scoreboard');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    void loadBootstrap(controller.signal).then((bootstrap) => {
      if (!mounted) return;
      if (!bootstrap) {
        setIntegrationMode('demo');
        return;
      }
      applyBootstrap(bootstrap);
      void reloadAdmin();
    }).catch(() => {
      if (mounted) setIntegrationMode('error');
    });
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [applyBootstrap, reloadAdmin]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(context.registerTool({
        name: 'register_demo_enrollment',
        title: 'Registrar inscrição de demonstração',
        description: 'Registra uma inscrição no protótipo e deixa a alteração pendente de publicação.',
        inputSchema: {
          type: 'object',
          properties: {
            participant: { type: 'string', enum: initialRanking.map((person) => person.name) },
            quantity: { type: 'integer', minimum: 1, maximum: 20 },
            product: { type: 'string' },
          },
          required: ['participant', 'quantity', 'product'], additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input: unknown) {
          const data = input as { participant?: string; quantity?: number; product?: string };
          if (!data.participant || !initialRanking.some((person) => person.name === data.participant) || !Number.isInteger(data.quantity) || !data.product) {
            throw new Error('Participante, quantidade e produto válidos são obrigatórios.');
          }
          return registerMovement(data.participant, data.quantity!, data.product);
        },
      }, { signal: lifecycle.signal })).catch(() => undefined);
    } catch { /* Navegadores sem WebMCP continuam usando a interface visual. */ }
    return () => lifecycle.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (view === 'scoreboard') {
    return <Scoreboard ranking={publishedRanking} total={publishedTotal} version={version} lastPublished={lastPublished} onBack={() => setView('admin')} onReload={reloadIntegration} />;
  }

  return (
    <>
      <main className="admin-shell min-h-screen text-slate-950">
        <aside className="sidebar-panel">
          <div className="brand-block">
            <div className="brand-logo-wrap"><img src="/capacity-logo.png" alt="Capacity" /></div>
            <span>Placar comercial</span>
          </div>

          <nav aria-label="Navegação principal" className="nav-list">
            {navItems.map((item) => {
              const Icon = item.icon;
              return <button key={item.id} onClick={() => setPage(item.id)} className={page === item.id ? 'nav-item active' : 'nav-item'}><Icon size={19} strokeWidth={1.8} />{item.label}{item.id === 'approvals' && pendingCancellations > 0 && <span className="nav-badge">{pendingCancellations}</span>}</button>;
            })}
          </nav>

          <div className="sidebar-footer">
            <button className="nav-item"><Settings2 size={19} /> Configurações</button>
            <div className="user-chip"><span>MS</span><div><strong>Marina Souza</strong><small>Supervisora</small></div></div>
          </div>
        </aside>

        <section className="main-panel">
          <header className="topbar">
            <div><div className="topbar-kicker"><p className="eyebrow">{page === 'dashboard' ? (activeGameName === 'Nenhuma gincana ativa' ? 'Base conectada' : 'Temporada ativa') : 'Gestão da competição'}</p><span className={`integration-badge ${integrationMode}`} aria-live="polite">{integrationMode === 'live' ? 'Conectado à planilha' : integrationMode === 'demo' || integrationMode === 'error' ? 'Modo demonstração' : 'Conectando à planilha…'}</span></div><h1>{page === 'dashboard' ? activeGameName : pageNames[page]}</h1></div>
            <div className="topbar-actions">
              <Button variant="outline" className="rounded-full" onClick={openScoreboard}><Eye size={17} /> Ver placar da TV</Button>
              <Button className="primary-action rounded-full" onClick={() => setRegisterOpen(true)}><Plus size={18} /> Registrar inscrição</Button>
            </div>
          </header>

          <div className="content-wrap">
            {page === 'dashboard' && <Dashboard ranking={ranking} pending={pending} pendingTotal={history.filter((row) => row.pendingPublication).reduce((sum, row) => sum + row.quantity, 0)} pendingParticipants={new Set(history.filter((row) => row.pendingPublication).map((row) => row.participantId)).size} total={total} version={version} lastPublished={lastPublished} onPreview={openPreview} previewLoading={previewLoading} />}
            {page === 'history' && <HistoryView history={history} onRequestCancellation={requestCancellation} />}
            {page === 'participants' && <ParticipantsView data={adminData} onMutate={mutateAdmin} />}
            {page === 'teams' && <TeamsView data={adminData} onMutate={mutateAdmin} />}
            {page === 'products' && <ProductsView data={adminData} onMutate={mutateAdmin} />}
            {page === 'games' && <GamesView data={adminData} onMutate={mutateAdmin} onAssociate={async (gameId, participantIds, productIds) => { const updated = await setGameAssociations(gameId, participantIds, productIds); setAdminData(updated); }} />}
            {page === 'approvals' && <ApprovalsView cancellations={cancellations} onApprove={approveCancellation} onReject={rejectCancellation} onGoToDashboard={() => setPage('dashboard')} />}
          </div>
        </section>
      </main>

      <RegistrationDialog open={registerOpen} onOpenChange={setRegisterOpen} participants={ranking} products={products} participant={participant} setParticipant={setParticipant} product={product} setProduct={setProduct} quantity={quantity} setQuantity={setQuantity} onSave={() => registerMovement()} />
      <PublicationDialog open={previewOpen} onOpenChange={setPreviewOpen} pending={pending} total={total} publishedTotal={publishedTotal} changedPeople={changedPeople} preview={previewData} onPublish={publish} />
    </>
  );
}

function Dashboard({ ranking, pending, pendingTotal, pendingParticipants, total, version, lastPublished, onPreview, previewLoading }: { ranking: Person[]; pending: number; pendingTotal: number; pendingParticipants: number; total: number; version: number; lastPublished: string; onPreview: () => void; previewLoading: boolean }) {
  return <>
    <section className={pending ? 'status-banner' : 'status-banner published'} aria-label="Status de publicação">
      <div className="status-icon">{pending ? <Radio size={20} /> : <Check size={20} />}</div>
      <div className="status-copy"><strong>{pending ? `${pending} alterações aguardam publicação` : 'Gestão e placar estão sincronizados'}</strong><span>{pending ? `${pendingTotal} inscrições líquidas · ${pendingParticipants} participantes afetadas · ` : ''}O placar da TV exibe a versão {version}, publicada {lastPublished}.</span></div>
      {pending > 0 && <Button className="publish-button" onClick={onPreview} disabled={previewLoading}>{previewLoading ? 'Gerando prévia…' : <>Revisar e publicar <ArrowUpRight size={17} /></>}</Button>}
    </section>

    <section className="metrics-grid" aria-label="Indicadores da gincana">
      <Metric label="Inscrições confirmadas" value={String(total)} detail="de 120 na meta coletiva" icon={<ListChecks />} />
      <Metric label="Participantes ativas" value={String(ranking.length)} detail={ranking.length ? `${new Set(ranking.map((person) => person.team)).size} equipes` : 'Base conectada e vazia'} icon={<Users />} />
      <Metric label="Líder atual" value={ranking[0]?.name || 'Ainda não definido'} detail={ranking[0] ? `${ranking[0].registrations} inscrições` : 'Aguardando dados'} icon={<Medal />} featured />
      <Metric label="Dias restantes" value="18" detail="encerra em 24 de setembro" icon={<Clock3 />} />
    </section>

    <section className="dashboard-grid">
      <article className="panel-card ranking-card">
        <div className="card-heading"><div><p className="eyebrow">Classificação operacional</p><h2>Disputa pela liderança</h2></div><span className="criteria-pill"><BarChart3 size={15} /> por inscrições</span></div>
        <RankingTable ranking={ranking.slice(0, 5)} />
      </article>
      <aside className="right-stack">
        <article className="panel-card goal-card"><p className="eyebrow">Meta coletiva</p><div className="goal-number"><strong>{((total / 120) * 100).toFixed(1).replace('.', ',')}%</strong><span>{total} de 120</span></div><Progress value={(total / 120) * 100} className="goal-progress" /><p>Faltam <strong>{Math.max(0, 120 - total)} inscrições</strong> para a equipe alcançar a meta.</p></article>
        <article className="panel-card activity-card"><div className="card-heading"><div><p className="eyebrow">Agora na disputa</p><h2>Últimas conquistas</h2></div></div>{ranking.length ? <Activity /> : <div className="empty-state"><p>Ainda não há movimentações na base conectada.</p></div>}</article>
      </aside>
    </section>
  </>;
}

function Metric({ label, value, detail, icon, featured = false }: { label: string; value: string; detail: string; icon: React.ReactNode; featured?: boolean }) {
  return <article className={featured ? 'metric-card featured' : 'metric-card'}><div className="metric-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>;
}

function RankingTable({ ranking }: { ranking: Person[] }) {
  return <div className="ranking-table"><div className="ranking-head"><span>Posição</span><span>Participante</span><span>Meta</span><span>Inscrições</span></div>{ranking.map((person, index) => <div className="ranking-row" key={person.name}><span className={index < 3 ? `position position-${index + 1}` : 'position'}>{index + 1}</span><div className="person-cell"><span className="avatar">{person.initials}</span><div><strong>{person.name}</strong><small>{person.team}</small></div></div><div className="progress-cell"><Progress value={person.progress} /><small>{person.progress}%</small></div><strong className="registration-count">{person.registrations}</strong></div>)}</div>;
}

function Activity() {
  return <><div className="activity-item"><span className="activity-dot orange" /><p><strong>Jaqueline</strong> confirmou 2 inscrições para o CONBROP.<small>há 18 min</small></p></div><div className="activity-item"><span className="activity-dot blue" /><p><strong>Alana</strong> alcançou 80% da meta individual.<small>há 1 h</small></p></div><div className="activity-item"><span className="activity-dot gold" /><p><strong>Danyelle</strong> avançou para o pódio.<small>ontem, 17:24</small></p></div></>;
}

function HistoryView({ history, onRequestCancellation }: { history: LiveHistoryRow[]; onRequestCancellation: (launchId: string) => void }) {
  const [participantFilter, setParticipantFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [publicationFilter, setPublicationFilter] = useState<'all' | 'published' | 'pending'>('all');
  const filtered = history.filter((row) => (!participantFilter || row.participant.toLowerCase().includes(participantFilter.toLowerCase())) && (!productFilter || row.product.toLowerCase().includes(productFilter.toLowerCase())) && (publicationFilter === 'all' || publicationFilter === 'pending' && row.pendingPublication || publicationFilter === 'published' && !row.pendingPublication));
  return <section className="list-page panel-card"><div className="list-page-head"><div><p className="eyebrow">Histórico auditável</p><h2>Movimentações recentes</h2></div><Input aria-label="Pesquisar participante" placeholder="Participante" className="search-input" value={participantFilter} onChange={(event) => setParticipantFilter(event.target.value)} /><Input aria-label="Pesquisar produto" placeholder="Produto" className="search-input" value={productFilter} onChange={(event) => setProductFilter(event.target.value)} /><select aria-label="Filtrar publicação" value={publicationFilter} onChange={(event) => setPublicationFilter(event.target.value as typeof publicationFilter)}><option value="all">Todos</option><option value="pending">Pendentes</option><option value="published">Publicados</option></select></div><div className="data-table"><div className="data-row data-head"><span>Data</span><span>Participante</span><span>Produto</span><span>Quantidade</span><span>Situação</span><span>Versão</span><span>Responsável</span><span>Ação</span></div>{filtered.length ? filtered.map((row) => <div className="data-row" key={row.id}><span>{row.date || '—'}</span><span>{row.participant || '—'}</span><span>{row.product || '—'}</span><span>{row.quantity > 0 ? `+${row.quantity}` : row.quantity}</span><span className="status-cell">{row.status === 'ATIVO' ? 'Ativo' : row.status === 'REVERTIDO' ? 'Revertido' : row.status}</span><span>{row.pendingPublication ? 'Pendente de publicação' : row.publishedVersion || '—'}</span><span>{row.createdBy || '—'}</span><span>{row.status === 'ATIVO' && <Button variant="outline" onClick={() => onRequestCancellation(row.id)}>Solicitar cancelamento</Button>}</span></div>) : <div className="empty-row">Nenhum lançamento encontrado.</div>}</div></section>;
}

function promptValue(label: string, initial = '') { const value = window.prompt(label, initial); return value?.trim() || ''; }

function AdminActions({ kind, item, onMutate }: { kind: 'team' | 'participant' | 'product' | 'game'; item: { id: string; name: string; active?: boolean; status?: string; historyCount?: number }; onMutate: (action: string, input?: Record<string, unknown>) => void }) {
  const prefix = kind.charAt(0).toUpperCase() + kind.slice(1);
  const isActive = item.active ?? item.status === 'ATIVA';
  return <div className="admin-row-actions"><Button variant="outline" onClick={() => { const name = promptValue(`Nome de ${prefix.toLowerCase()}`, item.name); if (name) void onMutate(`update${prefix}`, { id: item.id, name }); }}>Editar</Button><Button variant="outline" onClick={() => void onMutate(isActive ? `deactivate${prefix}` : `update${prefix}`, isActive ? { id: item.id } : { id: item.id, name: item.name, active: true })}>{isActive ? 'Desativar' : 'Reativar'}</Button><Button variant="outline" onClick={() => { if (window.confirm(item.historyCount ? 'Este registro possui histórico e não pode ser excluído. Desativar em vez disso?' : 'Excluir este registro?')) void onMutate(`delete${prefix}`, { id: item.id }); }}>Excluir</Button></div>;
}

function ParticipantsView({ data, onMutate }: { data: AdminData; onMutate: (action: string, input?: Record<string, unknown>) => void }) {
  const teamName = (id: string) => data.teams.find((team) => team.id === id)?.name || 'Sem equipe';
  return <section className="list-page panel-card"><div className="list-page-head"><div><p className="eyebrow">Cadastros conectados</p><h2>Participantes</h2></div><Button variant="outline" onClick={() => { const name = promptValue('Nome da participante'); if (name) void onMutate('createParticipant', { name, teamId: data.teams[0]?.id || '' }); }}><Plus size={16}/> Nova participante</Button></div>{data.participants.length ? <div className="people-grid">{data.participants.map((person) => <article className="person-card" key={person.id}><span className="avatar large">{person.name.slice(0, 2).toUpperCase()}</span><div><strong>{person.name}</strong><p>{teamName(person.teamId)} · {person.active ? 'Ativa' : 'Inativa'}</p></div><AdminActions kind="participant" item={person} onMutate={onMutate} /></article>)}</div> : <div className="empty-state"><Users size={22}/><p>Base conectada, mas ainda sem participantes cadastradas.</p></div>}</section>;
}

function TeamsView({ data, onMutate }: { data: AdminData; onMutate: (action: string, input?: Record<string, unknown>) => void }) {
  return <section className="list-page panel-card"><div className="list-page-head"><div><p className="eyebrow">Cadastros conectados</p><h2>Equipes</h2></div><Button variant="outline" onClick={() => { const name = promptValue('Nome da equipe'); if (name) void onMutate('createTeam', { name }); }}><Plus size={16}/> Nova equipe</Button></div>{data.teams.length ? <div className="people-grid">{data.teams.map((team) => <article className="person-card" key={team.id}><span className="avatar large">{team.name.slice(0, 2).toUpperCase()}</span><div><strong>{team.name}</strong><p>{team.active ? 'Ativa' : 'Inativa'}</p></div><AdminActions kind="team" item={team} onMutate={onMutate} /></article>)}</div> : <div className="empty-state"><Users size={22}/><p>Base conectada, mas ainda sem equipes cadastradas.</p></div>}</section>;
}

function ProductsView({ data, onMutate }: { data: AdminData; onMutate: (action: string, input?: Record<string, unknown>) => void }) {
  return <section className="list-page panel-card"><div className="list-page-head"><div><p className="eyebrow">Cadastros conectados</p><h2>Produtos e eventos</h2></div><Button variant="outline" onClick={() => { const name = promptValue('Nome do produto ou evento'); if (name) void onMutate('createProduct', { name, category: 'OUTRO', points: 1 }); }}><Plus size={16}/> Novo produto</Button></div>{data.products.length ? <div className="people-grid">{data.products.map((product) => <article className="person-card" key={product.id}><span className="avatar large">{product.name.slice(0, 2).toUpperCase()}</span><div><strong>{product.name}</strong><p>{product.category || 'OUTRO'} · {product.active ? 'Ativo' : 'Inativo'}</p></div><AdminActions kind="product" item={product} onMutate={onMutate} /></article>)}</div> : <div className="empty-state"><ListChecks size={22}/><p>Base conectada, mas ainda sem produtos cadastrados.</p></div>}</section>;
}

function GamesView({ data, onMutate, onAssociate }: { data: AdminData; onMutate: (action: string, input?: Record<string, unknown>) => void; onAssociate: (gameId: string, participantIds: string[], productIds: string[]) => Promise<void> }) {
  const [selected, setSelected] = useState<string>('');
  const game = data.games.find((item) => item.id === selected) || data.games[0];
  return <section className="games-grid"><div className="panel-card list-page"><div className="list-page-head"><div><p className="eyebrow">Cadastros conectados</p><h2>Gincanas</h2></div><Button variant="outline" onClick={() => { const name = promptValue('Nome da gincana'); if (name) void onMutate('createGame', { name, startDate: new Date().toISOString().slice(0, 10), endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) }); }}><Plus size={16}/> Nova gincana</Button></div>{data.games.length ? data.games.map((item) => <article className="game-card" key={item.id}><span className="game-status">{item.status}</span><h2>{item.name}</h2><p>{item.participants.length} participantes · {item.products.length} produtos · versão {item.publishedVersion}</p><div className="admin-row-actions"><Button variant="outline" onClick={() => setSelected(item.id)}>Gerenciar associações</Button>{item.status !== 'ATIVA' && <Button className="primary-action" onClick={() => void onMutate('activateGame', { id: item.id })}>Ativar</Button>}{item.status === 'ATIVA' && <Button variant="outline" onClick={() => void onMutate('deactivateGame', { id: item.id })}>Desativar</Button>}<AdminActions kind="game" item={item} onMutate={onMutate} /></div></article>) : <div className="empty-state"><Trophy size={22}/><p>Base conectada, mas ainda sem gincanas cadastradas.</p></div>}</div>{game && <article className="panel-card list-page"><p className="eyebrow">Associações básicas</p><h2>{game.name}</h2><p>Inclua participantes e produtos pelas listas suspensas. Você pode remover itens antes de salvar.</p><AssociationEditor key={game.id} data={data} game={game} onSave={onAssociate}/></article>}</section>;
}

function AssociationEditor({ data, game, onSave }: { data: AdminData; game: AdminData['games'][number]; onSave: (gameId: string, participantIds: string[], productIds: string[]) => Promise<void> }) {
  const [participants, setParticipants] = useState(game.participants);
  const [products, setProducts] = useState(game.products);
  const [participantToAdd, setParticipantToAdd] = useState('');
  const [productToAdd, setProductToAdd] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const availableParticipants = data.participants.filter((item) => item.active && !participants.includes(item.id));
  const availableProducts = data.products.filter((item) => item.active && !products.includes(item.id));
  const participantName = (id: string) => data.participants.find((item) => item.id === id)?.name || 'Participante removida';
  const productName = (id: string) => data.products.find((item) => item.id === id)?.name || 'Produto removido';
  const save = async () => {
    setSaving(true); setMessage('');
    try { await onSave(game.id, participants, products); setMessage('Associações salvas na planilha.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar as associações.'); }
    finally { setSaving(false); }
  };
  return <div className="association-editor"><div className="form-grid"><div className="field"><Label htmlFor="participant-association">Adicionar participante</Label><div className="association-picker"><select id="participant-association" value={participantToAdd} onChange={(event) => setParticipantToAdd(event.target.value)}><option value="">Selecione uma participante</option>{availableParticipants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><Button type="button" variant="outline" disabled={!participantToAdd} onClick={() => { setParticipants((current) => current.includes(participantToAdd) ? current : [...current, participantToAdd]); setParticipantToAdd(''); }}>Adicionar</Button></div><AssociationChips ids={participants} nameFor={participantName} onRemove={(id) => setParticipants((current) => current.filter((item) => item !== id))}/></div><div className="field"><Label htmlFor="product-association">Adicionar produto</Label><div className="association-picker"><select id="product-association" value={productToAdd} onChange={(event) => setProductToAdd(event.target.value)}><option value="">Selecione um produto</option>{availableProducts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><Button type="button" variant="outline" disabled={!productToAdd} onClick={() => { setProducts((current) => current.includes(productToAdd) ? current : [...current, productToAdd]); setProductToAdd(''); }}>Adicionar</Button></div><AssociationChips ids={products} nameFor={productName} onRemove={(id) => setProducts((current) => current.filter((item) => item !== id))}/></div></div><div className="association-save"><Button className="primary-action" disabled={saving} onClick={() => { void save(); }}>{saving ? 'Salvando…' : 'Salvar associações'}</Button>{message && <p role="status" className={message === 'Associações salvas na planilha.' ? 'association-feedback success' : 'association-feedback error'}>{message}</p>}</div></div>;
}

function AssociationChips({ ids, nameFor, onRemove }: { ids: string[]; nameFor: (id: string) => string; onRemove: (id: string) => void }) {
  return <div className="association-chips" aria-label="Itens associados">{ids.length ? ids.map((id) => <span key={id}>{nameFor(id)}<button type="button" aria-label={`Remover ${nameFor(id)}`} onClick={() => onRemove(id)}>×</button></span>) : <small>Nenhum item associado.</small>}</div>;
}

function ApprovalsView({ cancellations, onApprove, onReject, onGoToDashboard }: { cancellations: LiveCancellation[]; onApprove: (id: string) => void; onReject: (id: string) => void; onGoToDashboard: () => void }) {
  const pending = cancellations.filter((item) => item.status === 'PENDENTE');
  const resolved = cancellations.filter((item) => item.status !== 'PENDENTE');
  return <section className="approval-layout">{pending.length ? pending.map((item) => <article className="panel-card approval-card" key={item.id}><div className="approval-top"><span className="avatar large">{item.participant.slice(0, 2).toUpperCase()}</span><div><p className="eyebrow">Cancelamento solicitado {item.requestedAt || 'recentemente'}</p><h2>{item.participant} · {item.product}</h2></div><span className="approval-status pending">Pendente</span></div><div className="approval-details"><div><span>Lançamento original</span><strong>{item.quantity} inscrições</strong></div><div><span>Motivo</span><strong>{item.reason}</strong></div></div><p className="approval-note">Aprovar criará uma reversão. O resultado ficará pendente até a próxima publicação do placar.</p><div className="approval-actions"><Button variant="outline" onClick={() => onReject(item.id)}><XCircle size={16}/> Rejeitar</Button><Button className="primary-action" onClick={() => onApprove(item.id)}><CheckCircle2 size={16}/> Aprovar cancelamento</Button></div></article>) : <article className="panel-card empty-state"><CheckCircle2 size={22}/><p>Nenhum cancelamento pendente.</p></article>}{resolved.map((item) => <article className={`panel-card approval-card resolved ${item.status === 'APROVADO' ? 'approved' : 'rejected'}`} key={item.id}><div className="approval-top"><span className="avatar large">{item.participant.slice(0, 2).toUpperCase()}</span><div><p className="eyebrow">Cancelamento analisado</p><h2>{item.participant} · {item.product}</h2></div><span className={`approval-status ${item.status === 'APROVADO' ? 'approved' : 'rejected'}`}>{item.status === 'APROVADO' ? <><CheckCircle2 size={15}/> Aprovado</> : <><XCircle size={15}/> Rejeitado</>}</span></div><div className={`approval-result ${item.status === 'APROVADO' ? 'approved' : 'rejected'}`}><div>{item.status === 'APROVADO' ? <CheckCircle2 size={21}/> : <XCircle size={21}/>}<p><strong>{item.status === 'APROVADO' ? 'Cancelamento aprovado e reversão criada.' : 'Cancelamento rejeitado.'}</strong><span>{item.status === 'APROVADO' ? 'A reversão aguarda a próxima publicação.' : item.analysisJustification || 'O lançamento original permanece ativo.'}</span></p></div>{item.status === 'APROVADO' && <Button variant="outline" onClick={onGoToDashboard}>Ver alterações pendentes <ArrowUpRight size={16}/></Button>}</div></article>)}</section>;
}

function RegistrationDialog({ open, onOpenChange, participants, products, participant, setParticipant, product, setProduct, quantity, setQuantity, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; participants: Person[]; products: Array<{ id?: string; name: string }>; participant: string; setParticipant: (value: string) => void; product: string; setProduct: (value: string) => void; quantity: number; setQuantity: (value: number) => void; onSave: () => void | Promise<unknown> }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="registration-dialog"><DialogHeader><DialogTitle>Registrar nova inscrição</DialogTitle><DialogDescription>O lançamento ficará pendente até a próxima publicação do placar.</DialogDescription></DialogHeader><div className="form-grid"><div className="field"><Label htmlFor="participant">Participante</Label><select id="participant" value={participant} onChange={(event) => setParticipant(event.target.value)}>{participants.map((person) => <option key={person.name}>{person.name}</option>)}</select></div><div className="field"><Label htmlFor="product">Evento ou curso</Label><select id="product" value={product} onChange={(event) => setProduct(event.target.value)}>{products.map((item) => <option key={item.name}>{item.name}</option>)}</select></div><div className="field"><Label htmlFor="quantity">Quantidade</Label><Input id="quantity" type="number" min={1} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} /></div><div className="field"><Label htmlFor="client">Órgão ou cliente</Label><Input id="client" placeholder="Opcional" /></div><div className="field full"><Label htmlFor="notes">Observação</Label><Input id="notes" placeholder="Informação complementar" /></div></div><div className="points-preview"><span>Pontuação calculada</span><strong>{quantity * 10} pontos</strong></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button className="primary-action" onClick={() => { void Promise.resolve(onSave()).catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Não foi possível salvar a inscrição.')); }}><Check size={17}/> Confirmar inscrição</Button></DialogFooter></DialogContent></Dialog>;
}

function PublicationDialog({ open, onOpenChange, pending, total, publishedTotal, changedPeople, preview, onPublish }: { open: boolean; onOpenChange: (open: boolean) => void; pending: number; total: number; publishedTotal: number; changedPeople: Person[]; preview: PreviewData | null; onPublish: () => void | Promise<unknown> }) {
  const rows = preview?.changes || changedPeople.map((person) => ({ id: person.id || person.name, name: person.name, team: person.team, initials: person.initials, previousPosition: null, newPosition: null, previousRegistrations: 0, newRegistrations: person.registrations, movement: 'nova' as const, positionDelta: null }));
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="publication-dialog"><DialogHeader><DialogTitle>Prévia da atualização</DialogTitle><DialogDescription>Confira o cálculo real do servidor antes de liberar a nova versão para a TV.</DialogDescription></DialogHeader><div className="preview-summary"><div><span>Alterações pendentes</span><strong>{preview?.pendingCount ?? pending}</strong></div><div><span>Inscrições publicadas</span><strong>{preview?.publishedTotal ?? publishedTotal}</strong></div><ArrowUpRight/><div><span>Novo total</span><strong>{preview?.currentTotal ?? total}</strong></div></div><div className="preview-list"><p className="eyebrow">Comparação com a versão {preview?.publishedVersion ?? 0}</p>{rows.length ? rows.map((row) => <div key={row.id}><span className="avatar">{row.initials}</span><strong>{row.name}</strong><span>{row.previousPosition ? `${row.previousPosition}º → ${row.newPosition}º` : `— → ${row.newPosition}º`} · {row.previousRegistrations} → {row.newRegistrations} inscrições · {row.movement}</span></div>) : <p>Nenhuma alteração pendente.</p>}</div><div className="publication-warning"><RefreshCw size={18}/><p><strong>A versão anterior será preservada.</strong><span>A TV só mudará após a confirmação no servidor.</span></p></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}><ArrowLeft size={16}/> Cancelar e revisar</Button><Button className="primary-action" onClick={() => { void Promise.resolve(onPublish()).catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Não foi possível publicar.')); }}><CheckCircle2 size={17}/> Confirmar atualização</Button></DialogFooter></DialogContent></Dialog>;
}

function Scoreboard({ ranking, total, version, lastPublished, onBack, onReload }: { ranking: Person[]; total: number; version: number; lastPublished: string; onBack: () => void; onReload: () => Promise<BootstrapData | null> }) {
  useEffect(() => {
    const timer = window.setInterval(() => { void onReload(); }, 15000);
    return () => window.clearInterval(timer);
  }, [onReload]);
  const podium = [ranking[1], ranking[0], ranking[2]];
  const empty = ranking.length === 0 || version === 0;
  return <main className="scoreboard-shell min-h-screen text-white"><header className="scoreboard-header"><div className="scoreboard-title"><div className="score-logo-wrap"><img src="/capacity-logo.png" alt="Capacity" /></div><div><span className="score-brand">Placar comercial</span><h1>Gincana Comercial Capacity</h1></div></div><div className="scoreboard-meta"><span>Critério: inscrições confirmadas</span><strong>{empty ? 'Aguardando publicação' : 'Placar publicado'}</strong><button onClick={onBack}>Voltar à gestão</button><button className="score-reload" onClick={() => { void onReload(); }}><RefreshCw size={14}/> Recarregar placar</button></div></header>{empty ? <section className="scoreboard-content"><div className="score-empty"><Trophy size={42}/><h2>Placar ainda não publicado</h2><p>A TV será atualizada quando a supervisora publicar uma nova versão.</p></div></section> : <section className="scoreboard-content"><div className="podium">{podium.filter(Boolean).map((person, index) => { const place = [2, 1, 3][index]; return <article className={`podium-card place-${place}`} key={person.name}><span className="podium-place">{place}º</span><span className="podium-avatar">{person.initials}</span><h2>{person.name}</h2><p>{person.team}</p><strong>{person.registrations}<small> inscrições</small></strong><Progress value={person.progress} /><span>{person.progress}% da meta</span></article>; })}</div><aside className="score-summary"><p>Juntas, já conquistamos</p><strong>{total}</strong><span>inscrições confirmadas</span><Progress value={(total / 120) * 100} /><small>{((total / 120) * 100).toFixed(1).replace('.', ',')}% da meta coletiva</small></aside></section>}<footer className="score-ticker"><span className="live-dot" /><strong>Última conquista</strong><p>{ranking[0] ? `${ranking[0].name} está na liderança com ${ranking[0].registrations} inscrições` : 'Aguardando dados publicados'}</p><span>{empty ? 'Nenhuma versão publicada' : `Versão ${version} · ${lastPublished}`}</span></footer></main>;
}
