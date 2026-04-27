import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Clock, LogOut, CheckCircle, Save, Phone as PhoneIcon, User as UserIcon, MapPin, Info } from 'lucide-react';
import { useAuth } from '../../App';
import { UserStatus, Notification } from '../../types';
import { doc, updateDoc, serverTimestamp, addDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';

export default function AwaitingApproval() {
  const { user, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(!user?.phone || !user?.name);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
    bio: user?.bio || '',
  });
  
  const isBlocked = user?.status === UserStatus.BLOCKED;
  const isDeleted = user?.status === UserStatus.DELETED;

  const handleSaveRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isDeleted) return;
    setIsSaving(true);
    try {
      // Update user profile
      await updateDoc(doc(db, 'users', user.id), {
        ...formData,
        updatedAt: serverTimestamp()
      });

      // Notify all admins and managers
      const managersQuery = query(
        collection(db, 'users'),
        where('role', 'in', ['ADMIN', 'MANAGER'])
      );
      const managersSnapshot = await getDocs(managersQuery);
      
      const notificationPromises = managersSnapshot.docs.map(managerDoc => {
        return addDoc(collection(db, 'notifications'), {
          userId: managerDoc.id,
          title: 'Nova Solicitação de Acesso',
          message: `${formData.name} completou o cadastro e aguarda sua aprovação.`,
          type: 'SYSTEM',
          read: false,
          link: 'users',
          createdAt: serverTimestamp()
        });
      });

      await Promise.all(notificationPromises);
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[40px] shadow-2xl overflow-hidden border border-slate-100 flex flex-col"
      >
        <div className="bg-brand-600 p-10 flex flex-col items-center text-white relative shrink-0">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none overflow-hidden">
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-white rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white rounded-full blur-3xl animate-pulse delay-1000" />
          </div>
          
          <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 ring-4 ring-white/10 relative z-10">
            {isBlocked || isDeleted ? (
              <ShieldAlert className="w-10 h-10 text-white" />
            ) : (
              <Clock className="w-10 h-10 text-white animate-pulse" />
            )}
          </div>
          
          <h2 className="text-2xl font-black uppercase tracking-tight text-center relative z-10">
            {isBlocked ? 'Acesso Bloqueado' : isDeleted ? 'Conta Inativa' : isEditing ? 'Complete seu Cadastro' : 'Aguardando Aprovação'}
          </h2>
          <p className="text-brand-100 text-[10px] font-black uppercase tracking-[0.2em] mt-2 relative z-10">
            {isBlocked || isDeleted ? 'Segurança Corporativa' : 'Passo Obrigatório'}
          </p>
        </div>
        
        <div className="p-8 overflow-y-auto">
          {isEditing && !isBlocked && !isDeleted ? (
            <form onSubmit={handleSaveRegistration} className="space-y-6">
              <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest text-center mb-4">
                Olá {user?.name}, por favor valide seus dados para que a gerência possa liberar seu acesso.
              </p>
              
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      required
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold text-slate-900 focus:ring-4 focus:ring-brand-500/10 transition-all outline-none"
                      placeholder="Seu nome completo"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp / Telefone</label>
                  <div className="relative">
                    <PhoneIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      required
                      type="tel"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold text-slate-900 focus:ring-4 focus:ring-brand-500/10 transition-all outline-none"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Endereço (Cidade/Estado)</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text"
                      value={formData.address}
                      onChange={e => setFormData({...formData, address: e.target.value})}
                      className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold text-slate-900 focus:ring-4 focus:ring-brand-500/10 transition-all outline-none"
                      placeholder="Ex: São Paulo, SP"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Breve Bio / Cargo</label>
                  <div className="relative">
                    <Info className="absolute left-4 top-4 w-4 h-4 text-slate-400" />
                    <textarea 
                      value={formData.bio}
                      onChange={e => setFormData({...formData, bio: e.target.value})}
                      className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold text-slate-900 focus:ring-4 focus:ring-brand-500/10 transition-all outline-none min-h-[100px] resize-none"
                      placeholder="Conte um pouco sobre você ou seu cargo"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-brand-700 transition-all shadow-xl shadow-brand-500/20 active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : <Save className="w-4 h-4" />}
                Finalizar Cadastro
              </button>
            </form>
          ) : (
            <>
              <p className="text-slate-600 text-sm leading-relaxed mb-8 text-center">
                {isBlocked ? (
                  'Sua conta foi desativada por um administrador. Se você acredita que isso é um erro, entre em contato com o suporte da empresa.'
                ) : isDeleted ? (
                  'Sua conta foi removida do quadro de colaboradores ativos da empresa. Caso isso tenha sido um erro, entre em contato com seu gestor.'
                ) : (
                  'Olá, ' + user?.name + '! Seus dados foram enviados com sucesso. Agora um Administrador ou Gerente precisa revisar e liberar seu acesso.'
                )}
              </p>

              {!isBlocked && !isDeleted && (
                <div className="bg-emerald-50 rounded-3xl p-6 mb-8 flex items-start gap-4 text-left border border-emerald-100">
                  <div className="shrink-0 w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-emerald-900 font-black text-[10px] uppercase tracking-widest">O que acontece agora?</h4>
                    <p className="text-emerald-700/70 text-[10px] font-bold leading-relaxed mt-1 tracking-tight">
                      Os gestores foram notificados via sistema. Assim que aprovarem, você terá acesso imediato às ferramentas de produtividade.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-brand-700 transition-all shadow-xl shadow-brand-500/20 active:scale-95"
                >
                  Verificar Status
                </button>
                <button
                  onClick={logout}
                  className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <LogOut className="w-4 h-4" />
                  Sair da Conta
                </button>
              </div>
            </>
          )}
        </div>
        
        <div className="bg-slate-50 p-6 border-t border-slate-100 mt-auto">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-center italic">
            Sweet Ice PRO • Segurança Garantida
          </p>
        </div>
      </motion.div>
    </div>
  );
}
