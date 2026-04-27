import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, addDoc, where, getDocs, orderBy, getDoc } from 'firebase/firestore';
import { GoogleAuthProvider, getAdditionalUserInfo, reauthenticateWithPopup } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { User, UserRole, UserStatus, UserRoleLabels, UserStatusLabels, CompanySettings } from '../../types';
import { 
  Users, 
  Search, 
  UserCheck, 
  UserMinus, 
  UserX, 
  Trash2, 
  Mail,
  Shield,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  UserCog,
  Phone,
  MessageCircle,
  MapPin,
  ShieldX,
  Edit2,
  UserPlus,
  Share2,
  X,
  Copy,
  ChevronRight,
  ExternalLink,
  Globe,
  Settings as SettingsIcon,
  Save,
  Loader2,
  Send,
  CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../App';
import UserProfile from '../settings/UserProfile';

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const { user: currentUser, effectiveRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'BLOCKED'>('ALL');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteMethod, setInviteMethod] = useState<'EMAIL' | 'PHONE'>('EMAIL');
  const [inviteRole, setInviteRole] = useState<UserRole>(UserRole.USER);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [lastInviteData, setLastInviteData] = useState<{ email?: string; phone?: string } | null>(null);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [editingUrl, setEditingUrl] = useState(false);
  const [customSystemUrl, setCustomSystemUrl] = useState('');
  const [isSavingUrl, setIsSavingUrl] = useState(false);
  const [isEmailing, setIsEmailing] = useState<string | null>(null);

  const isManagerOrAdmin = effectiveRole === UserRole.ADMIN || effectiveRole === UserRole.MANAGER;

  useEffect(() => {
    if (!isManagerOrAdmin) return;

    // Fetch company settings for systemUrl
    const unsubCompany = onSnapshot(doc(db, 'settings', 'company'), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as CompanySettings;
        setCompany(data);
        if (data.systemUrl) {
          setCustomSystemUrl(data.systemUrl);
        }
      }
    });

    const qInvitations = query(collection(db, 'invitations'), where('status', '==', 'PENDING'));
    const unsubInv = onSnapshot(qInvitations, (snapshot) => {
      const invs: any[] = [];
      snapshot.forEach(doc => invs.push({ id: doc.id, ...doc.data() }));
      setInvitations(invs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'invitations');
    });

    const qUsers = query(collection(db, 'users'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(qUsers, (snapshot) => {
      const usersData: User[] = [];
      snapshot.forEach((doc) => {
        usersData.push({ ...doc.data(), id: doc.id } as User);
      });
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    return () => {
      unsubInv();
      unsubscribe();
      unsubCompany();
    };
  }, []);

  const getEffectiveOrigin = () => {
    // If we have a custom URL in database, use it
    if (company?.systemUrl) return company.systemUrl;
    
    // Fallback to window origin, but exclude studio.google.com
    let origin = window.location.origin;
    if (origin.includes('studio.google.com')) {
      return ''; // Force user to provide one if in editor
    }

    // AI Studio specific: Dev URLs (ais-dev-) are project-private. 
    // Shared URLs (ais-pre-) are accessible by invitees.
    if (origin.includes('ais-dev-')) {
      return origin.replace('ais-dev-', 'ais-pre-');
    }
    
    return origin;
  };

  const handleSaveSystemUrl = async () => {
    if (!customSystemUrl || !isManagerOrAdmin) return;
    setIsSavingUrl(true);
    try {
      let url = customSystemUrl.trim();
      if (url.endsWith('/')) url = url.slice(0, -1);
      if (!url.startsWith('http')) url = 'https://' + url;

      await updateDoc(doc(db, 'settings', 'company'), {
        systemUrl: url,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.id
      });
      setEditingUrl(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/company');
    } finally {
      setIsSavingUrl(false);
    }
  };

  useEffect(() => {
    const handleNavInvite = () => setShowInviteModal(true);
    window.addEventListener('nav-to-users-invite', handleNavInvite);
    return () => window.removeEventListener('nav-to-users-invite', handleNavInvite);
  }, []);

  const handleUpdateStatus = async (userId: string, newStatus: UserStatus) => {
    if (userId === currentUser?.id) return;
    
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    if (userId === currentUser?.id) return;
    
    // Security check: only Admins can promote to Admin or touch other Admins
    const targetUser = users.find(u => u.id === userId);
    const isTargetAdmin = targetUser?.role === UserRole.ADMIN;
    const isCurrentUserAdmin = effectiveRole === UserRole.ADMIN;

    if (isTargetAdmin && !isCurrentUserAdmin) {
      alert('Apenas Administradores podem modificar outros Administradores.');
      return;
    }

    if (newRole === UserRole.ADMIN && !isCurrentUserAdmin) {
      alert('Apenas Administradores podem promover outros usuários a Administrador.');
      return;
    }
    
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUser?.id) return;

    const targetUser = users.find(u => u.id === userId);
    const isTargetAdmin = targetUser?.role === UserRole.ADMIN;
    const isCurrentUserAdmin = effectiveRole === UserRole.ADMIN;

    if (isTargetAdmin && !isCurrentUserAdmin) {
      alert('Apenas Administradores podem excluir outros Administradores.');
      return;
    }

    if (!window.confirm('Tem certeza que deseja excluir esta conta? O histórico do colaborador será mantido no sistema para fins de auditoria e relatórios, mas ele não poderá mais acessar o sistema.')) return;

    try {
      await updateDoc(doc(db, 'users', userId), {
        status: UserStatus.DELETED,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleDeleteInvitation = async (invId: string) => {
    if (!window.confirm('Deseja realmente cancelar este convite? Esta ação é irreversível.')) return;
    try {
      console.log('Iniciando exclusão de convite:', invId);
      const docRef = doc(db, 'invitations', invId);
      await deleteDoc(docRef);
      console.log('Convite excluído com sucesso');
    } catch (error: any) {
      console.error('Erro detalhado ao excluir convite:', error);
      if (error.code === 'permission-denied') {
        alert('Erro: Você não tem permissão para excluir este convite em produção.');
      } else {
        alert(`Erro ao excluir convite: ${error.message || 'Erro desconhecido'}`);
      }
      handleFirestoreError(error, OperationType.DELETE, `invitations/${invId}`);
    }
  };

  const generateInvitationText = (identifier: string, link: string, method: 'EMAIL' | 'PHONE') => {
    const label = method === 'EMAIL' ? 'E-MAIL' : 'TELEFONE';
    return `Olá!\n\nVocê foi convidado para a equipe Sweet Ice PRO.\n\nEste convite é exclusivo para seu ${label}: ${identifier}\n\nPara entrar no sistema, use o Link do App Web abaixo:\n${link}\n\nO sistema identificará seu acesso automaticamente e você poderá completar seu perfil.\n\nSeja bem-vindo(a)!`;
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleShareWhatsApp = (identifier: string, link: string, method: 'EMAIL' | 'PHONE') => {
    const text = generateInvitationText(identifier, link, method);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShareEmail = async (email: string, link: string) => {
    setIsEmailing(email);
    try {
      const authUser: any = auth.currentUser;
      if (!authUser) throw new Error('Usuário não autenticado');

      // Check if we have an access token with Gmail scope
      // Firebase doesn't persist the Google access token in the auth object for the web SDK
      // We might need to re-prompt or use a stored credential if we implemented that.
      // However, for this environment, we'll try to use the auth credential if available.
      
      // Since standard Firebase Web SDK doesn't store the access token, 
      // we'll implement a fallback to mailto if direct send fails or token is missing.
      
      const subject = 'Convite de Segurança - Sweet Ice PRO';
      const body = generateInvitationText(email, link, 'EMAIL');

      // We'll use a specialized function for Gmail API
      const sent = await sendGmailDirect(email, subject, body);
      
      if (sent) {
        alert(`Convite enviado com sucesso para ${email} via Gmail.`);
      } else {
        // Fallback to mailto
        window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      }
    } catch (error) {
      console.error('Error sharing email:', error);
      // Fallback
      const subject = 'Convite de Segurança - Sweet Ice PRO';
      const body = generateInvitationText(email, link, 'EMAIL');
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } finally {
      setIsEmailing(null);
    }
  };

  const sendGmailDirect = async (to: string, subject: string, body: string) => {
    try {
      // Try to get cached token first
      let token = sessionStorage.getItem('google_access_token');
      
      if (!token) {
        const googleProvider = (auth.currentUser as any)?.providerData.find((p: any) => p.providerId === 'google.com');
        if (!googleProvider) return false;

        const provider = new GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/gmail.send');
        
        const result = await reauthenticateWithPopup(auth.currentUser!, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        token = credential?.accessToken || null;
        
        if (token) {
          sessionStorage.setItem('google_access_token', token);
        }
      }

      if (!token) return false;

      // Prepare RFC822 message
      const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
      const messageParts = [
        `To: ${to}`,
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${utf8Subject}`,
        '',
        body,
      ];
      const message = messageParts.join('\n');

      // The Gmail API requires base64url encoding
      const encodedMessage = btoa(unescape(encodeURIComponent(message)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw: encodedMessage,
        }),
      });

      return response.ok;
    } catch (e) {
      console.error('Gmail direct send failed:', e);
      return false;
    }
  };

  const handleCreateInvitation = async () => {
    let identifier = inviteMethod === 'EMAIL' ? inviteEmail : invitePhone;
    if (!identifier || !isManagerOrAdmin) return;
    
    // Check if invitation already exists for this identifier and is still PENDING
    const existingInvite = invitations.find(inv => 
      (inviteMethod === 'EMAIL' && inv.email === identifier.toLowerCase().trim()) ||
      (inviteMethod === 'PHONE' && inv.phone === (identifier.startsWith('+') ? identifier : `+55${identifier.replace(/\D/g, '')}`))
    );

    if (existingInvite) {
      alert(`Já existe um convite pendente para este ${inviteMethod === 'EMAIL' ? 'e-mail' : 'telefone'}.`);
      return;
    }

    // Check if user already exists
    const existingUser = users.find(u => 
      (inviteMethod === 'EMAIL' && u.email === identifier.toLowerCase().trim()) ||
      (inviteMethod === 'PHONE' && u.phone === (identifier.startsWith('+') ? identifier : `+55${identifier.replace(/\D/g, '')}`))
    );

    if (existingUser) {
      alert('Controle de Acesso: Este colaborador já possui uma conta ativa no sistema.');
      return;
    }

    // Automatic +55 prefix for phone
    if (inviteMethod === 'PHONE' && !identifier.startsWith('+')) {
      let cleanPhone = identifier.replace(/\D/g, '');
      if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1);
      identifier = `+55${cleanPhone}`;
    }

    setIsSendingInvite(true);
    try {
      const inviteData: any = {
        authMethod: inviteMethod,
        role: inviteRole,
        invitedBy: currentUser?.id,
        createdAt: serverTimestamp(),
        status: 'PENDING'
      };

      if (inviteMethod === 'EMAIL') {
        inviteData.email = inviteEmail.toLowerCase().trim();
      } else {
        inviteData.phone = identifier;
      }

      const docRef = await addDoc(collection(db, 'invitations'), inviteData);

      const base = getEffectiveOrigin() || window.location.origin;
      const secureLink = `${base}?inviteId=${docRef.id}`;
      setLastInviteLink(secureLink);
      setLastInviteData({ email: inviteEmail, phone: identifier });

      await addDoc(collection(db, 'auditLogs'), {
        userId: currentUser?.id,
        action: 'INVITATION_CREATED',
        details: `Convidou ${identifier} via ${inviteMethod} com cargo ${UserRoleLabels[inviteRole]}`,
        createdAt: serverTimestamp()
      });

      // Clear fields on success
      if (inviteMethod === 'EMAIL') setInviteEmail('');
      else setInvitePhone('');

    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'invitations');
    } finally {
      setIsSendingInvite(false);
    }
  };

  const filteredUsers = users
    .filter(u => {
      // Always exclude deleted users from the management list
      if (u.status === UserStatus.DELETED) return false;

      const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           u.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTab = activeTab === 'ALL' || 
                        (activeTab === 'PENDING' && u.status === UserStatus.PENDING) ||
                        (activeTab === 'BLOCKED' && u.status === UserStatus.BLOCKED);
      return matchesSearch && matchesTab;
    })
    .sort((a, b) => {
      // Prioritize pending approval at the top
      if (a.status === UserStatus.PENDING && b.status !== UserStatus.PENDING) return -1;
      if (a.status !== UserStatus.PENDING && b.status === UserStatus.PENDING) return 1;
      return 0;
    });

  if (!isManagerOrAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6">
          <ShieldX className="w-10 h-10 text-rose-500" />
        </div>
        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Acesso Restrito</h3>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest max-w-xs">Esta área é restrita para Administradores e Gerentes do sistema.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20">
        <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-6" />
        <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">Sincronizando Base de Usuários...</p>
      </div>
    );
  }

  if (editingUserId) {
    const targetUser = users.find(u => u.id === editingUserId);
    return (
      <UserProfile 
        targetUser={targetUser} 
        onBack={() => setEditingUserId(null)} 
        onDelete={async (id) => {
          await handleDeleteUser(id);
          setEditingUserId(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="bg-white p-4 sm:p-6 rounded-[2rem] shadow-xl shadow-slate-200/40 border border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-6 overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Shield className="w-32 h-32" />
        </div>
        
        <div className="relative z-10 flex items-center gap-4">
          <div className="p-2.5 bg-brand-600 rounded-xl shadow-lg shadow-brand-500/20 shrink-0">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Equipe & Acessos</h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.1em] mt-0.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Gestão Ativa
            </p>
          </div>
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row gap-3 text-white">
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20 active:scale-95 whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            Convidar Membro
          </button>
          
          <div className="relative group lg:min-w-[300px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-brand-600 transition-colors" />
            <input 
              type="text"
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold w-full focus:ring-2 focus:ring-brand-500/10 transition-all outline-none text-slate-900"
            />
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-50 rounded-xl border border-slate-100 overflow-x-auto scrollbar-none">
            {[
              { id: 'ALL', icon: Users, label: 'Todos' },
              { id: 'PENDING', icon: Clock, label: 'Pendentes' },
              { id: 'BLOCKED', icon: UserX, label: 'Bloqueados' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "p-1.5 rounded-lg transition-all flex items-center justify-center gap-2 px-3 shrink-0",
                  activeTab === tab.id ? "bg-white shadow-sm text-brand-600 ring-1 ring-slate-200 font-bold" : "text-slate-400 hover:text-slate-600 font-bold"
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-wider">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Pending Users Notification Strip */}
      {users.some(u => u.status === UserStatus.PENDING) && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-amber-50 border-2 border-amber-200 p-4 rounded-3xl flex items-center justify-between gap-4 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-400 rounded-2xl flex items-center justify-center animate-bounce">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs font-black text-amber-900 uppercase tracking-tight">Solicitações de Acesso Pendentes</p>
              <p className="text-[10px] font-bold text-amber-700/70 uppercase tracking-widest">Existem novos membros aguardando liberação do sistema</p>
            </div>
          </div>
          <button 
            onClick={() => setActiveTab('PENDING')}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 active:scale-95"
          >
            Ver Solicitações
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredUsers.map((u) => (
            <motion.div
              key={u.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "bg-white rounded-[40px] p-8 shadow-sm border-2 transition-all flex flex-col group relative overflow-hidden",
                u.status === UserStatus.PENDING ? "border-amber-400 ring-4 ring-amber-400/5 bg-amber-50/20" : 
                u.status === UserStatus.BLOCKED ? "border-slate-100 bg-slate-50/50 grayscale" : "border-slate-50 hover:border-brand-100 hover:shadow-2xl hover:shadow-brand-500/5"
              )}
            >
              {u.status === UserStatus.PENDING && (
                <div className="absolute top-0 right-0 px-6 py-2 bg-amber-400 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-bl-3xl">
                  Ação Necessária
                </div>
              )}

              <div className="flex items-center gap-5 mb-8">
                <div className="relative">
                  <div className="w-16 h-16 rounded-[24px] bg-brand-50 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg ring-1 ring-slate-100 font-black text-brand-700 text-2xl group-hover:scale-105 transition-transform">
                    {u.profilePic ? (
                      <img src={u.profilePic} alt={u.name} className="w-full h-full object-cover" />
                    ) : (
                      u.name?.charAt(0) || '?'
                    )}
                  </div>
                  <div className={cn(
                    "absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-lg",
                    u.status === UserStatus.APPROVED ? "bg-emerald-500" : 
                    u.status === UserStatus.PENDING ? "bg-amber-500" : "bg-rose-500"
                  )}>
                    {u.status === UserStatus.APPROVED ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : 
                     u.status === UserStatus.PENDING ? <Clock className="w-3.5 h-3.5 text-white" /> : <AlertCircle className="w-3.5 h-3.5 text-white" />}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between font-black uppercase">
                    <div className="flex flex-col min-w-0">
                      <h3 className="text-base font-black text-slate-900 uppercase tracking-tight truncate leading-tight">{u.name || 'Sem Nome'}</h3>
                      {!u.isProfileComplete && u.status === UserStatus.APPROVED && (
                        <span className="text-[8px] text-amber-600 font-black uppercase flex items-center gap-1 mt-0.5">
                          <AlertCircle className="w-2.5 h-2.5" />
                          Perfil Incompleto
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => setEditingUserId(u.id)}
                        className="p-2 text-slate-300 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all"
                        title="Editar Perfil Completo"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {u.id !== currentUser?.id && (
                        <button 
                          onClick={() => handleDeleteUser(u.id)}
                          className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="Excluir Membro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 p-1 bg-slate-50 rounded-lg w-fit">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-500 lowercase truncate max-w-[140px]">{u.email}</span>
                  </div>
                  {u.phone && (
                    <div className="flex items-center gap-2 mt-1 p-1 bg-emerald-50 rounded-lg w-fit group/wa transition-colors hover:bg-emerald-100">
                      <Phone className="w-3 h-3 text-emerald-500" />
                      <a 
                        href={`https://wa.me/${u.phone.replace(/\D/g, '')}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold text-emerald-600 truncate max-w-[140px] hover:underline"
                      >
                        {u.phone}
                      </a>
                      <MessageCircle className="w-3 h-3 text-emerald-400 opacity-0 group-hover/wa:opacity-100 transition-opacity" />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between mb-3 border-b-2 border-slate-200 pb-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <ShieldCheck className="w-3 h-3" />
                      Permissão de Sistema
                    </span>
                  </div>
                  <select 
                    disabled={u.id === currentUser?.id}
                    value={u.role}
                    onChange={(e) => handleUpdateRole(u.id, e.target.value as UserRole)}
                    className="w-full bg-transparent text-[11px] font-black text-slate-900 uppercase tracking-widest focus:outline-none disabled:opacity-50 appearance-none cursor-pointer"
                  >
                    {Object.entries(UserRoleLabels).map(([role, label]) => (
                      <option key={role} value={role}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                      <UserCog className="w-3 h-3" />
                      Status Atual
                    </span>
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-[0.1em]",
                      u.status === UserStatus.APPROVED ? "text-emerald-600" : 
                      u.status === UserStatus.PENDING ? "text-amber-600" : "text-rose-600"
                    )}>
                      {UserStatusLabels[u.status]}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {u.id !== currentUser?.id && (
                      <>
                        <button 
                          onClick={() => handleUpdateStatus(u.id, UserStatus.APPROVED)}
                          className={cn(
                            "p-2 rounded-xl transition-all",
                            u.status === UserStatus.APPROVED ? "bg-emerald-100 text-emerald-600" : "hover:bg-white text-slate-300 hover:text-emerald-500"
                          )}
                          title="Aprovar"
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleUpdateStatus(u.id, UserStatus.BLOCKED)}
                          className={cn(
                            "p-2 rounded-xl transition-all",
                            u.status === UserStatus.BLOCKED ? "bg-rose-100 text-rose-600" : "hover:bg-white text-slate-300 hover:text-rose-500"
                          )}
                          title="Bloquear"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-auto flex flex-col gap-3">
                {u.status === UserStatus.PENDING ? (
                  <button
                    onClick={() => handleUpdateStatus(u.id, UserStatus.APPROVED)}
                    className="w-full flex items-center justify-center gap-3 py-3 bg-emerald-500 text-white rounded-3xl text-xs font-black uppercase tracking-wider hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Aprovar Agora
                  </button>
                ) : (
                  <div className="flex gap-2">
                    {u.id !== currentUser?.id && (
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="flex-1 flex items-center justify-center gap-3 py-3 bg-slate-100 text-slate-400 rounded-3xl text-xs font-black uppercase tracking-wider hover:bg-rose-50 hover:text-rose-500 transition-all active:scale-95"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remover
                      </button>
                    )}
                    {u.status === UserStatus.BLOCKED ? (
                      <button
                        onClick={() => handleUpdateStatus(u.id, UserStatus.APPROVED)}
                        className="flex-1 py-3 bg-emerald-50 text-emerald-600 rounded-3xl text-xs font-black uppercase tracking-wider hover:bg-emerald-100 transition-all active:scale-95 font-black uppercase"
                      >
                        Desbloquear
                      </button>
                    ) : u.id !== currentUser?.id && (
                      <button
                        onClick={() => handleUpdateStatus(u.id, UserStatus.BLOCKED)}
                        className="flex-1 py-3 bg-rose-50 text-rose-500 rounded-3xl text-xs font-black uppercase tracking-wider hover:bg-rose-100 transition-all active:scale-95 font-black uppercase"
                      >
                        Bloquear
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredUsers.length === 0 && (
          <div className="col-span-full bg-white rounded-[40px] p-24 text-center border-2 border-dashed border-slate-100">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 font-black uppercase">
              <Users className="w-10 h-10 text-slate-200" />
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Nenhum Usuário Encontrado</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tente buscar por outro nome ou mudar o filtro</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showInviteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInviteModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[40px] shadow-2xl border border-slate-100 w-full max-w-[420px] overflow-hidden relative z-10"
            >
              <div className="bg-brand-600 p-8 flex flex-col items-center text-white">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 ring-4 ring-white/10">
                  <UserPlus className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight">Convite de Equipe</h2>
                <p className="text-brand-100 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">Segurança em Primeiro Lugar</p>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-6">
                  {!lastInviteLink ? (
                    <div className="space-y-6">
                      <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200">
                        <button
                          onClick={() => setInviteMethod('EMAIL')}
                          className={cn(
                            "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            inviteMethod === 'EMAIL' ? "bg-white text-brand-600 shadow-sm" : "text-slate-400"
                          )}
                        >
                          E-mail
                        </button>
                        <button
                          onClick={() => setInviteMethod('PHONE')}
                          className={cn(
                            "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            inviteMethod === 'PHONE' ? "bg-white text-brand-600 shadow-sm" : "text-slate-400"
                          )}
                        >
                          Telefone
                        </button>
                      </div>

                      <div className="space-y-4 p-6 bg-slate-50 rounded-[32px] border border-slate-100">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            {inviteMethod === 'EMAIL' ? 'Identificação por E-mail' : 'Identificação por WhatsApp'}
                          </label>
                          {inviteMethod === 'EMAIL' ? (
                            <div className="relative group">
                              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-brand-600 transition-colors" />
                              <input 
                                type="email"
                                placeholder="colaborador@empresa.com"
                                value={inviteEmail}
                                onChange={e => setInviteEmail(e.target.value)}
                                className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-brand-500/10 outline-none transition-all"
                              />
                            </div>
                          ) : (
                            <div className="relative group">
                              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black">
                                +55
                              </div>
                              <input 
                                id="invite-phone-input-modal"
                                type="tel"
                                placeholder="(00) 00000-0000"
                                value={invitePhone.startsWith('+55') ? invitePhone.substring(3) : invitePhone}
                                onChange={e => setInvitePhone(e.target.value)}
                                className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-brand-500/10 outline-none transition-all"
                              />
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cargo no Sistema</label>
                          <div className="relative group">
                            <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-brand-600 transition-colors pointer-events-none" />
                            <select
                              value={inviteRole}
                              onChange={e => setInviteRole(e.target.value as UserRole)}
                              className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest outline-none appearance-none cursor-pointer focus:ring-4 focus:ring-brand-500/10 transition-all"
                            >
                              {Object.entries(UserRoleLabels)
                                .filter(([role]) => effectiveRole === UserRole.ADMIN || role !== UserRole.ADMIN)
                                .map(([role, label]) => (
                                <option key={role} value={role}>{label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* App Web URL Config */}
                        <div className="space-y-2 pt-2 border-t border-slate-200/60 mt-2 text-center">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                            <Globe className="w-3 h-3" />
                            Ponto de Acesso Web
                          </label>
                          
                          {editingUrl ? (
                            <div className="flex gap-2">
                              <input 
                                type="url"
                                placeholder="https://seu-dominio.com"
                                value={customSystemUrl}
                                onChange={e => setCustomSystemUrl(e.target.value)}
                                className="flex-1 px-4 py-2 bg-white border border-brand-200 rounded-xl text-[10px] font-bold focus:ring-2 focus:ring-brand-500/10 outline-none"
                              />
                              <button
                                onClick={handleSaveSystemUrl}
                                disabled={isSavingUrl || !customSystemUrl}
                                className="p-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-all"
                              >
                                {isSavingUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => setEditingUrl(true)}
                              className={cn(
                                "group w-full px-4 py-3 rounded-2xl text-[9px] font-black flex items-center justify-center gap-2 transition-all uppercase tracking-widest border",
                                getEffectiveOrigin().includes('studio.google.com') || !getEffectiveOrigin()
                                  ? "bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100"
                                  : "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100"
                              )}
                            >
                              <span className="truncate flex-1">{getEffectiveOrigin() || 'Link Não Configurado'}</span>
                              <Edit2 className="w-3 h-3 transition-transform group-hover:scale-110" />
                            </button>
                          )}

                          {(getEffectiveOrigin().includes('studio.google.com') || !getEffectiveOrigin()) && (
                            <p className="text-[8px] text-rose-500 font-extrabold uppercase mt-1 px-2 leading-relaxed">
                              ⚠️ configure um domínio válido para convites via whatsapp
                            </p>
                          )}
                        </div>
                        
                        <button
                          onClick={handleCreateInvitation}
                          disabled={(inviteMethod === 'EMAIL' ? !inviteEmail : !invitePhone) || isSendingInvite}
                          className="w-full py-5 bg-brand-600 text-white rounded-[24px] text-[11px] font-black uppercase tracking-[0.2em] hover:bg-brand-700 disabled:opacity-50 transition-all flex items-center justify-center gap-3 shadow-xl shadow-brand-500/20 active:scale-95"
                        >
                          {isSendingInvite ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                          Gerar Convite Seguro
                        </button>
                      </div>
                    </div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="space-y-6"
                    >
                      <div className="bg-emerald-50 border-2 border-emerald-200 p-8 rounded-[40px] text-center shadow-lg shadow-emerald-500/5">
                        <div className="w-16 h-16 bg-emerald-500 rounded-[28px] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/20">
                          <CheckCircle2 className="w-8 h-8 text-white" />
                        </div>
                        <h4 className="text-sm font-black text-emerald-900 uppercase tracking-tight mb-2">Convite Criado</h4>
                        <p className="text-[10px] font-bold text-emerald-700/70 uppercase leading-relaxed max-w-[200px] mx-auto">
                          Acesso pré-autorizado para {lastInviteData?.email || lastInviteData?.phone}
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => handleShareWhatsApp(inviteMethod === 'EMAIL' ? inviteEmail : invitePhone, lastInviteLink, inviteMethod)}
                          className="flex flex-col items-center justify-center gap-3 p-6 bg-slate-50 rounded-[32px] border-2 border-slate-100 hover:border-emerald-200 hover:bg-emerald-50 transition-all group active:scale-95"
                        >
                          <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/10 group-hover:scale-110 transition-transform">
                            <MessageCircle className="w-6 h-6 text-white" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">WhatsApp</span>
                        </button>
                        
                        <button
                          onClick={() => handleCopyLink(lastInviteLink)}
                          className="flex flex-col items-center justify-center gap-3 p-6 bg-slate-50 rounded-[32px] border-2 border-slate-100 hover:border-brand-200 hover:bg-brand-50 transition-all group active:scale-95"
                        >
                          <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-500/10 group-hover:scale-110 transition-transform">
                            <Copy className="w-6 h-6 text-white" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">Copiar Link</span>
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          setLastInviteLink(null);
                          setInviteEmail('');
                          setInvitePhone('');
                        }}
                        className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors"
                      >
                        Gerar novo convite
                      </button>
                    </motion.div>
                  )}

                  {invitations.length > 0 && !lastInviteLink && (
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between px-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pendentes de Envio</p>
                        <span className="px-2 py-0.5 bg-brand-50 text-brand-600 text-[9px] font-black rounded-lg uppercase">{invitations.length}</span>
                      </div>
                      <div className="max-h-[220px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                        {invitations.map(inv => {
                          const base = getEffectiveOrigin() || window.location.origin;
                          const fullLink = `${base}?inviteId=${inv.id}`;
                          return (
                            <div key={inv.id} className="group p-4 bg-slate-50 rounded-[24px] border border-slate-100 hover:border-brand-100 hover:bg-white transition-all shadow-sm hover:shadow-xl hover:shadow-brand-500/5">
                              <div className="flex items-center justify-between gap-4 mb-4">
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-black text-slate-900 truncate mb-1">{inv.email || inv.phone}</p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black bg-brand-50 text-brand-600 px-2 py-0.5 rounded-lg uppercase tracking-tighter">{UserRoleLabels[inv.role as UserRole]}</span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">• {inv.authMethod}</span>
                                  </div>
                                </div>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    handleDeleteInvitation(inv.id);
                                  }}
                                  className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                  title="Excluir Convite"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => handleCopyLink(fullLink)}
                                  className="flex-1 py-2.5 bg-white text-slate-500 border border-slate-200 rounded-xl text-[9px] font-black uppercase hover:bg-slate-50 transition-all font-sans"
                                >
                                  Copiar Link
                                </button>
                                <button 
                                  onClick={() => {
                                    if (inv.authMethod === 'EMAIL') {
                                      handleShareEmail(inv.email, fullLink);
                                    } else {
                                      handleShareWhatsApp(inv.phone, fullLink, 'PHONE');
                                    }
                                  }}
                                  disabled={isEmailing === (inv.email || inv.phone)}
                                  className="flex-1 py-2.5 bg-brand-600 text-white rounded-xl text-[9px] font-black uppercase hover:bg-brand-700 transition-all flex items-center justify-center gap-2"
                                >
                                  {isEmailing === (inv.email || inv.phone) ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : inv.authMethod === 'EMAIL' ? (
                                    <Send className="w-3.5 h-3.5" />
                                  ) : (
                                    <MessageCircle className="w-3.5 h-3.5" />
                                  )}
                                  {inv.authMethod === 'EMAIL' ? 'Enviar E-mail' : 'Enviar WhatsApp'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[9px] text-slate-400 font-bold text-center px-4 leading-relaxed uppercase tracking-tighter italic">
                        Links seguros e exclusivos para o destinatário
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95 shadow-lg shadow-slate-900/10"
                  >
                    Fechar Gerenciador
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
