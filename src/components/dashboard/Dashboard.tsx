import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Task, TaskStatus, User, TaskStatusLabels, UserRoleLabels, TaskRecurrence } from '../../types';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  TrendingUp, 
  Activity, 
  Calendar,
  Users,
  Search,
  Filter,
  X,
  ArrowRight,
  UserPlus,
  ChevronRight,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UserRole } from '../../types';
import { useAuth } from '../../App';
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Legend,
  CartesianGrid
} from 'recharts';

export default function Dashboard() {
  const { user: currentUser, effectiveRole } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | 'TOTAL' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    const unsubTasks = onSnapshot(query(collection(db, 'tasks')), (s) => 
      setTasks(s.docs.map(d => ({ id: d.id, ...d.data() } as Task))),
      (error) => handleFirestoreError(error, OperationType.GET, 'tasks')
    );
    
    let unsubUsers = () => {};
    if (effectiveRole === UserRole.ADMIN || effectiveRole === UserRole.MANAGER) {
      unsubUsers = onSnapshot(query(collection(db, 'users')), (s) => 
        setUsers(s.docs.map(d => ({ id: d.id, ...d.data() } as User))),
        (error) => handleFirestoreError(error, OperationType.GET, 'users')
      );
    } else if (currentUser) {
      // For standard users, just put themselves in the list if needed for UI consistency
      setUsers([currentUser]);
    }
    
    return () => { unsubTasks(); unsubUsers(); };
  }, [effectiveRole, currentUser]);

  const navigateDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const isSameDayTask = (t: Task, date: Date) => {
     // Data de início da tarefa
    const startDate = t.dueDate?.toDate() || t.createdAt?.toDate();
    if (!startDate) return false;

    // Comparação de datas ignorando o horário
    const startObj = new Date(startDate);
    startObj.setHours(0, 0, 0, 0);
    const selectedObj = new Date(date);
    selectedObj.setHours(0, 0, 0, 0);

    // Se não for recorrente, deve ser o mesmo dia
    if (!t.recurrence || t.recurrence === TaskRecurrence.NONE) {
      return startObj.getTime() === selectedObj.getTime();
    }

    // Lógica de Recorrência
    if (selectedObj < startObj) return false;
    if (t.recurrenceEndDate) {
      const endObj = t.recurrenceEndDate.toDate();
      endObj.setHours(0, 0, 0, 0);
      if (selectedObj > endObj) return false;
    }

    if (t.recurrence === TaskRecurrence.DAILY) return true;
    if (t.recurrence === TaskRecurrence.WEEKLY) return selectedObj.getDay() === startObj.getDay();
    if (t.recurrence === TaskRecurrence.MONTHLY) return selectedObj.getDate() === startObj.getDate();
    if (t.recurrence === TaskRecurrence.QUARTERLY) {
      const monthDiff = (selectedObj.getFullYear() - startObj.getFullYear()) * 12 + (selectedObj.getMonth() - startObj.getMonth());
      return monthDiff % 3 === 0 && selectedObj.getDate() === startObj.getDate();
    }
    if (t.recurrence === TaskRecurrence.SEMIANNUAL) {
      const monthDiff = (selectedObj.getFullYear() - startObj.getFullYear()) * 12 + (selectedObj.getMonth() - startObj.getMonth());
      return monthDiff % 6 === 0 && selectedObj.getDate() === startObj.getDate();
    }
    if (t.recurrence === TaskRecurrence.YEARLY) {
      return selectedObj.getMonth() === startObj.getMonth() && selectedObj.getDate() === startObj.getDate();
    }

    return false;
  };

  const tasksForDay = tasks.filter(t => isSameDayTask(t, selectedDate));

  const stats = [
    { label: 'Total de Tarefas', value: tasksForDay.length, icon: Activity, color: 'bg-indigo-600', status: 'TOTAL' as const },
    { label: 'Em Progresso', value: tasksForDay.filter(t => t.status === TaskStatus.IN_PROGRESS).length, icon: TrendingUp, color: 'bg-brand-600', status: TaskStatus.IN_PROGRESS },
    { label: 'Concluídas', value: tasksForDay.filter(t => t.status === TaskStatus.COMPLETED).length, icon: CheckCircle2, color: 'bg-emerald-500', status: TaskStatus.COMPLETED },
    { label: 'Atrasadas', value: tasksForDay.filter(t => t.status === TaskStatus.DELAYED).length, icon: AlertCircle, color: 'bg-rose-500', status: TaskStatus.DELAYED },
  ];

  // Chart Data
  const pieData = [
    { name: 'Pendente', value: tasksForDay.filter(t => t.status === TaskStatus.PENDING).length, color: '#94a3b8' },
    { name: 'Em Progresso', value: tasksForDay.filter(t => t.status === TaskStatus.IN_PROGRESS).length, color: '#3b82f6' },
    { name: 'Concluído', value: tasksForDay.filter(t => t.status === TaskStatus.COMPLETED).length, color: '#10b981' },
    { name: 'Atrasado', value: tasksForDay.filter(t => t.status === TaskStatus.DELAYED).length, color: '#f43f5e' },
  ].filter(d => d.value > 0);

  const userWorkloadData = users.map(u => {
    const userTasks = tasksForDay.filter(t => t.assignedTo?.includes(u.id));
    return {
      name: u.name.split(' ')[0],
      total: userTasks.length,
      completed: userTasks.filter(t => t.status === TaskStatus.COMPLETED).length
    };
  }).filter(d => d.total > 0).slice(0, 5);

  const filteredTasksForList = tasksForDay.filter(t => {
    const matchesStatus = !selectedStatus || selectedStatus === 'TOTAL' || t.status === selectedStatus;
    const matchesSearch = (t.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (t.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesUser = filterUser === 'all' || (t.assignedTo && t.assignedTo.includes(filterUser));
    return matchesStatus && matchesSearch && matchesUser;
  });

  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const handleUpdateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    setIsUpdatingStatus(true);
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const isAdminOrManager = effectiveRole === UserRole.ADMIN || effectiveRole === UserRole.MANAGER;

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Date Navigation Section */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-brand-600 p-3 sm:p-4 rounded-2xl text-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between gap-2 sm:gap-4 w-full md:w-auto">
          <button 
            onClick={() => navigateDate(-1)}
            className="p-1.5 sm:p-2 hover:bg-brand-700 rounded-xl transition-colors border border-brand-500 active:scale-95 shrink-0"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 rotate-180" />
          </button>
          <div className="text-center flex-1 min-w-0 px-2 lg:min-w-[200px]">
            <h2 className="text-[9px] sm:text-xs md:text-sm font-black uppercase tracking-widest truncate">{format(selectedDate, "EEEE", { locale: ptBR })}</h2>
            <p className="text-[8px] sm:text-[10px] font-bold text-brand-100 uppercase tracking-widest truncate">{format(selectedDate, "dd 'DE' MMMM, yyyy", { locale: ptBR })}</p>
          </div>
          <button 
            onClick={() => navigateDate(1)}
            className="p-1.5 sm:p-2 hover:bg-brand-700 rounded-xl transition-colors border border-brand-500 active:scale-95 shrink-0"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
        <button 
          onClick={() => setSelectedDate(new Date())}
          className="w-full md:w-auto text-xs font-black uppercase tracking-wider bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-all border border-white/20 active:scale-95"
        >
          Ir para Hoje
        </button>
      </div>

      {/* Quick Action Card for Invite */}
      {(effectiveRole === UserRole.ADMIN || effectiveRole === UserRole.MANAGER) && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-brand-600 rounded-3xl p-6 text-white shadow-xl shadow-brand-500/20 relative overflow-hidden group cursor-pointer"
          onClick={() => {
            // Since we can't easily trigger the modal state in UserManagement from here
            // without a global state, we'll just redirect to the team management view
            // and maybe add a hint.
            window.dispatchEvent(new CustomEvent('nav-to-users-invite'));
          }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32 group-hover:scale-110 transition-transform" />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-xl shadow-black/10 shrink-0">
                <UserPlus className="w-8 h-8" />
              </div>
              <div className="text-center md:text-left">
                <h3 className="text-xl font-black uppercase tracking-tight">Expandir a Equipe?</h3>
                <p className="text-brand-100 text-[10px] font-bold uppercase tracking-widest mt-1">Convidar novos membros via WhatsApp ou E-mail</p>
              </div>
            </div>
            <button 
              className="px-8 py-3 bg-white text-brand-600 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
            >
              Convidar Agora
            </button>
          </div>
        </motion.div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            onClick={() => setSelectedStatus(stat.status)}
            className={cn(
              "p-3 sm:p-4 rounded-2xl border-2 cursor-pointer transition-all relative overflow-hidden group",
              selectedStatus === stat.status 
                ? "border-brand-500 bg-brand-50 shadow-md ring-1 ring-brand-500/20" 
                : "bg-white border-slate-100 hover:border-slate-300 shadow-sm"
            )}
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={cn("w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-white shrink-0", stat.color)}>
                <stat.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{stat.label}</p>
                <div className="flex items-baseline gap-1 sm:gap-2">
                  <span className="text-lg sm:text-xl font-black text-slate-900">{stat.value}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Visual Data Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[320px] flex flex-col"
        >
          <div className="flex items-center gap-2 mb-6 text-slate-800">
            <PieChartIcon className="w-4 h-4 text-brand-600" />
            <h3 className="text-[10px] font-black uppercase tracking-widest">Distribuição de Status</h3>
          </div>
          <div className="flex-1">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value) => <span className="text-[9px] font-bold uppercase tracking-tighter text-slate-500">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-300 text-[10px] uppercase font-black tracking-widest">
                Sem dados para visualização
              </div>
            )}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[320px] flex flex-col"
        >
          <div className="flex items-center gap-2 mb-6 text-slate-800">
            <BarChartIcon className="w-4 h-4 text-brand-600" />
            <h3 className="text-[10px] font-black uppercase tracking-widest">Carga de Trabalho por Membro</h3>
          </div>
          <div className="flex-1">
            {userWorkloadData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={userWorkloadData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="total" name="Total" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed" name="Concluído" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-300 text-[10px] uppercase font-black tracking-widest">
                Sem dados para visualização
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="BUSCAR TAREFA NO PAINEL..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 sm:flex-none">
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="w-full appearance-none pl-10 pr-8 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest focus:outline-none cursor-pointer hover:bg-slate-100 transition-colors sm:min-w-[200px]"
            >
              <option value="all">TODOS COLABORADORES</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name.toUpperCase()}</option>
              ))}
            </select>
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selectedStatus && (
          <motion.div
            key="list-view"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Filter className="w-4 h-4 text-brand-600" />
                Tarefas: {selectedStatus === 'TOTAL' ? 'Todas' : TaskStatusLabels[selectedStatus as TaskStatus]}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {filteredTasksForList.length} RESULTADOS ENCONTRADOS
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTasksForList.length === 0 ? (
                <div className="col-span-full py-12 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhuma tarefa corresponde aos filtros</p>
                </div>
              ) : (
                filteredTasksForList.map(task => {
                  const isAssignedToMe = task.assignedTo?.includes(currentUser?.id || '');
                  const canUpdate = isAdminOrManager || isAssignedToMe;
                  const isSigned = !!task.signedBy;

                  return (
                    <motion.div
                      layout
                      key={task.id}
                      className={cn(
                        "bg-white p-4 rounded-xl border shadow-sm space-y-4 hover:shadow-md transition-shadow relative overflow-hidden",
                        isSigned ? "border-emerald-200 bg-emerald-50/10" : "border-slate-200"
                      )}
                    >
                      {isSigned && (
                        <div className="absolute top-0 right-0 px-2 py-0.5 bg-emerald-500 text-white text-[7px] font-black uppercase tracking-widest rounded-bl-lg">
                          ASSINADA
                        </div>
                      )}
                      
                      <div className="flex justify-between gap-2">
                        <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-tight line-clamp-2">{task.title}</h4>
                        <div className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          task.status === TaskStatus.COMPLETED ? "bg-emerald-500" :
                          task.status === TaskStatus.DELAYED ? "bg-rose-500" : "bg-amber-500"
                        )} />
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase">
                          <Clock className="w-3 h-3" />
                          {task.updatedAt ? format(task.updatedAt.toDate(), 'dd/MM HH:mm', { locale: ptBR }) : '--/--'}
                        </div>

                        {canUpdate && (
                          <div className="pt-3 border-t border-slate-50 flex items-center justify-between gap-2">
                            {isSigned ? (
                              <div className="flex-1 flex items-center gap-2 text-emerald-600 bg-emerald-50 px-2 py-1.5 rounded-lg border border-emerald-100">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span className="text-[8px] font-black uppercase tracking-widest">Entrega Confirmada</span>
                              </div>
                            ) : (
                              <button
                                disabled={isUpdatingStatus}
                                onClick={async () => {
                                  if (!currentUser) return;
                                  setIsUpdatingStatus(true);
                                  try {
                                    await updateDoc(doc(db, 'tasks', task.id), {
                                      status: TaskStatus.COMPLETED,
                                      signedBy: currentUser.id,
                                      signedAt: serverTimestamp(),
                                      updatedAt: serverTimestamp()
                                    });
                                  } catch (e) {
                                    handleFirestoreError(e, OperationType.UPDATE, `tasks/${task.id}`);
                                  } finally {
                                    setIsUpdatingStatus(false);
                                  }
                                }}
                                className="flex-1 bg-brand-600 text-white hover:bg-brand-700 rounded-lg py-1.5 px-3 text-[9px] font-black uppercase tracking-widest outline-none shadow-sm shadow-brand-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                              >
                                {isUpdatingStatus ? (
                                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                )}
                                Assinar Entrega
                              </button>
                            )}
                            
                            <select
                              disabled={isUpdatingStatus || isSigned}
                              value={task.status}
                              onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value as TaskStatus)}
                              className="w-20 bg-slate-50 border border-slate-100 rounded-lg py-1.5 px-1 text-[8px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50"
                            >
                              {Object.values(TaskStatus).map(s => (
                                <option key={s} value={s}>{TaskStatusLabels[s]}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {!canUpdate && (
                          <div className="pt-2 text-[8px] font-black text-slate-300 uppercase tracking-widest text-center italic">
                            Apenas Leitura
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detailed Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Auditoria de Produção</h3>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter mt-1">Dados relativos ao período corrente</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="py-3 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ativo</th>
                <th className="py-3 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nível Entrega</th>
                <th className="py-3 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Volume</th>
                <th className="py-3 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.slice(0, 3).map(u => {
                const userTasks = tasksForDay.filter(t => t.assignedTo && Array.isArray(t.assignedTo) && t.assignedTo.includes(u.id));
                const completedCount = userTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
                const totalCount = userTasks.length;
                const deliveryRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

                return (
                  <tr key={u.name} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-sm bg-brand-600 text-white flex items-center justify-center font-bold text-[10px]">
                          {u.name.charAt(0)}
                        </div>
                        <span className="text-xs font-bold text-slate-700">{u.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-brand-600" 
                            style={{ width: `${deliveryRate}%` }}
                          ></div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500">
                          {deliveryRate}%
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-xs font-bold text-slate-600">{completedCount} / {totalCount}</span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded uppercase tracking-tighter">
                        Otimizado
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
