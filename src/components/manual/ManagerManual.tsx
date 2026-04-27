import React from 'react';
import { motion } from 'motion/react';
import { 
  BookOpen, 
  ChevronRight, 
  LayoutDashboard, 
  Users, 
  CheckSquare, 
  MessageSquare, 
  Settings, 
  FileText,
  ShieldCheck,
  Target,
  Zap,
  HelpCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';

export default function ManagerManual() {
  const sections = [
    {
      id: 'purpose',
      title: 'Propósito do Sistema',
      icon: Target,
      content: 'O Sweet Ice PRO foi desenvolvido para ser o centro estratégico da sua operação. Ele elimina falhas de comunicação e centraliza o fluxo de trabalho em tempo real. Como gestor, você detém autoridade quase total sobre as operações, exceto pelas configurações de desenvolvimento de alto nível. Os colaboradores, por outro lado, possuem acesso restrito e visualizam apenas o que for expressamente concedido por você ou pelo Administrador.'
    },
    {
      id: 'dashboard',
      title: 'Painel de Controle (Dashboard)',
      icon: LayoutDashboard,
      steps: [
        'Métricas em Tempo Real: No topo, acompanhe o volume de tarefas e o desempenho global.',
        'Filtros Inteligentes: Clique nos cards de status (ex: Pendente, Em Progresso) para filtrar a lista instantaneamente.',
        'Identificação de Gargalos: Use os contadores para ver onde as tarefas estão acumuladas.',
        'Atalho de Cadastro: Utilize o botão "Nova Tarefa" para alimentar o sistema rapidamente.'
      ]
    },
    {
      id: 'team',
      title: 'Convites e Gestão de Equipe',
      icon: Users,
      steps: [
        'Convite Estruturado: Acesse "Gestão de Equipe" e use a função de convite para registrar o e-mail do colaborador.',
        'Atribuição Antecipada: Defina o cargo (Gerente ou Colaborador) no ato do convite para que o acesso seja liberado automaticamente após o cadastro.',
        'Instruções Automáticas: Copie o link de convite que já contém todas as instruções necessárias em Português para o novo usuário.',
        'Controle de Acesso: Somente o Administrador (Wagner) pode promover outros usuários a Administrador. Gerentes podem gerir colaboradores e outros gerentes.'
      ]
    },
    {
      id: 'invitations',
      title: 'Convites e Acesso Seguro',
      icon: ShieldCheck,
      steps: [
        'Escolha de Método: Ao convidar, opte por E-mail (Google) ou Telefone (WhatsApp).',
        'Vínculo de Identidade: O sistema gera um link único que só funciona para o identificador (e-mail ou celular) que você cadastrou.',
        'Prevenção de Invasão: Se o link for compartilhado com terceiros, o acesso será negado pois não haverá correspondência de credenciais.',
        'Cadastro Simplificado: Ao clicar no link seguro, o novo usuário é direcionado para a autenticação correspondente e já entra com cargo pré-definido.',
        'Observação Técnica: Para que o login por telefone funcione, o provedor "Telefone" deve estar ativado no Console do Firebase (consulte o Administrador se necessário).'
      ]
    },
    {
      id: 'hierarchy',
      title: 'Hierarquia e Autoridade',
      icon: Users,
      steps: [
        'Gerente (Sua Função): Possui controle operacional quase total, visualização de todas as tarefas e gestão integral da equipe.',
        'Colaboradores: Possuem visão restrita. Eles só acessam o chat e as tarefas que você (ou o Admin) delegar expressamente.',
        'Administrador (Wagner): Responsável técnico por logs de segurança, auditoria e configurações de desenvolvimento.',
        'Concessão de Acesso: Como gerente, você é o filtro principal de quem entra e qual nível de informação cada um recebe.'
      ]
    },
    {
      id: 'tasks',
      title: 'Fluxo de Trabalho e Prazos',
      icon: CheckSquare,
      steps: [
        'Clareza no Escopo: Ao atribuir tarefas, descreva detalhadamente a entrega esperada.',
        'Gestão de Prazos: O campo "Deadline" é vital para o sistema calcular alertas de prioridade.',
        'Monitoramento: Acompanhe o progresso através do campo "Status" e garanta que o fluxo não pare.',
        'Histórico da Tarefa: Veja quem criou e quem alterou cada tarefa para manter a prestação de contas.'
      ]
    },
    {
      id: 'sync',
      title: 'Atualizações e Sincronização',
      icon: Zap,
      steps: [
        'Atualização Automática: Todas as melhorias e novos recursos são aplicados automaticamente. Os usuários sempre acessam a versão mais recente ao abrir o App.',
        'Dados em Nuvem: Toda informação é salva em tempo real, garantindo que a equipe móvel e de escritório veja exatamente o mesmo dado.',
        'Colaboração Viva: O chat e as tarefas refletem mudanças instantaneamente para todos os envolvidos.'
      ]
    },
    {
      id: 'settings',
      title: 'Ajustes e Personalização',
      icon: Settings,
      steps: [
        'Identidade Visual: Gerentes podem ajustar cores e fontes para manter o sistema com a cara da Sweet Ice PRO.',
        'Organização de Menu: Ajuste a ordem das ferramentas laterais conforme a necessidade da operação.',
        'Dados Corporativos: Mantenha as informações da empresa sempre atualizadas no painel de ajustes.'
      ]
    }
  ];

  const scrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-12 px-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-16 text-center"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-500/10 rounded-2xl mb-6">
          <BookOpen className="w-8 h-8 text-brand-600" />
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight uppercase mb-4">
          Manual Operacional do Gestor
        </h1>
        <p className="text-slate-100 max-w-2xl mx-auto text-sm leading-relaxed font-medium">
          Este guia contém as diretrizes e procedimentos passo a passo para a utilização plena das ferramentas de gestão. 
          Dominar estas funções é fundamental para garantir a eficiência operacional da sua equipe.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Sidebar Index */}
        <div className="lg:col-span-4 lg:sticky lg:top-24 h-fit">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-8 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Índice do Gestor</h3>
            <nav className="space-y-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => scrollTo(section.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:text-brand-600 transition-all group text-left"
                >
                  <section.icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                  <span className="text-xs font-bold uppercase tracking-wider">{section.title}</span>
                  <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
                </button>
              ))}
            </nav>

            <div className="mt-8 pt-8 border-t border-slate-50 dark:border-slate-700">
              <div className="bg-brand-50 dark:bg-brand-500/5 p-6 rounded-2xl border border-brand-100 dark:border-brand-500/20">
                <div className="flex items-center gap-2 text-brand-700 dark:text-brand-400 mb-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Nível de Acesso</span>
                </div>
                <p className="text-[11px] text-brand-600/80 dark:text-brand-400/80 leading-relaxed font-medium capitalize">
                  Administrador / Gerente
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-8 space-y-16">
          {sections.map((section, idx) => (
            <motion.section
              key={section.id}
              id={section.id}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="scroll-mt-24"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-brand-50 dark:bg-brand-500/10 rounded-xl flex items-center justify-center text-brand-600 dark:text-brand-400 shadow-sm border border-brand-100 dark:border-brand-500/20">
                  <section.icon className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight uppercase">{section.title}</h2>
              </div>

              {section.content && (
                <div className="bg-white/10 rounded-3xl p-8 border border-white/10 backdrop-blur-sm">
                  <p className="text-sm text-slate-100 leading-8 font-medium">
                    {section.content}
                  </p>
                </div>
              )}

              {section.steps && (
                <div className="space-y-6">
                  {section.steps.map((step, stepIdx) => (
                    <div 
                      key={stepIdx}
                      className="flex gap-6 group"
                    >
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-white/20 border-2 border-white/20 flex items-center justify-center text-[10px] font-black text-white group-hover:border-brand-300 group-hover:bg-brand-500 transition-all shrink-0">
                          {stepIdx + 1}
                        </div>
                        {stepIdx !== section.steps!.length - 1 && (
                          <div className="w-px flex-1 bg-white/10 group-hover:bg-brand-300 transition-colors my-2" />
                        )}
                      </div>
                      <div className="pb-4">
                        <p className="text-sm text-slate-100 leading-relaxed font-medium py-1">
                          {step}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.section>
          ))}

          {/* Footer Info */}
          <div className="pt-12 border-t border-slate-100">
            <div className="bg-slate-900 rounded-[32px] p-10 text-white relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <HelpCircle className="w-6 h-6 text-brand-400" />
                  <h4 className="text-lg font-bold uppercase tracking-widest">Suporte Adicional</h4>
                </div>
                <p className="text-slate-400 text-sm leading-relaxed mb-8 font-medium">
                  Se você encontrar alguma instabilidade ou tiver sugestões de novas funcionalidades para o fluxo de trabalho, entre em contato via canal #suporter-interno.
                </p>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-brand-400" />
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Tempo de Resposta: &lt; 2h</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-brand-400" />
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">SSL 256-bit Ativo</span>
                  </div>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
