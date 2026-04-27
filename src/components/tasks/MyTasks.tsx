import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp, orderBy, getDocs, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { 
  Task, 
  TaskStatus, 
  TaskPriority, 
  TaskStatusLabels, 
  TaskRecurrence, 
  Chat,
  TaskPriorityLabels
} from '../../types';
import { useAuth } from '../../App';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Calendar, 
  MessageSquare, 
  Save, 
  Search,
  Filter,
  MoreVertical,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getDayInfo, DayInfo } from '../../services/holidays';

interface MyTasksProps {
  onNavigateToChat?: (chatId: string) => void;
}

export default function MyTasks({ onNavigateToChat }: MyTasksProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL'>('ALL');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dayInfo, setDayInfo] = useState<DayInfo | null>(null);
  
  // Edit State
  const [justification, setJustification] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchDayInfo = async () => {
      setDayInfo(null);
      const info = await getDayInfo(selectedDate);
      if (isMounted) setDayInfo(info);
    };
    fetchDayInfo();
    return () => { isMounted = false; };
  }, [selectedDate]);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    // Query tasks assigned to the user
    const q = query(
      collection(db, 'tasks'),
      where('assignedTo', 'array-contains', user.id)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const tasksData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Task));
      // Sort in memory by updatedAt or createdAt desc
      tasksData.sort((a, b) => {
        const dateA = a.updatedAt?.seconds || a.createdAt?.seconds || 0;
        const dateB = b.updatedAt?.seconds || b.createdAt?.seconds || 0;
        return dateB - dateA;
      });
      setTasks(tasksData);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'tasks'));

    return () => { unsub(); };
  }, [user]);

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  useEffect(() => {
    if (selectedTask) {
      setJustification(selectedTask.justification || '');
    }
  }, [selectedTaskId, selectedTask]);

  const handleUpdateStatus = async (status: TaskStatus) => {
    if (!selectedTaskId || !user) return;
    setIsSaving(true);
    try {
      const updateData: any = {
        status,
        justification,
        updatedAt: serverTimestamp()
      };

      if (status === TaskStatus.COMPLETED) {
        updateData.signedBy = user.id;
        updateData.signedAt = serverTimestamp();
      }

      await updateDoc(doc(db, 'tasks', selectedTaskId), updateData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${selectedTaskId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveJustification = async () => {
    if (!selectedTaskId) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'tasks', selectedTaskId), {
        justification,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${selectedTaskId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const cycleStatus = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    const statuses = Object.values(TaskStatus);
    const currentIndex = statuses.indexOf(task.status);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
    
    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        status: nextStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  const handleChatWithAssignees = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !onNavigateToChat) return;
    
    const members = Array.from(new Set([...(task.assignedTo || []), user.id]));
    
    if (members.length < 2) {
      alert("Atribua pelo menos um colaborador para iniciar um chat.");
      return;
    }

    try {
      const q = query(
        collection(db, 'chats'),
        where('members', 'array-contains', user.id)
      );
      
      const querySnapshot = await getDocs(q);
      const existingChat = querySnapshot.docs.find(doc => {
        const data = doc.data() as Chat;
        if (members.length !== data.members.length) return false;
        return members.every(m => data.members.includes(m));
      });

      if (existingChat) {
        onNavigateToChat(existingChat.id);
      } else {
        const chatType = members.length === 2 ? 'DIRECT' : 'GROUP';
        const newChat: Partial<Chat> = {
          type: chatType,
          members: members,
          createdAt: serverTimestamp(),
          name: chatType === 'GROUP' ? `Tarefa: ${task.title}` : undefined,
          lastMessage: {
            content: `Chat iniciado para a tarefa: ${task.title}`,
            senderId: 'system',
            createdAt: serverTimestamp()
          }
        };
        const docRef = await addDoc(collection(db, 'chats'), newChat);
        onNavigateToChat(docRef.id);
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'chats');
    }
  };

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) || 
                          t.description.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    
    // Data de início da tarefa
    const startDate = t.dueDate?.toDate() || t.createdAt?.toDate();
    if (!startDate) return false;

    // Comparação de datas ignorando o horário
    const startObj = new Date(startDate);
    startObj.setHours(0, 0, 0, 0);
    const selectedObj = new Date(selectedDate);
    selectedObj.setHours(0, 0, 0, 0);

    // Se não for recorrente, deve ser o mesmo dia
    if (!t.recurrence || t.recurrence === TaskRecurrence.NONE) {
      const isSameDay = startObj.getTime() === selectedObj.getTime();
      return matchesSearch && matchesStatus && isSameDay;
    }

    // Lógica de Recorrência
    // A tarefa deve ter começado
    if (selectedObj < startObj) return false;

    // A tarefa não deve ter terminado (se houver data de fim)
    if (t.recurrenceEndDate) {
      const endObj = t.recurrenceEndDate.toDate();
      endObj.setHours(0, 0, 0, 0);
      if (selectedObj > endObj) return false;
    }

    let isMatch = false;
    if (t.recurrence === TaskRecurrence.DAILY) {
      isMatch = true;
    } else if (t.recurrence === TaskRecurrence.WEEKLY) {
      isMatch = selectedObj.getDay() === startObj.getDay();
    } else if (t.recurrence === TaskRecurrence.MONTHLY) {
      isMatch = selectedObj.getDate() === startObj.getDate();
    } else if (t.recurrence === TaskRecurrence.QUARTERLY) {
      const monthDiff = (selectedObj.getFullYear() - startObj.getFullYear()) * 12 + (selectedObj.getMonth() - startObj.getMonth());
      isMatch = monthDiff % 3 === 0 && selectedObj.getDate() === startObj.getDate();
    } else if (t.recurrence === TaskRecurrence.SEMIANNUAL) {
      const monthDiff = (selectedObj.getFullYear() - startObj.getFullYear()) * 12 + (selectedObj.getMonth() - startObj.getMonth());
      isMatch = monthDiff % 6 === 0 && selectedObj.getDate() === startObj.getDate();
    } else if (t.recurrence === TaskRecurrence.YEARLY) {
      isMatch = selectedObj.getMonth() === startObj.getMonth() && selectedObj.getDate() === startObj.getDate();
    }

    return matchesSearch && matchesStatus && isMatch;
  });

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.COMPLETED: return 'bg-green-100 text-green-700 border-green-200';
      case TaskStatus.IN_PROGRESS: return 'bg-brand-100 text-brand-700 border-brand-200';
      case TaskStatus.DELAYED: return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.HIGH: return 'text-red-500';
      case TaskPriority.MEDIUM: return 'text-amber-500';
      default: return 'text-blue-500';
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Date Navigation Section (Similar to Dashboard) */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-brand-600 p-3 sm:p-4 rounded-2xl text-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between gap-2 sm:gap-4 w-full md:w-auto">
          <button 
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() - 1);
              setSelectedDate(d);
            }}
            className="p-1.5 sm:p-2 hover:bg-brand-700 rounded-xl transition-colors border border-brand-500 active:scale-95 shrink-0"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 rotate-180" />
          </button>
          <div className="text-center flex-1 min-w-0 px-2 lg:min-w-[200px]">
            <h2 className="text-[9px] sm:text-xs md:text-sm font-black uppercase tracking-widest truncate">{format(selectedDate, "EEEE", { locale: ptBR })}</h2>
            <p className="text-[8px] sm:text-[10px] font-bold text-brand-100 uppercase tracking-widest truncate">{format(selectedDate, "dd 'DE' MMMM, yyyy", { locale: ptBR })}</p>
            
            {/* Holiday / Celebration Info */}
            <AnimatePresence mode="wait">
              {dayInfo && (
                <motion.div
                  key={dayInfo.name}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className={cn(
                    "mt-1 px-3 py-0.5 rounded-full text-[7px] sm:text-[8px] font-black uppercase tracking-tight flex items-center justify-center gap-1 border backdrop-blur-md",
                    dayInfo.type === 'HOLIDAY' 
                      ? "bg-amber-400/90 border-amber-300 text-amber-950 shadow-lg shadow-amber-500/20" 
                      : "bg-white/10 border-white/20 text-white"
                  )}
                >
                  <Sparkles className="w-2 h-2 sm:w-3 sm:h-3 shrink-0" />
                  <span className="truncate">{dayInfo.name}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button 
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() + 1);
              setSelectedDate(d);
            }}
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

      {/* Header Estilizado */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 border-t-brand-600 border-t-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-brand-600" />
            Minhas Tarefas
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
            Gestão Pessoal de Produtividade
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="BUSCAR TAREFA..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider focus:ring-2 focus:ring-brand-500/20 outline-none w-full sm:w-48 lg:w-40"
            />
          </div>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider focus:ring-2 focus:ring-brand-500/20 outline-none w-full sm:w-auto"
          >
            <option value="ALL">TODOS STATUS</option>
            {Object.values(TaskStatus).map(s => (
              <option key={s} value={s}>{TaskStatusLabels[s]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* Lista de Tarefas */}
        <div className={cn(
          "w-full lg:w-1/3 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden",
          selectedTaskId && "hidden lg:flex"
        )}>
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fila de Trabalho</h3>
            <span className="text-[10px] font-black bg-brand-600 text-white px-2 py-0.5 rounded-full">
              {filteredTasks.length} ITEMS
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {loading ? (
              <div className="flex justify-center p-12">
                <div className="w-8 h-8 border-4 border-slate-100 border-t-brand-600 rounded-full animate-spin"></div>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-slate-300">
                <CheckCircle2 className="w-12 h-12 mb-4 opacity-10" />
                <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma tarefa pendente</p>
              </div>
            ) : (
              filteredTasks.map(task => (
                <motion.div
                  key={task.id}
                  layoutId={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={cn(
                    "p-4 rounded-xl border-2 cursor-pointer transition-all relative group overflow-hidden",
                    selectedTaskId === task.id 
                      ? "border-brand-500 bg-brand-50/30" 
                      : "border-slate-50 bg-slate-50/30 hover:border-slate-200"
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span 
                      onClick={(e) => cycleStatus(e, task)}
                      title="Clique para mudar o status"
                      className={cn(
                        "text-[8px] font-black px-2 py-0.5 rounded-full border uppercase cursor-pointer hover:brightness-95 active:scale-95 transition-all",
                        getStatusColor(task.status)
                      )}>
                      {TaskStatusLabels[task.status]}
                    </span>
                    <AlertCircle className={cn("w-4 h-4", getPriorityColor(task.priority))} />
                  </div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight mb-1 truncate flex items-center gap-2">
                    {task.title}
                    <button 
                      onClick={(e) => handleChatWithAssignees(task, e)}
                      className="p-1 px-1.5 bg-brand-50 text-brand-600 rounded-md hover:bg-brand-100 transition-colors"
                      title="Falar com responsáveis"
                    >
                      <MessageSquare className="w-3 h-3" />
                    </button>
                  </h4>
                  {task.description && (
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed mb-2 line-clamp-3">
                      {task.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-[9px] font-bold text-slate-400 uppercase">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {task.updatedAt ? format(task.updatedAt.toDate(), 'HH:mm', { locale: ptBR }) : '--:--'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {task.updatedAt ? format(task.updatedAt.toDate(), 'dd MMM', { locale: ptBR }) : 'S/D'}
                    </span>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Detalhes e Ações */}
        <div className={cn(
          "flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden",
          !selectedTaskId && "hidden lg:flex"
        )}>
          {selectedTask ? (
            <div className="flex flex-col h-full">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setSelectedTaskId(null)}
                    className="lg:hidden p-2 hover:bg-white rounded-lg transition-colors border border-slate-200"
                  >
                    <ChevronRight className="w-5 h-5 rotate-180" />
                  </button>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-tight">
                      {selectedTask.title}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      ID: {selectedTask.id.slice(0, 8)} • CRIADA EM: {format(selectedTask.createdAt.toDate(), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                {/* Descrição */}
                <section>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Procedimento / Descrição</h4>
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-slate-600 text-sm leading-relaxed whitespace-pre-wrap italic">
                    {selectedTask.description || 'Nenhuma descrição detalhada disponível para esta atividade.'}
                  </div>
                </section>

                {/* Atualização de Status */}
                <section>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Alterar Progresso</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.values(TaskStatus).map(s => (
                      <button
                        key={s}
                        onClick={() => handleUpdateStatus(s)}
                        disabled={isSaving}
                        className={cn(
                          "px-3 py-2 rounded-xl border-2 text-xs font-black uppercase tracking-wider transition-all",
                          selectedTask.status === s
                            ? "bg-brand-600 border-brand-600 text-white shadow-lg shadow-brand-500/20"
                            : "bg-white border-slate-100 text-slate-400 hover:border-slate-300"
                        )}
                      >
                        {TaskStatusLabels[s]}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Confirm Delivery / Sign */}
                <section className="pt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleUpdateStatus(TaskStatus.COMPLETED)}
                    disabled={isSaving || selectedTask.status === TaskStatus.COMPLETED}
                    className={cn(
                      "w-full py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg",
                      selectedTask.status === TaskStatus.COMPLETED
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-100 cursor-default"
                        : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/20"
                    )}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm font-black uppercase tracking-[0.2em]">
                      {selectedTask.status === TaskStatus.COMPLETED ? 'Entrega Assinada' : 'Assinar Termo de Entrega'}
                    </span>
                  </button>
                  <p className="text-[9px] font-bold text-slate-400 uppercase text-center mt-3 tracking-widest italic">
                    Ao assinar, você confirma a conclusão total desta atividade conforme os padrões estabelecidos.
                  </p>
                </section>

                {/* Justificativa e Observações */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Anotações e Justificativas
                    </h4>
                    <button 
                      onClick={handleSaveJustification}
                      disabled={isSaving || justification === selectedTask.justification}
                      className="text-xs font-black text-brand-600 uppercase tracking-wider flex items-center gap-2 hover:bg-brand-50 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      Salvar Notas
                    </button>
                  </div>
                  <textarea
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="DIGITE AQUI OBSERVAÇÕES SOBRE A REALIZAÇÃO DESTA TAREFA, PROBLEMAS ENCONTRADOS OU JUSTIFICATIVAS DE ATRASO..."
                    className="w-full h-40 p-6 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold uppercase tracking-widest focus:ring-4 focus:ring-brand-500/10 outline-none transition-all placeholder:text-slate-300 resize-none"
                  />
                </section>
              </div>

              {isSaving && (
                <div className="p-4 bg-brand-50 border-t border-brand-100 flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-[10px] font-black text-brand-700 uppercase tracking-widest">Sincronizando com o Servidor...</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-300 bg-slate-50/50">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-100">
                <CheckCircle2 className="w-10 h-10 opacity-20" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em]">Selecione uma tarefa</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase mt-2">Clique em um item da lista para gerenciar o progresso</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
