import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { User, UserRole } from '../../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Shield, Search, Filter, Clock, User as UserIcon, Activity, ExternalLink, ShieldCheck, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  details: string;
  createdAt: any;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [team, setTeam] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState<string>('ALL');

  useEffect(() => {
    // Fetch users for mapping
    const qUsers = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(qUsers, (s) => 
      setTeam(s.docs.map(d => ({ id: d.id, ...d.data() } as User))),
      (error) => handleFirestoreError(error, OperationType.GET, 'users')
    );

    // Fetch logs
    const qLogs = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(100));
    const unsubLogs = onSnapshot(qLogs, (s) => 
      setLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog))),
      (error) => handleFirestoreError(error, OperationType.GET, 'auditLogs')
    );

    return () => { unsubUsers(); unsubLogs(); };
  }, []);

  const getActionColor = (action: string) => {
    if (action.includes('CALL')) return 'text-blue-600 bg-blue-50 border-blue-100';
    if (action.includes('CREATE')) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    if (action.includes('DELETE')) return 'text-rose-600 bg-rose-50 border-rose-100';
    if (action.includes('LOGIN')) return 'text-amber-600 bg-amber-50 border-amber-100';
    return 'text-slate-600 bg-slate-50 border-slate-100';
  };

  const filteredLogs = logs.filter(log => {
    const user = team.find(u => u.id === log.userId);
    const matchesSearch = 
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user?.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filterAction === 'ALL' || log.action.includes(filterAction);
    
    return matchesSearch && matchesFilter;
  });

  const exportLogs = () => {
    const csvContent = filteredLogs.map(log => {
      const user = team.find(u => u.id === log.userId);
      const date = log.createdAt?.toDate ? format(log.createdAt.toDate(), 'dd/MM/yyyy HH:mm:ss') : '';
      return `${date} | ${user?.name || 'Sistema'} | ${log.action} | ${log.details}`;
    }).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `audit_logs_${format(new Date(), 'yyyyMMdd_HHmm')}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 font-sans px-1 sm:px-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-slate-900 rounded-lg text-white shadow-xl">
              <Shield className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Registros de Auditoria</h2>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Monitoramento de conformidade e segurança em tempo real</p>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={exportLogs}
            className="flex items-center gap-3 px-6 py-3 bg-white border-2 border-slate-900 text-slate-900 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-900 hover:text-white transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            Exportar Protocolos
          </button>
          
          <div className="bg-emerald-50 border border-emerald-100 px-6 py-3 rounded-2xl flex items-center gap-4">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Protocolo de Segurança</p>
              <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-tighter">Sincronização Ativa • 256-bit Encrypted</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Filters Sidebar */}
        <div className="md:col-span-3 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Filtrar Atividade</h3>
            
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Buscar..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-[10px] font-black uppercase tracking-widest focus:ring-2 focus:ring-slate-200 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                {['ALL', 'CALL', 'CREATE', 'LOGIN', 'DELETE', 'UPDATE'].map((act) => (
                  <button
                    key={act}
                    onClick={() => setFilterAction(act)}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      filterAction === act ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:bg-slate-100"
                    )}
                  >
                    {act === 'ALL' ? 'Todas as Ações' : act}
                    {filterAction === act && <Activity className="w-3 h-3" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-3xl p-6 text-white overflow-hidden relative group">
            <div className="relative z-10">
              <Clock className="w-8 h-8 text-amber-400 mb-4" />
              <h4 className="text-xs font-black uppercase tracking-widest leading-relaxed">Retenção de Dados</h4>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">730 dias de histórico armazenados de forma imutável.</p>
            </div>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:scale-150 transition-transform" />
          </div>
        </div>

        {/* Logs Table */}
        <div className="md:col-span-9 bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden min-h-[600px]">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Data/Hora</th>
                  <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Operador</th>
                  <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ação</th>
                  <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Detalhamento Técnico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <AnimatePresence mode="popLayout">
                  {filteredLogs.map((log) => {
                    const user = team.find(u => u.id === log.userId);
                    return (
                      <motion.tr 
                        key={log.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-slate-300" />
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">
                              {log.createdAt?.toDate ? format(log.createdAt.toDate(), 'dd/MM/yy • HH:mm:ss') : 'Processando...'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-[10px] text-slate-500 border border-slate-200">
                              {user?.profilePic ? <img src={user.profilePic} className="w-full h-full object-cover rounded-lg" /> : <UserIcon className="w-4 h-4" />}
                            </div>
                            <div>
                              <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{user?.name || 'Sistema'}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{user?.role || 'SYSTEM'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                            getActionColor(log.action)
                          )}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-start justify-between gap-4">
                            <p className="text-[11px] font-medium text-slate-500 leading-relaxed max-w-md italic">
                              {log.details}
                            </p>
                            <button className="p-1 px-2 bg-slate-100 rounded text-[8px] font-black text-slate-400 opacity-0 group-hover:opacity-100 transition-all uppercase tracking-widest">
                              ID: {log.id.substring(0,6)}
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <Activity className="w-12 h-12 text-slate-100" />
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Nenhum registro localizado no servidor</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
