'use client';

import { useEffect, useMemo, useState } from 'react';
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

declare global {
  interface Document {
    modelContext?: {
      registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void>;
    };
  }
}

type Person = {
  name: string; team: string; initials: string; registrations: number; progress: number;
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
  { id: 'games', label: 'Gincanas', icon: Trophy },
  { id: 'approvals', label: 'Aprovações', icon: CheckCircle2 },
] as const;

const pageNames: Record<string, string> = {
  dashboard: 'Gincana Rumo ao Topo', history: 'Lançamentos', participants: 'Participantes',
  games: 'Gincanas', approvals: 'Aprovações',
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
  const [quantity, setQuantity] = useState(1);
  const [lastPublished, setLastPublished] = useState('hoje, 10:42');
  const [cancellationStatus, setCancellationStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');

  const total = useMemo(() => ranking.reduce((sum, person) => sum + person.registrations, 0), [ranking]);
  const changedPeople = useMemo(() => ranking.filter((person) => person.registrations !== publishedRanking.find((published) => published.name === person.name)?.registrations), [ranking, publishedRanking]);

  const registerMovement = (name = participant, amount = quantity, item = product) => {
    const safeQuantity = Number(amount);
    if (!name || !Number.isInteger(safeQuantity) || safeQuantity < 1) throw new Error('Informe uma quantidade válida.');
    setRanking((current) => current
      .map((person) => person.name === name ? { ...person, registrations: person.registrations + safeQuantity, progress: Math.min(100, person.progress + safeQuantity * 5) } : person)
      .sort((a, b) => b.registrations - a.registrations));
    setPending((current) => current + 1);
    setRegisterOpen(false);
    return { status: 'pending_publication', participant: name, quantity: safeQuantity };
  };

  const publish = () => {
    setPublishedRanking(ranking);
    setPublishedTotal(total);
    setPending(0);
    setVersion((current) => current + 1);
    setLastPublished('agora');
    setPreviewOpen(false);
    return { status: 'published', version: version + 1, total };
  };

  const approveCancellation = () => {
    if (cancellationStatus !== 'pending') return;
    setRanking((current) => current
      .map((person) => person.name === 'Eveline' ? { ...person, registrations: Math.max(0, person.registrations - 2), progress: Math.max(0, person.progress - 13) } : person)
      .sort((a, b) => b.registrations - a.registrations));
    setCancellationStatus('approved');
    setPending((current) => current + 1);
  };

  const rejectCancellation = () => {
    if (cancellationStatus !== 'pending') return;
    setCancellationStatus('rejected');
  };

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
    return <Scoreboard ranking={publishedRanking} total={publishedTotal} version={version} lastPublished={lastPublished} onBack={() => setView('admin')} />;
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
              return <button key={item.id} onClick={() => setPage(item.id)} className={page === item.id ? 'nav-item active' : 'nav-item'}><Icon size={19} strokeWidth={1.8} />{item.label}{item.id === 'approvals' && cancellationStatus === 'pending' && <span className="nav-badge">1</span>}</button>;
            })}
          </nav>

          <div className="sidebar-footer">
            <button className="nav-item"><Settings2 size={19} /> Configurações</button>
            <div className="user-chip"><span>MS</span><div><strong>Marina Souza</strong><small>Supervisora</small></div></div>
          </div>
        </aside>

        <section className="main-panel">
          <header className="topbar">
            <div><p className="eyebrow">{page === 'dashboard' ? 'Temporada ativa' : 'Gestão da competição'}</p><h1>{pageNames[page]}</h1></div>
            <div className="topbar-actions">
              <Button variant="outline" className="rounded-full" onClick={() => setView('scoreboard')}><Eye size={17} /> Ver placar da TV</Button>
              <Button className="primary-action rounded-full" onClick={() => setRegisterOpen(true)}><Plus size={18} /> Registrar inscrição</Button>
            </div>
          </header>

          <div className="content-wrap">
            {page === 'dashboard' && <Dashboard ranking={ranking} pending={pending} total={total} version={version} lastPublished={lastPublished} onPreview={() => setPreviewOpen(true)} />}
            {page === 'history' && <HistoryView cancellationStatus={cancellationStatus} />}
            {page === 'participants' && <ParticipantsView ranking={ranking} />}
            {page === 'games' && <GamesView />}
            {page === 'approvals' && <ApprovalsView status={cancellationStatus} onApprove={approveCancellation} onReject={rejectCancellation} onGoToDashboard={() => setPage('dashboard')} />}
          </div>
        </section>
      </main>

      <RegistrationDialog open={registerOpen} onOpenChange={setRegisterOpen} participant={participant} setParticipant={setParticipant} product={product} setProduct={setProduct} quantity={quantity} setQuantity={setQuantity} onSave={() => registerMovement()} />
      <PublicationDialog open={previewOpen} onOpenChange={setPreviewOpen} pending={pending} total={total} publishedTotal={publishedTotal} changedPeople={changedPeople} onPublish={publish} />
    </>
  );
}

function Dashboard({ ranking, pending, total, version, lastPublished, onPreview }: { ranking: Person[]; pending: number; total: number; version: number; lastPublished: string; onPreview: () => void }) {
  return <>
    <section className={pending ? 'status-banner' : 'status-banner published'} aria-label="Status de publicação">
      <div className="status-icon">{pending ? <Radio size={20} /> : <Check size={20} />}</div>
      <div className="status-copy"><strong>{pending ? `${pending} alterações aguardam publicação` : 'Gestão e placar estão sincronizados'}</strong><span>O placar da TV exibe a versão {version}, publicada {lastPublished}.</span></div>
      {pending > 0 && <Button className="publish-button" onClick={onPreview}>Revisar e publicar <ArrowUpRight size={17} /></Button>}
    </section>

    <section className="metrics-grid" aria-label="Indicadores da gincana">
      <Metric label="Inscrições confirmadas" value={String(total)} detail="de 120 na meta coletiva" icon={<ListChecks />} />
      <Metric label="Participantes ativas" value="9" detail="em 3 equipes" icon={<Users />} />
      <Metric label="Líder atual" value={ranking[0].name} detail={`${ranking[0].registrations} inscrições`} icon={<Medal />} featured />
      <Metric label="Dias restantes" value="18" detail="encerra em 24 de setembro" icon={<Clock3 />} />
    </section>

    <section className="dashboard-grid">
      <article className="panel-card ranking-card">
        <div className="card-heading"><div><p className="eyebrow">Classificação operacional</p><h2>Disputa pela liderança</h2></div><span className="criteria-pill"><BarChart3 size={15} /> por inscrições</span></div>
        <RankingTable ranking={ranking.slice(0, 5)} />
      </article>
      <aside className="right-stack">
        <article className="panel-card goal-card"><p className="eyebrow">Meta coletiva</p><div className="goal-number"><strong>{((total / 120) * 100).toFixed(1).replace('.', ',')}%</strong><span>{total} de 120</span></div><Progress value={(total / 120) * 100} className="goal-progress" /><p>Faltam <strong>{Math.max(0, 120 - total)} inscrições</strong> para a equipe alcançar a meta.</p></article>
        <article className="panel-card activity-card"><div className="card-heading"><div><p className="eyebrow">Agora na disputa</p><h2>Últimas conquistas</h2></div></div><Activity /></article>
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

function HistoryView({ cancellationStatus }: { cancellationStatus: 'pending' | 'approved' | 'rejected' }) {
  const rows = [
    ['Hoje, 10:37', 'Jaqueline', 'CONBROP', '+2', 'Ativo'], ['Hoje, 09:12', 'Alana', 'Formação em Licitações', '+1', 'Ativo'], ['Ontem, 17:24', 'Danyelle', 'CONBROP', '+3', 'Ativo'], ['Ontem, 14:03', 'Priscila', 'Pregão Eletrônico', '+1', 'Ativo'], ['04 set, 16:18', 'Eveline', 'Treinamento In Company', '+2', cancellationStatus === 'approved' ? 'Revertido' : cancellationStatus === 'rejected' ? 'Ativo' : 'Cancelamento pendente'],
  ];
  return <section className="list-page panel-card"><div className="list-page-head"><div><p className="eyebrow">Histórico auditável</p><h2>Movimentações recentes</h2></div><Input aria-label="Pesquisar lançamentos" placeholder="Pesquisar participante ou produto" className="search-input" /></div><div className="data-table"><div className="data-row data-head"><span>Data</span><span>Participante</span><span>Produto</span><span>Inscrições</span><span>Status</span></div>{rows.map((row) => <div className="data-row" key={row.join('-')}>{row.map((cell, index) => <span key={cell} className={index === 4 ? 'status-cell' : ''}>{cell}</span>)}</div>)}</div></section>;
}

function ParticipantsView({ ranking }: { ranking: Person[] }) {
  return <section className="list-page panel-card"><div className="list-page-head"><div><p className="eyebrow">Equipe comercial</p><h2>9 participantes ativas</h2></div><Button variant="outline"><Plus size={16}/> Nova participante</Button></div><div className="people-grid">{ranking.map((person) => <article className="person-card" key={person.name}><span className="avatar large">{person.initials}</span><div><strong>{person.name}</strong><p>{person.team}</p></div><span className="person-score">{person.registrations}<small> inscrições</small></span></article>)}</div></section>;
}

function GamesView() {
  return <section className="games-grid"><article className="panel-card game-card active-game"><span className="game-status"><Radio size={14}/> Ativa</span><p className="eyebrow">06 a 24 de setembro</p><h2>Gincana Rumo ao Topo</h2><p>Ranking geral por inscrições · 9 participantes · meta de 120</p><div className="game-card-footer"><Progress value={61.7}/><strong>61,7%</strong></div></article><article className="panel-card game-card draft-game"><span className="game-status">Rascunho</span><p className="eyebrow">Próxima temporada</p><h2>Campanha de Outubro</h2><p>Defina participantes, produtos e regras antes de ativar.</p><Button variant="outline">Continuar configuração</Button></article></section>;
}

function ApprovalsView({ status, onApprove, onReject, onGoToDashboard }: { status: 'pending' | 'approved' | 'rejected'; onApprove: () => void; onReject: () => void; onGoToDashboard: () => void }) {
  return <section className="approval-layout"><article className={`panel-card approval-card ${status !== 'pending' ? `resolved ${status}` : ''}`}><div className="approval-top"><span className="avatar large">EV</span><div><p className="eyebrow">Cancelamento solicitado hoje, 09:48</p><h2>Eveline · Treinamento In Company</h2></div>{status !== 'pending' && <span className={`approval-status ${status}`}>{status === 'approved' ? <><CheckCircle2 size={15}/> Aprovado</> : <><XCircle size={15}/> Rejeitado</>}</span>}</div><div className="approval-details"><div><span>Lançamento original</span><strong>2 inscrições</strong></div><div><span>Motivo</span><strong>Cliente desistiu antes da confirmação financeira.</strong></div></div>{status === 'pending' ? <><p className="approval-note">Aprovar criará uma reversão. O resultado ficará pendente até a próxima publicação do placar.</p><div className="approval-actions"><Button variant="outline" onClick={onReject}><XCircle size={16}/> Rejeitar</Button><Button className="primary-action" onClick={onApprove}><CheckCircle2 size={16}/> Aprovar cancelamento</Button></div></> : <div className={`approval-result ${status}`}><div>{status === 'approved' ? <CheckCircle2 size={21}/> : <XCircle size={21}/>}<p><strong>{status === 'approved' ? 'Cancelamento aprovado e reversão criada.' : 'Cancelamento rejeitado.'}</strong><span>{status === 'approved' ? 'As 2 inscrições foram retiradas da gestão e aguardam a próxima publicação.' : 'O lançamento original permanece ativo e o placar não foi alterado.'}</span></p></div>{status === 'approved' && <Button variant="outline" onClick={onGoToDashboard}>Ver alterações pendentes <ArrowUpRight size={16}/></Button>}</div>}</article></section>;
}

function RegistrationDialog({ open, onOpenChange, participant, setParticipant, product, setProduct, quantity, setQuantity, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; participant: string; setParticipant: (value: string) => void; product: string; setProduct: (value: string) => void; quantity: number; setQuantity: (value: number) => void; onSave: () => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="registration-dialog"><DialogHeader><DialogTitle>Registrar nova inscrição</DialogTitle><DialogDescription>O lançamento ficará pendente até a próxima publicação do placar.</DialogDescription></DialogHeader><div className="form-grid"><div className="field"><Label htmlFor="participant">Participante</Label><select id="participant" value={participant} onChange={(event) => setParticipant(event.target.value)}>{initialRanking.map((person) => <option key={person.name}>{person.name}</option>)}</select></div><div className="field"><Label htmlFor="product">Evento ou curso</Label><select id="product" value={product} onChange={(event) => setProduct(event.target.value)}><option>CONBROP</option><option>Formação em Licitações</option><option>Pregão Eletrônico</option><option>Treinamento In Company</option></select></div><div className="field"><Label htmlFor="quantity">Quantidade</Label><Input id="quantity" type="number" min={1} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} /></div><div className="field"><Label htmlFor="client">Órgão ou cliente</Label><Input id="client" placeholder="Opcional" /></div><div className="field full"><Label htmlFor="notes">Observação</Label><Input id="notes" placeholder="Informação complementar" /></div></div><div className="points-preview"><span>Pontuação calculada</span><strong>{quantity * 10} pontos</strong></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button className="primary-action" onClick={onSave}><Check size={17}/> Confirmar inscrição</Button></DialogFooter></DialogContent></Dialog>;
}

function PublicationDialog({ open, onOpenChange, pending, total, publishedTotal, changedPeople, onPublish }: { open: boolean; onOpenChange: (open: boolean) => void; pending: number; total: number; publishedTotal: number; changedPeople: Person[]; onPublish: () => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="publication-dialog"><DialogHeader><DialogTitle>Prévia da atualização</DialogTitle><DialogDescription>Confira como o placar ficará antes de liberar a nova versão para a TV.</DialogDescription></DialogHeader><div className="preview-summary"><div><span>Alterações pendentes</span><strong>{pending}</strong></div><div><span>Inscrições publicadas</span><strong>{publishedTotal}</strong></div><ArrowUpRight/><div><span>Novo total</span><strong>{total}</strong></div></div><div className="preview-list"><p className="eyebrow">Participantes afetadas</p>{changedPeople.length ? changedPeople.map((person) => <div key={person.name}><span className="avatar">{person.initials}</span><strong>{person.name}</strong><span>agora com {person.registrations} inscrições</span></div>) : <p>Nenhuma alteração individual nesta sessão; há registros fictícios pendentes na carga inicial.</p>}</div><div className="publication-warning"><RefreshCw size={18}/><p><strong>A versão atual será preservada no histórico.</strong><span>A TV só mudará depois da confirmação abaixo.</span></p></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}><ArrowLeft size={16}/> Cancelar e revisar</Button><Button className="primary-action" onClick={onPublish}><CheckCircle2 size={17}/> Confirmar atualização</Button></DialogFooter></DialogContent></Dialog>;
}

function Scoreboard({ ranking, total, version, lastPublished, onBack }: { ranking: Person[]; total: number; version: number; lastPublished: string; onBack: () => void }) {
  const podium = [ranking[1], ranking[0], ranking[2]];
  return <main className="scoreboard-shell min-h-screen text-white"><header className="scoreboard-header"><div className="scoreboard-title"><div className="score-logo-wrap"><img src="/capacity-logo.png" alt="Capacity" /></div><div><span className="score-brand">Placar comercial</span><h1>Gincana Rumo ao Topo</h1></div></div><div className="scoreboard-meta"><span>Critério: inscrições confirmadas</span><strong>18 dias restantes</strong><button onClick={onBack}>Voltar à gestão</button></div></header><section className="scoreboard-content"><div className="podium">{podium.map((person, index) => { const place = [2, 1, 3][index]; return <article className={`podium-card place-${place}`} key={person.name}><span className="podium-place">{place}º</span><span className="podium-avatar">{person.initials}</span><h2>{person.name}</h2><p>{person.team}</p><strong>{person.registrations}<small> inscrições</small></strong><Progress value={person.progress} /><span>{person.progress}% da meta</span></article>; })}</div><aside className="score-summary"><p>Juntas, já conquistamos</p><strong>{total}</strong><span>inscrições confirmadas</span><Progress value={(total / 120) * 100} /><small>{((total / 120) * 100).toFixed(1).replace('.', ',')}% da meta coletiva</small></aside></section><footer className="score-ticker"><span className="live-dot" /><strong>Última conquista</strong><p>{ranking[0].name} está na liderança com {ranking[0].registrations} inscrições</p><span>Versão {version} · {lastPublished}</span></footer></main>;
}
