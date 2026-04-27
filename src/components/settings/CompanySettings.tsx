import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, serverTimestamp, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../App';
import { CompanySettings as CompanySettingsType, UserRole, TaskStatus, TaskPriority, TaskRecurrence } from '../../types';
import { Building2, Save, Palette, Image as ImageIcon, Briefcase, FileText, Sparkles, Check, Trash2, Search, Edit3, Plus, Upload, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateTaskSuggestions } from '../../lib/gemini';

export default function CompanySettings() {
  const { user, effectiveRole } = useAuth();
  const canEdit = effectiveRole === UserRole.ADMIN || effectiveRole === UserRole.MANAGER;
  const [settings, setSettings] = useState<Partial<CompanySettingsType>>({
    companyName: '',
    businessSector: '',
    taxId: '',
    type: 'PJ',
    primaryColor: '#8b5cf6',
    secondaryColor: '#1e293b',
    fontFamily: 'Inter, sans-serif',
    fontSize: 'base',
    fontWeight: 'normal',
    textColor: '#1e293b',
    sidebarColor: '#0f172a',
    contactEmail: '',
    phone: '',
    address: '',
    logoUrl: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [suggestions, setSuggestions] = useState<{ title: string, description: string }[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [suggestionSearch, setSuggestionSearch] = useState('');
  const [isImportingAll, setIsImportingAll] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Por favor, selecione um arquivo de imagem.' });
      return;
    }

    setIsUploading(true);
    setMessage(null);

    try {
      const storageRef = ref(storage, `company/logo_${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      setSettings(prev => ({ ...prev, logoUrl: downloadURL }));
      setMessage({ type: 'success', text: 'Logo carregado com sucesso!' });
    } catch (error) {
      console.error("Erro no upload do logo:", error);
      setMessage({ type: 'error', text: 'Falha ao fazer upload da imagem.' });
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    async function loadSettings() {
      try {
        const docRef = doc(db, 'settings', 'company');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data() as CompanySettingsType);
        }
      } catch (error) {
        console.error("Erro ao carregar configurações:", error);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    setSaving(true);
    setMessage(null);

    try {
      const docRef = doc(db, 'settings', 'company');
      await setDoc(docRef, {
        ...settings,
        id: 'company',
        updatedAt: serverTimestamp(),
        updatedBy: user.id
      }, { merge: true });
      
      setMessage({ type: 'success', text: 'Configurações atualizadas com sucesso!' });
    } catch (error) {
      console.error("Erro ao salvar:", error);
      setMessage({ type: 'error', text: 'Falha ao salvar as configurações.' });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateSuggestions = async () => {
    if (!settings.businessSector) {
      setMessage({ type: 'error', text: 'Defina o ramo de atividade para gerar sugestões.' });
      return;
    }

    setIsGeneratingSuggestions(true);
    try {
      const tasks = await generateTaskSuggestions(settings.businessSector);
      setSuggestions(tasks);
    } catch (error) {
      console.error("Erro ao gerar sugestões:", error);
      setMessage({ type: 'error', text: 'Falha ao conectar com o serviço de sugestões AI.' });
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  const confirmTask = async (task: { title: string, description: string }, index: number) => {
    if (!user?.id) {
      setMessage({ type: 'error', text: 'Usuário não autenticado.' });
      return;
    }

    try {
      const taskRef = doc(collection(db, 'tasks'));
      const payload = {
        id: taskRef.id,
        title: task.title,
        description: task.description,
        status: TaskStatus.PENDING,
        priority: TaskPriority.MEDIUM,
        recurrence: TaskRecurrence.NONE,
        dueDate: null,
        assignedTo: [user.id],
        creatorId: user.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      console.log(`[CompanySettings] SAVING TASK:`, payload);
      await setDoc(taskRef, payload);
      
      setSuggestions(prev => prev.filter((_, i) => i !== index));
      setMessage({ type: 'success', text: 'Tarefa importada com sucesso!' });
    } catch (error) {
      console.error("Erro ao importar tarefa:", error);
      setMessage({ type: 'error', text: 'Falha ao importar tarefa.' });
      handleFirestoreError(error, OperationType.WRITE, 'tasks');
    }
  };

  const importAllTasks = async () => {
    if (!user?.id || suggestions.length === 0) return;
    setIsImportingAll(true);
    let count = 0;
    
    try {
      const total = suggestions.length;
      for (let i = 0; i < suggestions.length; i++) {
        const task = suggestions[i];
        const taskRef = doc(collection(db, 'tasks'));
        await setDoc(taskRef, {
          id: taskRef.id,
          title: task.title,
          description: task.description,
          status: TaskStatus.PENDING,
          priority: TaskPriority.MEDIUM,
          recurrence: TaskRecurrence.NONE,
          dueDate: null,
          assignedTo: [user.id],
          creatorId: user.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        count++;
      }
      setSuggestions([]);
      setMessage({ type: 'success', text: `Sucesso! ${count} tarefas foram adicionadas à sua fila operacional.` });
    } catch (error) {
      console.error("Erro ao importar todas:", error);
      setMessage({ type: 'error', text: 'Falha ao importar todas as tarefas.' });
    } finally {
      setIsImportingAll(false);
    }
  };

  const filteredSuggestions = suggestions.filter(s => 
    s.title.toLowerCase().includes(suggestionSearch.toLowerCase()) ||
    s.description.toLowerCase().includes(suggestionSearch.toLowerCase())
  );

  if (!canEdit) {
    return (
      <div className="p-8 text-center bg-red-50 border border-red-100 rounded-2xl">
        <p className="text-red-600 font-bold">Acesso restrito ao Administrador e Gerente.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-brand-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto pb-20"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand-600" />
              Configuração da Organização
            </h3>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter mt-1 italic">
              Dados mestres e identidade visual da empresa
            </p>
          </div>
          {message && (
            <span className={`text-[10px] font-bold px-3 py-1 rounded uppercase ${
              message.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}>
              {message.text}
            </span>
          )}
        </div>

        <form onSubmit={handleSave} className="p-8 space-y-8">
          {/* Identidade Visual */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Palette className="w-3 h-3" /> Identidade Visual
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Logo (URL)</label>
                <div className="flex flex-col gap-4">
                  <div className="relative group w-full aspect-square rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="max-h-full max-w-full p-4 object-contain" />
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <ImageIcon className="w-8 h-8 text-slate-300" />
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sem Logo</span>
                      </div>
                    )}
                    
                    {isUploading && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
                      </div>
                    )}
                  </div>
                  
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-brand-600 hover:border-brand-100 hover:bg-brand-50/30 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {isUploading ? 'Enviando...' : 'Fazer Upload do Logo'}
                  </button>
                  
                  {settings.logoUrl && (
                    <button 
                      type="button"
                      onClick={() => setSettings(prev => ({ ...prev, logoUrl: '' }))}
                      className="text-[9px] font-bold text-slate-400 uppercase tracking-widest hover:text-red-500 transition-colors text-center"
                    >
                      Remover Logo
                    </button>
                  )}
                </div>
              </div>
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Cor Primária</label>
                  <div className="flex gap-2">
                    <input 
                      type="color" 
                      value={settings.primaryColor}
                      onChange={e => setSettings({...settings, primaryColor: e.target.value})}
                      className="w-12 h-10 p-1 bg-white border border-slate-200 rounded"
                    />
                    <input 
                      type="text" 
                      value={settings.primaryColor}
                      onChange={e => setSettings({...settings, primaryColor: e.target.value})}
                      className="flex-1 px-4 py-2 bg-slate-50 border border-slate-100 rounded text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Cor Secundária</label>
                  <div className="flex gap-2">
                    <input 
                      type="color" 
                      value={settings.secondaryColor}
                      onChange={e => setSettings({...settings, secondaryColor: e.target.value})}
                      className="w-12 h-10 p-1 bg-white border border-slate-200 rounded"
                    />
                    <input 
                      type="text" 
                      value={settings.secondaryColor}
                      onChange={e => setSettings({...settings, secondaryColor: e.target.value})}
                      className="flex-1 px-4 py-2 bg-slate-50 border border-slate-100 rounded text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Customização Adicional */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-slate-50">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Cor de Fundo da Barra Lateral</label>
                <div className="flex gap-2">
                  <input 
                    type="color" 
                    value={settings.sidebarColor || '#0f172a'}
                    onChange={e => setSettings({...settings, sidebarColor: e.target.value})}
                    className="w-12 h-10 p-1 bg-white border border-slate-200 rounded"
                  />
                  <input 
                    type="text" 
                    value={settings.sidebarColor || '#0f172a'}
                    onChange={e => setSettings({...settings, sidebarColor: e.target.value})}
                    className="flex-1 px-4 py-2 bg-slate-50 border border-slate-100 rounded text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Cor Principal do Texto</label>
                <div className="flex gap-2">
                  <input 
                    type="color" 
                    value={settings.textColor || '#1e293b'}
                    onChange={e => setSettings({...settings, textColor: e.target.value})}
                    className="w-12 h-10 p-1 bg-white border border-slate-200 rounded"
                  />
                  <input 
                    type="text" 
                    value={settings.textColor || '#1e293b'}
                    onChange={e => setSettings({...settings, textColor: e.target.value})}
                    className="flex-1 px-4 py-2 bg-slate-50 border border-slate-100 rounded text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Fonte do Sistema</label>
                <select 
                  value={settings.fontFamily || 'Inter'}
                  onChange={e => setSettings({...settings, fontFamily: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded text-xs font-bold outline-none"
                >
                  <option value="Inter, sans-serif">Inter (Padrão)</option>
                  <option value="'Space Grotesk', sans-serif">Space Grotesk (Moderno)</option>
                  <option value="'JetBrains Mono', monospace">JetBrains Mono (Tech)</option>
                  <option value="'Playfair Display', serif">Playfair Display (Elegante)</option>
                  <option value="system-ui, sans-serif">Sistema (Nativo)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Tamanho Base</label>
                  <select 
                    value={settings.fontSize || 'base'}
                    onChange={e => setSettings({...settings, fontSize: e.target.value as any})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded text-xs font-bold outline-none"
                  >
                    <option value="xs">Extra Pequeno</option>
                    <option value="sm">Pequeno</option>
                    <option value="base">Normal</option>
                    <option value="lg">Grande</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Peso da Fonte</label>
                  <select 
                    value={settings.fontWeight || 'normal'}
                    onChange={e => setSettings({...settings, fontWeight: e.target.value as any})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded text-xs font-bold outline-none"
                  >
                    <option value="normal">Normal</option>
                    <option value="medium">Médio</option>
                    <option value="bold">Negrito</option>
                    <option value="black">Extra Negrito</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Dados Cadastrais */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <FileText className="w-3 h-3" /> Dados Cadastrais
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Nome / Razão Social</label>
                <input 
                  type="text" 
                  value={settings.companyName}
                  onChange={e => setSettings({...settings, companyName: e.target.value})}
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded text-xs font-bold focus:bg-white transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Tipo de Cadastro</label>
                <select 
                  value={settings.type}
                  onChange={e => setSettings({...settings, type: e.target.value as 'PJ' | 'PF'})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded text-xs font-bold outline-none"
                >
                  <option value="PJ">PESSOA JURÍDICA (PJ)</option>
                  <option value="PF">PESSOA FÍSICA (PF)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">CPF / CNPJ</label>
                <input 
                  type="text" 
                  value={settings.taxId}
                  onChange={e => setSettings({...settings, taxId: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded text-xs font-bold outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Ramo de Atividade</label>
                <div className="relative">
                  <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input 
                    type="text" 
                    value={settings.businessSector}
                    onChange={e => setSettings({...settings, businessSector: e.target.value})}
                    placeholder="Ex: Tecnologia, Varejo..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded text-xs font-bold outline-none"
                  />
                </div>
                <button 
                  type="button"
                  onClick={handleGenerateSuggestions}
                  disabled={isGeneratingSuggestions || !settings.businessSector}
                  className="mt-3 flex items-center gap-2 text-[10px] font-bold text-brand-600 uppercase tracking-widest hover:text-brand-700 transition-colors disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isGeneratingSuggestions ? 'Modelando Fluxos...' : 'Sugerir Tarefas Mundiais'}
                </button>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">E-mail de Contato</label>
                <input 
                  type="email" 
                  value={settings.contactEmail}
                  onChange={e => setSettings({...settings, contactEmail: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded text-xs font-bold outline-none"
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Endereço e Contato */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Endereço & Localização</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Endereço Completo</label>
                <textarea 
                  value={settings.address}
                  onChange={e => setSettings({...settings, address: e.target.value})}
                  rows={2}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded text-xs font-bold outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Telefone Comercial</label>
                <input 
                  type="text" 
                  value={settings.phone}
                  onChange={e => setSettings({...settings, phone: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded text-xs font-bold outline-none"
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          <AnimatePresence>
            {suggestions.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 bg-blue-50/30 p-6 rounded-2xl border border-blue-100"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-[10px] font-black text-brand-600 uppercase tracking-[0.2em] flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5" /> Sugestões Estratégicas ({suggestions.length})
                    </h4>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Clique para editar ou use o botão para adicionar na fila</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                      <input 
                        type="text"
                        placeholder="BUSCAR NAS SUGESTÕES..."
                        value={suggestionSearch}
                        onChange={e => setSuggestionSearch(e.target.value)}
                        className="pl-8 pr-4 py-2 bg-white border border-slate-200 rounded text-[9px] font-bold uppercase tracking-widest outline-none w-48"
                      />
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setSuggestions([])}
                      className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter hover:text-red-500 transition-colors"
                    >
                      Descartar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <button 
                    type="button"
                    onClick={importAllTasks}
                    disabled={isImportingAll}
                    className="w-full py-3 bg-brand-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-brand-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-200"
                  >
                    {isImportingAll ? (
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Importar Todas ({suggestions.length}) para Minha Fila
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredSuggestions.map((task, idx) => {
                    const originalIdx = suggestions.findIndex(s => s === task);
                    return (
                      <motion.div 
                        key={originalIdx}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col justify-between group shadow-sm hover:border-brand-300 transition-all"
                      >
                        {editingIndex === originalIdx ? (
                          <div className="space-y-3">
                            <input 
                              type="text" 
                              value={task.title}
                              onChange={(e) => {
                                const newS = [...suggestions];
                                newS[originalIdx].title = e.target.value;
                                setSuggestions(newS);
                              }}
                              className="w-full px-2 py-1.5 text-[11px] font-bold uppercase bg-slate-50 border border-slate-200 rounded outline-none focus:ring-1 focus:ring-brand-500"
                            />
                            <textarea 
                              value={task.description}
                              onChange={(e) => {
                                const newS = [...suggestions];
                                newS[originalIdx].description = e.target.value;
                                setSuggestions(newS);
                              }}
                              rows={3}
                              className="w-full px-2 py-1.5 text-[10px] bg-slate-50 border border-slate-200 rounded outline-none focus:ring-1 focus:ring-brand-500 resize-none font-medium"
                            />
                            <button 
                              onClick={() => setEditingIndex(null)}
                              className="w-full py-1.5 bg-brand-600 text-white text-[9px] font-bold uppercase rounded shadow-sm hover:bg-brand-700 transition-colors"
                            >
                              Salvar Alterações
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="relative group/title cursor-text" onClick={() => setEditingIndex(originalIdx)}>
                              <h5 className="text-[11px] font-black text-slate-900 uppercase mb-1 flex items-center justify-between">
                                {task.title}
                                <Edit3 className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover/title:opacity-100 transition-opacity" />
                              </h5>
                              <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed font-medium">{task.description}</p>
                            </div>
                            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-50">
                              <button 
                                type="button"
                                onClick={() => confirmTask(task, originalIdx)}
                                className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-700 rounded-lg py-2 text-[9px] font-black uppercase tracking-widest hover:bg-brand-600 hover:text-white transition-all"
                              >
                                <Plus className="w-3 h-3" /> Adicionar
                              </button>
                              <button 
                                type="button"
                                onClick={() => setSuggestions(prev => prev.filter((_, i) => i !== originalIdx))}
                                className="px-3 py-2 text-slate-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="pt-6">
            <button 
              type="submit"
              disabled={saving}
              className="w-full md:w-auto px-8 py-4 bg-brand-600 text-white rounded font-bold text-xs uppercase tracking-widest shadow-xl hover:bg-brand-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Configurações Corporativas
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
