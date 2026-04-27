import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, updateDoc, doc, serverTimestamp, arrayUnion, arrayRemove, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Task, User, TaskStatus, TaskPriority, UserRole, TaskRecurrence, TaskRecurrenceLabels } from '../../types';
import { useAuth } from '../../App';
import { Search, Users, CheckSquare, UserPlus, Filter, ArrowRight, UserCheck, Calendar } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function TaskAssignment() {
  const { user: currentUser, effectiveRole } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [pendingAssignments, setPendingAssignments] = useState<string[]>([]);
  const [taskRecurrence, setTaskRecurrence] = useState<TaskRecurrence>(TaskRecurrence.NONE);
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskRecurrenceEndDate, setTaskRecurrenceEndDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [taskSearch, setTaskSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const isAdminOrManager = effectiveRole === UserRole.ADMIN || effectiveRole === UserRole.MANAGER;

  useEffect(() => {
    setLoading(true);
    // Listen to tasks - ordered by title (alphabetical) as requested
    const qTasks = query(collection(db, 'tasks'), orderBy('title', 'asc'));
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      setTasks(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
      setLoading(false);
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'tasks'));

    // Listen to users
    const qUsers = query(collection(db, 'users'), orderBy('name', 'asc'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as User)));
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'users'));

    return () => {
      unsubTasks();
      unsubUsers();
    };
  }, []);

  // Sync pending assignments when task changes
  useEffect(() => {
    if (selectedTaskId) {
      const task = tasks.find(t => t.id === selectedTaskId);
      setPendingAssignments(task?.assignedTo || []);
      setTaskRecurrence(task?.recurrence || TaskRecurrence.NONE);
      setTaskDueDate(task?.dueDate && typeof task.dueDate.toDate === 'function' ? format(task.dueDate.toDate(), 'yyyy-MM-dd') : '');
      setTaskRecurrenceEndDate(task?.recurrenceEndDate && typeof task.recurrenceEndDate.toDate === 'function' ? format(task.recurrenceEndDate.toDate(), 'yyyy-MM-dd') : '');
    } else {
      setPendingAssignments([]);
      setTaskRecurrence(TaskRecurrence.NONE);
      setTaskDueDate('');
      setTaskRecurrenceEndDate('');
    }
  }, [selectedTaskId, tasks]);

  const toggleUserPending = (userId: string) => {
    if (!isAdminOrManager) return;
    setPendingAssignments(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSave = async () => {
    if (!selectedTaskId || !isAdminOrManager) return;
    
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'tasks', selectedTaskId), {
        assignedTo: pendingAssignments,
        recurrence: taskRecurrence,
        dueDate: taskDueDate ? new Date(taskDueDate + 'T12:00:00') : null,
        recurrenceEndDate: taskRecurrenceEndDate ? new Date(taskRecurrenceEndDate + 'T12:00:00') : null,
        updatedAt: serverTimestamp()
      });
      // Success feedback could be added here
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `tasks/${selectedTaskId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(taskSearch.toLowerCase()) ||
    t.description?.toLowerCase().includes(taskSearch.toLowerCase())
  );

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.role.toLowerCase().includes(userSearch.toLowerCase())
  );

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
          <UserPlus className="w-6 h-6 text-brand-600" />
          Atribuição Estratégica de Tarefas
        </h2>
        <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-widest">
          Gerenciamento Centralizado de Responsabilidades e Fluxo de Equipe
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-[500px]">
        {/* Coluna de Tarefas (Lado Esquerdo) */}
        <div className="md:w-1/2 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">1. SELECIONE A TAREFA</h3>
              <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full uppercase">
                {filteredTasks.length} Tarefas
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder="BUSCAR TAREFA..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                value={taskSearch}
                onChange={e => setTaskSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar min-h-[400px]">
            {loading ? (
              <div className="flex justify-center p-8">
                <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="text-center p-8">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nenhuma tarefa encontrada</p>
              </div>
            ) : (
              filteredTasks.map(task => (
                <div 
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={cn(
                    "p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 group relative",
                    selectedTaskId === task.id 
                      ? "border-brand-500 bg-brand-50/50 shadow-sm" 
                      : "border-slate-100 hover:border-slate-200 bg-white"
                  )}
                >
                  {/* Ponto de Seleção da Tarefa (Círculo) */}
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                    selectedTaskId === task.id 
                      ? "border-brand-600 bg-brand-600 shadow-[0_0_10px_rgba(var(--color-brand-600),0.3)]" 
                      : "border-slate-300 bg-white group-hover:border-slate-400"
                  )}>
                    {selectedTaskId === task.id && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-tight truncate">
                      {task.title}
                    </h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">
                      {(task.assignedTo || []).length} usuários vinculados
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Coluna de Usuários (Lado Direito) */}
        <div className="md:w-1/2 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">2. ATRIBUIR A PESSOAL</h3>
              {selectedTask && (
                <span className="text-[9px] font-black text-brand-600 uppercase bg-brand-50 px-2 py-1 rounded border border-brand-100 shadow-sm">
                  Tarefa: {selectedTask.title}
                </span>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                disabled={!selectedTaskId}
                placeholder={selectedTaskId ? "BUSCAR PESSOA..." : "SELECIONE UMA TAREFA À ESQUERDA"}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-brand-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar min-h-[400px]">
            {!selectedTaskId ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-300">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                  <ArrowRight className="w-8 h-8 opacity-20" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">PASSO 1: SELECIONE A TAREFA</p>
                <p className="text-[9px] font-bold mt-2 uppercase tracking-tighter text-slate-300">Após selecionar, escolha os usuários nesta coluna</p>
              </div>
            ) : (
              <>
                {/* Recurrence Settings Section */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-2 space-y-4 shadow-inner">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-brand-600" />
                    Ajuste de Recorrência
                  </h4>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Estratégia</label>
                        {taskRecurrence !== TaskRecurrence.NONE && (
                          <button 
                            type="button"
                            onClick={() => setTaskRecurrenceEndDate('')}
                            className={cn(
                              "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded transition-colors",
                              !taskRecurrenceEndDate ? "bg-brand-600 text-white shadow-sm" : "bg-slate-200 text-slate-500 hover:bg-slate-300 cursor-pointer"
                            )}
                          >
                            {!taskRecurrenceEndDate ? 'Permanente' : 'Data de Fim'}
                          </button>
                        )}
                      </div>
                      <select 
                        disabled={!isAdminOrManager}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold uppercase tracking-widest focus:ring-2 focus:ring-brand-500/20 outline-none"
                        value={taskRecurrence}
                        onChange={e => setTaskRecurrence(e.target.value as TaskRecurrence)}
                      >
                        {Object.values(TaskRecurrence).map(r => (
                          <option key={r} value={r}>{TaskRecurrenceLabels[r]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Início</label>
                        <input 
                          type="date"
                          disabled={!isAdminOrManager}
                          className="w-full p-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-brand-500/20"
                          value={taskDueDate}
                          onChange={e => setTaskDueDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <div className="mb-1.5">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Fim da Recorrência</label>
                        </div>
                        <input 
                          type="date"
                          disabled={!isAdminOrManager || taskRecurrence === TaskRecurrence.NONE}
                          className="w-full p-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-40"
                          value={taskRecurrenceEndDate}
                          onChange={e => setTaskRecurrenceEndDate(e.target.value)}
                        />
                        {!taskRecurrenceEndDate && taskRecurrence !== TaskRecurrence.NONE && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" />
                            <span className="text-[8px] font-bold text-brand-600 uppercase tracking-tighter">Frequência Permanente</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Escolha os Responsáveis</h4>
                  <div className="space-y-2">
                    {filteredUsers.map(u => {
                      const isAssigned = pendingAssignments.includes(u.id);
                      return (
                        <div 
                          key={u.id}
                          onClick={() => isAdminOrManager && toggleUserPending(u.id)}
                          className={cn(
                            "p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center group relative overflow-hidden",
                            isAssigned 
                              ? "border-brand-500 bg-brand-50/20" 
                              : "border-slate-50 hover:border-slate-200 bg-white",
                            !isAdminOrManager && "opacity-75 cursor-not-allowed"
                          )}
                        >
                          {/* Ponto de Seleção do Usuário (Círculo) */}
                          <div className={cn(
                            "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all mr-3",
                            isAssigned 
                              ? "border-brand-600 bg-brand-600 shadow-[0_0_10px_rgba(var(--color-brand-600),0.3)]" 
                              : "border-slate-300 bg-white group-hover:border-slate-400"
                          )}>
                            {isAssigned && <UserCheck className="w-3.5 h-3.5 text-white" />}
                          </div>

                          <div className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center text-[10px] font-black shrink-0 mr-3 border-2 border-brand-500">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight truncate">{u.name}</h4>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{u.role}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
          
          {selectedTask && (
            <div className="p-4 bg-brand-600 text-white flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/50">Atribuindo para:</p>
                <p className="text-[10px] font-black uppercase tracking-tight truncate">{selectedTask.title}</p>
                <p className="text-[9px] font-bold text-white/80 uppercase mt-0.5">{pendingAssignments.length} Selecionados</p>
              </div>
              
              {isAdminOrManager ? (
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : <UserCheck className="w-4 h-4" />}
                  {isSaving ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES'}
                </button>
              ) : (
                <div className="bg-slate-800 px-3 py-2 rounded-lg border border-slate-700">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Acesso Restrito</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
