import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, arrayUnion, arrayRemove, setDoc, orderBy, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Task, User, TaskStatus, TaskPriority, TaskRecurrence, UserRole, TaskStatusLabels, TaskPriorityLabels, TaskRecurrenceLabels, UserRoleLabels, Chat } from '../../types';
import { useAuth } from '../../App';
import { Plus, Search, Filter, Calendar, Users, CheckCircle2, Clock, AlertCircle, ArrowRight, UserPlus, ChevronRight, CheckSquare, X, Edit3, Save, MessageSquare, Briefcase } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface TaskManagerProps {
  onNavigateToChat?: (chatId: string) => void;
}

export default function TaskManager({ onNavigateToChat }: TaskManagerProps) {
  const { user, effectiveRole } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [team, setTeam] = useState<User[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');
  const [filterDueDate, setFilterDueDate] = useState<'all' | 'today' | 'week' | 'overdue'>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qTasks = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      console.log(`[TaskManager] RECEIVED ${snapshot.docs.length} TASKS`);
      setTasks(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
      setLoading(false);
    }, (error) => {
      console.error("[TaskManager] Tasks Error:", error);
      handleFirestoreError(error, OperationType.GET, 'tasks');
      setLoading(false);
    });

    const qUsers = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      setTeam(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as User)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    return () => { unsubTasks(); unsubUsers(); };
  }, []);

  const handleAssign = async (userId: string) => {
    if (!selectedTaskId) return;
    const task = tasks.find(t => t.id === selectedTaskId);
    if (!task) return;

    try {
      const isAssigned = (task.assignedTo || []).includes(userId);
      await updateDoc(doc(db, 'tasks', selectedTaskId), {
        assignedTo: isAssigned ? arrayRemove(userId) : arrayUnion(userId),
        updatedAt: serverTimestamp()
      });

      // Send notification if newly assigned
      if (!isAssigned && userId !== user?.id) {
        await addDoc(collection(db, 'notifications'), {
          userId,
          title: 'Nova Tarefa Atribuída',
          message: `Você foi atribuído à tarefa: ${task.title}`,
          type: 'TASK',
          read: false,
          link: 'my-tasks',
          createdAt: serverTimestamp()
        });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `tasks/${selectedTaskId}`);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir permanentemente esta tarefa?')) return;
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      if (selectedTaskId === taskId) setSelectedTaskId(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `tasks/${taskId}`);
    }
  };

  const handleChatWithAssignees = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't select the task when clicking chat
    if (!user || !onNavigateToChat) return;
    
    // We want a chat with all assignees + the user
    // If the user is an assignee, don't add them twice
    const members = Array.from(new Set([...(task.assignedTo || []), user.id]));
    
    if (members.length < 2) {
      alert("Atribua pelo menos um colaborador para iniciar um chat.");
      return;
    }

    try {
      // Find existing chat with EXACTLY these members (order independent in a proper app, but here we check for inclusion)
      // For simplicity, we search for a chat of the same type and containing the user
      // In a real prod app, we'd have a canonical member list or a hash.
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
        // Create new chat
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

  const selectedTask = tasks.find(t => t.id === selectedTaskId);
  const statusOrder = {
    [TaskStatus.IN_PROGRESS]: 1,
    [TaskStatus.PENDING]: 2,
    [TaskStatus.DELAYED]: 3,
    [TaskStatus.COMPLETED]: 4,
  };

  const filteredTasks = tasks
    .filter(t => {
      const matchesSearch = (t.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (t.description || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesUser = filterUser === 'all' || (t.assignedTo && t.assignedTo.includes(filterUser));
      const matchesPriority = filterPriority === 'all' || t.priority === filterPriority;
      
      let matchesDate = true;
      if (filterDueDate !== 'all') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const taskDate = t.dueDate?.toDate ? t.dueDate.toDate() : null;
        
        if (!taskDate) {
          matchesDate = false;
        } else {
          const tDate = new Date(taskDate);
          tDate.setHours(0, 0, 0, 0);
          
          if (filterDueDate === 'today') {
            matchesDate = tDate.getTime() === today.getTime();
          } else if (filterDueDate === 'week') {
            const nextWeek = new Date(today);
            nextWeek.setDate(today.getDate() + 7);
            matchesDate = tDate >= today && tDate <= nextWeek;
          } else if ((filterDueDate as string) === 'overdue') {
            matchesDate = tDate < today && t.status !== TaskStatus.COMPLETED;
          }
        }
      }

      return matchesSearch && matchesUser && matchesPriority && matchesDate;
    })
    .sort((a, b) => (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99));

  const getStatusInfo = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.COMPLETED: return { color: 'text-emerald-600 bg-emerald-50', icon: CheckCircle2, label: TaskStatusLabels[TaskStatus.COMPLETED] };
      case TaskStatus.IN_PROGRESS: return { color: 'text-amber-600 bg-amber-50', icon: Clock, label: TaskStatusLabels[TaskStatus.IN_PROGRESS] };
      case TaskStatus.DELAYED: return { color: 'text-rose-600 bg-rose-50', icon: AlertCircle, label: TaskStatusLabels[TaskStatus.DELAYED] };
      default: return { color: 'text-slate-500 bg-slate-50', icon: Clock, label: TaskStatusLabels[TaskStatus.PENDING] };
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.HIGH: return 'bg-rose-500';
      case TaskPriority.MEDIUM: return 'bg-amber-500';
      case TaskPriority.LOW: return 'bg-emerald-500';
      default: return 'bg-slate-400';
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 pb-20 lg:pb-0">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 border-t-brand-600 border-t-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-4 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar tarefas..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {(effectiveRole === UserRole.ADMIN || effectiveRole === UserRole.MANAGER) && (
              <button 
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-2 px-4 py-1.5 bg-brand-600 text-white rounded-xl text-base font-black uppercase tracking-wider hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/20 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Nova Tarefa
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-50">
          <div className="w-full lg:w-auto flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2 mb-2 lg:mb-0">
            <Filter className="w-3.5 h-3.5" />
            Filtros Ativos:
          </div>
          
          <div className="relative group w-full sm:w-[calc(50%-6px)] lg:w-auto">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="appearance-none pl-10 pr-8 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black uppercase tracking-wider focus:outline-none cursor-pointer hover:bg-slate-100 transition-colors w-full lg:min-w-[200px]"
            >
              <option value="all">TODOS OS COLABORADORES</option>
              {team.map(u => (
                <option key={u.id} value={u.id}>{u.name.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div className="relative group w-full sm:w-[calc(50%-6px)] lg:w-auto">
            <AlertCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as any)}
              className="appearance-none pl-10 pr-8 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black uppercase tracking-wider focus:outline-none cursor-pointer hover:bg-slate-100 transition-colors w-full lg:min-w-[150px]"
            >
              <option value="all">TODAS PRIORIDADES</option>
              {Object.values(TaskPriority).map(p => (
                <option key={p} value={p}>{TaskPriorityLabels[p]}</option>
              ))}
            </select>
          </div>

          <div className="relative group w-full sm:w-[calc(50%-6px)] lg:w-auto">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <select
              value={filterDueDate}
              onChange={(e) => setFilterDueDate(e.target.value as any)}
              className="appearance-none pl-10 pr-8 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black uppercase tracking-wider focus:outline-none cursor-pointer hover:bg-slate-100 transition-colors w-full lg:min-w-[150px]"
            >
              <option value="all">TODAS AS DATAS</option>
              <option value="today">VENCENDO HOJE</option>
              <option value="week">PRÓXIMOS 7 DIAS</option>
              <option value="overdue">ATRASADAS</option>
            </select>
          </div>

          {(searchTerm || filterUser !== 'all' || filterPriority !== 'all' || filterDueDate !== 'all') && (
            <button 
              onClick={() => {
                setSearchTerm('');
                setFilterUser('all');
                setFilterPriority('all');
                setFilterDueDate('all');
              }}
              className="px-2 py-1.5 text-xs font-black text-rose-600 uppercase tracking-wider hover:bg-rose-50 rounded-xl transition-colors w-full lg:w-auto"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Main Content: Split Screen */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Tasks List */}
        <div className={cn(
          "flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm transition-all",
          selectedTaskId && "hidden lg:flex"
        )}>
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              Fila de Execução ({filteredTasks.length})
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                <div className="w-2 h-2 rounded-full bg-rose-500" /> Alta
                <div className="w-2 h-2 rounded-full bg-amber-500" /> Média
                <div className="w-2 h-2 rounded-full bg-emerald-500" /> Baixa
              </div>
            </div>
          </div>
          <div className="p-4 space-y-4">
            {loading ? (
              <div className="flex justify-center p-12">
                <div className="w-6 h-6 border-2 border-slate-200 border-t-brand-600 rounded-full animate-spin"></div>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <Search className="w-8 h-8 mb-4 opacity-20" />
                <p className="text-xs font-medium uppercase tracking-widest">
                  {tasks.length === 0 ? 'Sem tarefas ativas' : 'Nada encontrado nos filtros'}
                </p>
                <p className="text-[10px] mt-1 italic">
                  {tasks.length === 0 ? 'Use o botão + NOVA TAREFA para começar' : 'Ajuste sua busca para encontrar o que precisa'}
                </p>
              </div>
            ) : (
              filteredTasks.map(task => {
                const status = getStatusInfo(task.status);
                const priorityColor = getPriorityColor(task.priority);
                return (
                  <motion.div
                    layout
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className={cn(
                      "relative flex flex-col p-4 border rounded-2xl cursor-pointer transition-all bg-white group hover:shadow-md",
                      selectedTaskId === task.id 
                        ? "border-brand-500 ring-1 ring-brand-500 shadow-sm" 
                        : "border-slate-100 hover:border-slate-200"
                    )}
                  >
                    {/* Priority Indicator */}
                    <div className={cn("absolute top-0 left-4 w-8 h-1 rounded-b-full", priorityColor)} />

                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 overflow-hidden flex items-center gap-2">
                        <h4 className={cn(
                          "font-black text-sm uppercase tracking-tight truncate",
                          selectedTaskId === task.id ? "text-slate-900" : "text-slate-700 group-hover:text-slate-900"
                        )}>
                          {task.title || 'Sem Título'}
                        </h4>
                        <button 
                          onClick={(e) => handleChatWithAssignees(task, e)}
                          className="p-1 px-1.5 bg-brand-50 text-brand-600 rounded-md hover:bg-brand-100 transition-colors"
                          title="Falar com responsáveis"
                        >
                          <MessageSquare className="w-3 h-3" />
                        </button>
                      </div>
                      <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest leading-none shrink-0", status.color)}>
                        <status.icon className="w-3 h-3" />
                        {status.label}
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-2 mb-4 font-medium h-8">
                      {task.description || 'Nenhuma descrição detalhada fornecida para esta tarefa.'}
                    </p>

                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-50">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Calendar className="w-3 h-3" />
                          <span className="text-[10px] font-bold">
                            {task.dueDate && typeof task.dueDate.toDate === 'function' ? format(task.dueDate.toDate(), "dd/MM", { locale: ptBR }) : 'S/P'}
                          </span>
                        </div>
                        {task.recurrence && task.recurrence !== TaskRecurrence.NONE && (
                          <div className="px-1.5 py-0.5 bg-brand-50 text-brand-700 rounded text-[8px] font-black uppercase tracking-tighter">
                            Recorrente
                          </div>
                        )}
                      </div>
                      
                      <div className="flex -space-x-2">
                        {(task.assignedTo || []).slice(0, 3).map((uid, idx) => {
                          const m = team.find(u => u.id === uid);
                          return (
                            <div key={uid} className="w-6 h-6 rounded-full bg-white p-0.5" style={{ zIndex: 3 - idx }}>
                              <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-600 border border-white">
                                {m?.name.charAt(0).toUpperCase() || '?'}
                              </div>
                            </div>
                          );
                        })}
                        {(task.assignedTo || []).length > 3 && (
                          <div className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-[8px] font-bold border border-white z-0">
                            +{(task.assignedTo || []).length - 3}
                          </div>
                        )}
                        {(task.assignedTo || []).length === 0 && (
                          <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center border border-dashed border-slate-200">
                            <UserPlus className="w-3 h-3 text-slate-300" />
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* Botão Central de Ação (Visual only as per design) */}
        <div className="hidden lg:flex flex-col justify-center gap-4 shrink-0">
          <div className="w-12 h-12 bg-brand-600 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all">
            <ChevronRight className="w-6 h-6" />
          </div>
        </div>

        {/* Right: Assignment & Details View */}
        <div className={cn(
          "flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm",
          !selectedTaskId && "hidden lg:flex"
        )}>
          {selectedTask ? (
            <>
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <button onClick={() => setSelectedTaskId(null)} className="lg:hidden p-2 hover:bg-slate-200 rounded-lg">
                  <ArrowRight className="w-5 h-5 rotate-180" />
                </button>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Detalhamento da Tarefa
                </h3>
                <div className="flex items-center gap-4">
                  {(effectiveRole === UserRole.ADMIN || effectiveRole === UserRole.MANAGER || selectedTask.creatorId === user?.id) && (
                    <>
                      <button 
                        onClick={() => handleDeleteTask(selectedTask.id)}
                        className="text-xs font-black text-rose-500 hover:text-rose-600 uppercase tracking-wider"
                      >
                        Excluir
                      </button>
                      <button 
                        onClick={() => setIsEditing(true)}
                        className="text-xs font-black text-brand-600 uppercase hover:underline tracking-wider"
                      >
                        Editar
                      </button>
                    </>
                  )}
                  <div className="hidden sm:block text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Gerencial Adm</div>
                </div>
              </div>
              
              <div className="">
                {/* Task Header Details */}
                <div className="p-6 border-b border-slate-50 bg-slate-50/20">
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2 leading-tight">
                    {selectedTask.title}
                  </h2>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed">
                    {selectedTask.description || "Nenhuma descrição disponível."}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="bg-white p-3 rounded-xl border border-slate-200/60">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Status Atual</span>
                      <div className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest", getStatusInfo(selectedTask.status).color)}>
                        {getStatusInfo(selectedTask.status).label}
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200/60">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Urgência</span>
                      <div className="flex items-center gap-1.5">
                        <div className={cn("w-2 h-2 rounded-full", getPriorityColor(selectedTask.priority))} />
                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">{TaskPriorityLabels[selectedTask.priority]}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Team Assignment */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4 px-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responsáveis pela Execução</h4>
                    {selectedTask.status !== TaskStatus.COMPLETED && (
                      <button
                        onClick={async () => {
                          if (!user) return;
                          try {
                            await updateDoc(doc(db, 'tasks', selectedTask.id), {
                              status: TaskStatus.COMPLETED,
                              signedBy: user.id,
                              signedAt: serverTimestamp(),
                              updatedAt: serverTimestamp()
                            });
                          } catch (e) {
                            handleFirestoreError(e, OperationType.UPDATE, `tasks/${selectedTask.id}`);
                          }
                        }}
                        className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all active:scale-95 flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Assinar Entrega
                      </button>
                    )}
                    {selectedTask.signedBy && (
                      <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 italic">
                        <CheckCircle2 className="w-3 h-3" />
                        <span className="text-[8px] font-black uppercase tracking-widest">Entrega Assinada</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    {team.map(member => (
                      <div
                        key={member.id}
                        onClick={() => handleAssign(member.id)}
                        className={cn(
                          "group flex items-center p-3 rounded-xl border-2 transition-all cursor-pointer",
                          (selectedTask.assignedTo || []).includes(member.id)
                            ? "border-brand-500 bg-brand-50/30"
                            : "border-transparent hover:bg-slate-50"
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                          (selectedTask.assignedTo || []).includes(member.id) ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-600"
                        )}>
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-3 flex-1 overflow-hidden">
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {member.name} {member.id === user?.id && <span className="text-[10px] text-brand-600 font-normal">(Você)</span>}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">{member.role ? UserRoleLabels[member.role] : ''} • Ativo</p>
                        </div>
                        <div className={cn(
                          "w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center transition-all shrink-0",
                          (selectedTask.assignedTo || []).includes(member.id) ? "bg-brand-600 border-brand-600" : "bg-white"
                        )}>
                          {(selectedTask.assignedTo || []).includes(member.id) && <CheckSquare className="w-2.5 h-2.5 text-white" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50/30">
                <p className="text-[9px] text-slate-400 text-center mb-1 font-bold uppercase tracking-widest">Controle de Fluxo Operacional</p>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50/30">
              <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
                <Users className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Painel de Detalhes</h3>
              <p className="text-xs text-slate-500 mt-2 max-w-[240px] font-medium leading-relaxed">
                Selecione uma tarefa na fila para visualizar o escopo completo, prazos e gerenciar a equipe responsável.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modais */}
      <AnimatePresence>
        {(isCreating || isEditing) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl relative overflow-y-auto max-h-[90vh] scrollbar-thin scrollbar-thumb-slate-300"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-brand-600" />
              <TaskForm 
                onCancel={() => { setIsCreating(false); setIsEditing(false); }} 
                task={isEditing ? selectedTask : undefined}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TaskForm({ onCancel, task }: { onCancel: () => void, task?: Task }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    priority: task?.priority || TaskPriority.MEDIUM,
    status: task?.status || TaskStatus.PENDING,
    recurrence: task?.recurrence || TaskRecurrence.NONE,
    dueDate: task?.dueDate && typeof task.dueDate.toDate === 'function' ? format(task.dueDate.toDate(), 'yyyy-MM-dd') : '',
    recurrenceEndDate: task?.recurrenceEndDate && typeof task.recurrenceEndDate.toDate === 'function' ? format(task.recurrenceEndDate.toDate(), 'yyyy-MM-dd') : ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;

    try {
      const payload = {
        ...formData,
        updatedAt: serverTimestamp(),
        dueDate: formData.dueDate ? new Date(formData.dueDate + 'T12:00:00') : null,
        recurrenceEndDate: formData.recurrenceEndDate ? new Date(formData.recurrenceEndDate + 'T12:00:00') : null
      };

      if (task) {
        await updateDoc(doc(db, 'tasks', task.id), payload);
      } else {
        const taskRef = doc(collection(db, 'tasks'));
        await setDoc(taskRef, {
          ...payload,
          id: taskRef.id,
          creatorId: user?.id,
          assignedTo: [],
          createdAt: serverTimestamp()
        });
      }
      onCancel();
    } catch (e) {
      handleFirestoreError(e, task ? OperationType.UPDATE : OperationType.CREATE, task ? `tasks/${task.id}` : 'tasks');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
            {task ? 'Configurar Estrutura' : 'Projetar Nova Tarefa'}
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gestão de Workflow Operacional</p>
        </div>
        <button type="button" onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <X className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Título da Atividade</label>
          <input 
            required
            type="text" 
            placeholder="Defina um nome claro para a tarefa"
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 font-bold text-sm"
            value={formData.title}
            onChange={e => setFormData({ ...formData, title: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Procedimento / Notas</label>
          <textarea 
            rows={4}
            placeholder="Detalhe os passos ou o que deve ser feito para concluir esta tarefa..."
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 text-xs font-medium leading-relaxed"
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Prioridade Crítica</label>
            <select 
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 text-xs font-bold uppercase tracking-widest"
              value={formData.priority}
              onChange={e => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
            >
              {Object.values(TaskPriority).map(p => (
                <option key={p} value={p}>{TaskPriorityLabels[p]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Situação Operacional</label>
            <select 
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 text-xs font-bold uppercase tracking-widest"
              value={formData.status}
              onChange={e => setFormData({ ...formData, status: e.target.value as TaskStatus })}
            >
              {Object.values(TaskStatus).map(s => (
                <option key={s} value={s}>{TaskStatusLabels[s]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Estratégia de Recorrência</label>
              {formData.recurrence !== TaskRecurrence.NONE && (
                <button 
                  type="button"
                  onClick={() => setFormData({ ...formData, recurrenceEndDate: '' })}
                  className={cn(
                    "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded transition-colors",
                    !formData.recurrenceEndDate ? "bg-brand-600 text-white shadow-sm" : "bg-slate-200 text-slate-500 hover:bg-slate-300"
                  )}
                >
                  {!formData.recurrenceEndDate ? 'Permanente' : 'Data de Fim'}
                </button>
              )}
            </div>
            <select 
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 text-xs font-bold uppercase tracking-widest"
              value={formData.recurrence}
              onChange={e => setFormData({ ...formData, recurrence: e.target.value as TaskRecurrence })}
            >
              {Object.values(TaskRecurrence).map(r => (
                <option key={r} value={r}>{TaskRecurrenceLabels[r]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
              {formData.recurrence !== TaskRecurrence.NONE ? 'Início da Recorrência' : 'Data de Vencimento'}
            </label>
            <input 
              type="date" 
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 text-xs font-bold"
              value={formData.dueDate}
              onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
            />
          </div>
        </div>

        {formData.recurrence !== TaskRecurrence.NONE && (
          <div>
            <div className="mb-1.5">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fim da Recorrência</label>
            </div>
            <input 
              type="date" 
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 text-xs font-bold disabled:opacity-40"
              value={formData.recurrenceEndDate}
              onChange={e => setFormData({ ...formData, recurrenceEndDate: e.target.value })}
            />
            {!formData.recurrenceEndDate && (
              <p className="text-[9px] font-bold text-brand-600 uppercase tracking-tight mt-1.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-brand-600 rounded-full animate-pulse" />
                Ciclo Permanente Ativado
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-8">
        <button 
          type="button" 
          onClick={onCancel}
          className="flex-1 py-2 px-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-200 transition-colors"
        >
          Cancelar
        </button>
        <button 
          type="submit"
          className="flex-1 py-2 px-3 bg-brand-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2"
        >
          <Save className="w-3.5 h-3.5" />
          {task ? 'Sincronizar Atualizações' : 'Validar e Cadastrar'}
        </button>
      </div>
    </form>
  );
}
