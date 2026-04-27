import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Filter, 
  Calendar, 
  Users as UsersIcon, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon,
  Search,
  ChevronDown,
  Printer,
  FileDown,
  Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Task, User, TaskStatus, UserStatus, TaskPriority, TaskStatusLabels } from '../../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Reports() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Filters
  const [dateRange] = useState<'custom'>('custom');
  const [startDate, setStartDate] = useState<string>(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Generated State
  const [generatedTasks, setGeneratedTasks] = useState<Task[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);

  useEffect(() => {
    const unsubTasks = onSnapshot(query(collection(db, 'tasks'), orderBy('createdAt', 'desc')), (s) => {
      setTasks(s.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
      setLoading(false);
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (s) => {
      setUsers(s.docs.map(d => ({ id: d.id, ...d.data() } as User)));
    });

    return () => {
      unsubTasks();
      unsubUsers();
    };
  }, []);

  const handleGenerateReport = () => {
    setIsGenerating(true);
    
    // Simular processamento para dar feedback visual
    setTimeout(() => {
      const filtered = tasks.filter(task => {
        if (!task.createdAt) return false;
        const taskDate = task.createdAt.toDate();
        
        const start = startOfDay(new Date(startDate + 'T00:00:00'));
        const end = endOfDay(new Date(endDate + 'T23:59:59'));
        const dateMatch = isWithinInterval(taskDate, { start, end });

        const userMatch = selectedUser === 'all' || task.assignedTo?.includes(selectedUser);
        const statusMatch = selectedStatus === 'all' || task.status === selectedStatus;

        return dateMatch && userMatch && statusMatch;
      });

      setGeneratedTasks(filtered);
      setHasGenerated(true);
      setIsGenerating(false);
    }, 800);
  };

  // Data helpers based on generated tasks
  const statusData = [
    { name: 'Pendente', value: generatedTasks.filter(t => t.status === TaskStatus.PENDING).length, color: '#94a3b8' },
    { name: 'Em Progresso', value: generatedTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length, color: '#3b82f6' },
    { name: 'Concluído', value: generatedTasks.filter(t => t.status === TaskStatus.COMPLETED).length, color: '#10b981' },
    { name: 'Atrasado', value: generatedTasks.filter(t => t.status === TaskStatus.DELAYED).length, color: '#f43f5e' },
  ].filter(d => d.value > 0);

  const teamPerformance = users.map(u => {
    const userTasks = generatedTasks.filter(t => t.assignedTo?.includes(u.id));
    return {
      name: u.name,
      shortName: u.name.split(' ')[0],
      total: userTasks.length,
      completed: userTasks.filter(t => t.status === TaskStatus.COMPLETED).length,
      rate: userTasks.length > 0 ? (userTasks.filter(t => t.status === TaskStatus.COMPLETED).length / userTasks.length * 100).toFixed(0) : 0
    };
  }).filter(d => d.total > 0).sort((a, b) => b.total - a.total).slice(0, 8);

  const handlePrint = () => {
    if (!hasGenerated) return;
    window.print();
  };

  const handleExportCSV = () => {
    if (!hasGenerated || generatedTasks.length === 0) return;

    const headers = ['Titulo', 'Descricao', 'Prioridade', 'Status', 'Responsaveis', 'Criado Em'];
    const csvRows = [
      headers.join(','),
      ...generatedTasks.map(t => {
        const owners = t.assignedTo?.map(uid => users.find(u => u.id === uid)?.name || uid).join('; ') || '';
        const date = t.createdAt ? format(t.createdAt.toDate(), 'dd/MM/yyyy HH:mm') : '';
        return [
          `"${t.title.replace(/"/g, '""')}"`,
          `"${(t.description || '').replace(/"/g, '""')}"`,
          t.priority,
          t.status,
          `"${owners}"`,
          date
        ].join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_${format(new Date(), 'dd_MM_yyyy')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (!hasGenerated || generatedTasks.length === 0) return;

    const doc = new jsPDF();
    
    // Add logo/title
    doc.setFontSize(20);
    doc.text('Relatório de Operações', 14, 22);
    
    doc.setFontSize(10);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);
    doc.text(`Período: ${startDate} até ${endDate}`, 14, 35);
    doc.text(`Total de registros: ${generatedTasks.length}`, 14, 40);

    // Filter summary
    doc.setFontSize(12);
    doc.text('Resumo por Status:', 14, 52);
    let yPos = 60;
    statusData.forEach(d => {
      doc.setFontSize(10);
      doc.text(`${d.name}: ${d.value}`, 20, yPos);
      yPos += 7;
    });

    // Main tasks table
    const tableData = generatedTasks.map(t => [
      t.title,
      TaskStatusLabels[t.status],
      t.assignedTo?.map(uid => users.find(u => u.id === uid)?.name || uid).join(', '),
      t.createdAt ? format(t.createdAt.toDate(), 'dd/MM/yyyy HH:mm') : 'N/A'
    ]);

    autoTable(doc, {
      startY: yPos + 10,
      head: [['Título', 'Status', 'Responsáveis', 'Criação']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: 255 },
      styles: { fontSize: 8 }
    });

    doc.save(`relatorio_${format(new Date(), 'dd_MM_yyyy')}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-12 print:p-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden px-1 sm:px-0">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-brand-600" />
            Relatórios Estratégicos
          </h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Análise detalhada de performance e produtividade</p>
        </div>
        
        {hasGenerated && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2"
          >
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </button>
            <button 
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/20 active:scale-95"
            >
              <FileDown className="w-3.5 h-3.5" />
              PDF
            </button>
            <button 
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20 active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          </motion.div>
        )}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-4 print:hidden">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data Inicial</label>
            <div className="relative">
              <input 
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl text-[11px] font-bold text-slate-700 focus:ring-2 focus:ring-brand-500 transition-all uppercase"
              />
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data Final</label>
            <div className="relative">
              <input 
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl text-[11px] font-bold text-slate-700 focus:ring-2 focus:ring-brand-500 transition-all uppercase"
              />
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Colaborador</label>
            <div className="relative">
              <select 
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl text-[11px] font-bold text-slate-700 focus:ring-2 focus:ring-brand-500 transition-all appearance-none uppercase"
              >
                <option value="all">Todos os Membros</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.status === UserStatus.DELETED ? '(Inativo)' : ''}
                  </option>
                ))}
              </select>
              <UsersIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
            <div className="relative">
              <select 
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl text-[11px] font-bold text-slate-700 focus:ring-2 focus:ring-brand-500 transition-all appearance-none uppercase"
              >
                <option value="all">Todos os Status</option>
                {Object.entries(TaskStatusLabels).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <button 
            onClick={handleGenerateReport}
            disabled={isGenerating}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all",
              isGenerating 
                ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                : "bg-slate-900 text-white hover:bg-black shadow-lg active:scale-95"
            )}
          >
            {isGenerating ? (
              <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            {isGenerating ? 'Processando...' : 'Gerar Relatório'}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!hasGenerated ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-24 bg-white rounded-[40px] border border-slate-100 shadow-sm text-center px-6"
          >
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
              <BarChart3 className="w-10 h-10 text-slate-200" />
            </div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Nenhum relatório gerado</h3>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2 max-w-sm leading-relaxed">
              Utilize os filtros acima para configurar os parâmetros e clique em <span className="text-slate-900">Gerar Relatório</span> para visualizar os dados estrategicamente.
            </p>
          </motion.div>
        ) : (
          <motion.div 
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {[
                { label: 'Volume de Tarefas', value: generatedTasks.length, icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                { label: 'Taxa de Entrega', value: `${((generatedTasks.filter(t => t.status === TaskStatus.COMPLETED).length / (generatedTasks.length || 1)) * 100).toFixed(0)}%`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Tarefas Atrasadas', value: generatedTasks.filter(t => t.status === TaskStatus.DELAYED).length, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
                { label: 'Urgentes', value: generatedTasks.filter(t => t.priority === TaskPriority.HIGH).length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
              ].map((kpi, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-white p-3 sm:p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center text-center group"
                >
                  <div className={cn("w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center mb-3 sm:mb-4 transition-transform group-hover:scale-110", kpi.bg)}>
                    <kpi.icon className={cn("w-5 h-5 sm:w-6 sm:h-6", kpi.color)} />
                  </div>
                  <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{kpi.label}</p>
                  <p className="text-lg sm:text-2xl font-black text-slate-900 leading-none">{kpi.value}</p>
                </motion.div>
              ))}
            </div>

            {/* Main Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Status Distribution */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col h-[400px]"
              >
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center text-brand-600">
                      <PieChartIcon className="w-5 h-5" />
                    </div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Distribuição por Status</h3>
                  </div>
                </div>
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        innerRadius={80}
                        outerRadius={100}
                        paddingAngle={8}
                        dataKey="value"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '10px', textTransform: 'uppercase', fontWeight: 900 }}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36}
                        formatter={(value) => <span className="text-[10px] font-black uppercase tracking-tighter text-slate-500">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              {/* Team Performance */}
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col h-[400px]"
              >
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Performance do Time (Top 8)</h3>
                  </div>
                </div>
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={teamPerformance} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" hide />
                      <YAxis 
                        dataKey="shortName" 
                        type="category" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} 
                      />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '10px', textTransform: 'uppercase', fontWeight: 900 }}
                      />
                      <Bar dataKey="total" name="Total de Tarefas" fill="#e2e8f0" radius={[0, 8, 8, 0]} barSize={20} />
                      <Bar dataKey="completed" name="Tarefas Concluídas" fill="#10b981" radius={[0, 8, 8, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            </div>

            {/* Task List Tables */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
            >
              <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Detalhamento das Operações</h3>
                <span className="px-3 py-1 bg-brand-100 text-brand-700 text-[9px] font-black rounded-full uppercase tracking-widest">
                  {generatedTasks.length} Registros encontrados
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/30">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tarefa</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsáveis</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Prioridade</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Criada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {generatedTasks.slice(0, 50).map(task => (
                      <tr key={task.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4">
                          <p className="text-xs font-bold text-slate-900 group-hover:text-brand-600 transition-colors uppercase">{task.title}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex -space-x-2">
                            {task.assignedTo?.map(uid => (
                              <div key={uid} className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-black text-slate-600 overflow-hidden" title={users.find(u => u.id === uid)?.name}>
                                {users.find(u => u.id === uid)?.profilePic ? (
                                  <img src={users.find(u => u.id === uid)?.profilePic} alt="" />
                                ) : (
                                  users.find(u => u.id === uid)?.name.charAt(0)
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "text-[8px] font-black px-2 py-0.5 rounded-full border uppercase tracking-widest",
                            task.priority === TaskPriority.HIGH ? "bg-rose-50 text-rose-600 border-rose-100" :
                            task.priority === TaskPriority.MEDIUM ? "bg-amber-50 text-amber-600 border-amber-100" :
                            "bg-slate-50 text-slate-500 border-slate-100"
                          )}>
                            {task.priority}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className={cn(
                            "inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                            task.status === TaskStatus.COMPLETED ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                            task.status === TaskStatus.IN_PROGRESS ? "bg-blue-50 text-blue-600 border-blue-100" :
                            task.status === TaskStatus.DELAYED ? "bg-rose-50 text-rose-600 border-rose-100" :
                            "bg-slate-50 text-slate-500 border-slate-100"
                          )}>
                            {TaskStatusLabels[task.status]}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                            {task.createdAt ? format(task.createdAt.toDate(), 'dd/MM/yyyy HH:mm') : 'N/A'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {generatedTasks.length > 50 && (
                  <div className="p-4 text-center border-t border-slate-50">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Mostrando apenas os 50 primeiros registros. Exportar para ver lista completa.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

