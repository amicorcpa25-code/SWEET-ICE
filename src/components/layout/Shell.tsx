import React, { useState, useEffect } from 'react';
import { useAuth } from '../../App';
import Dashboard from '../dashboard/Dashboard';
import MyTasks from '../tasks/MyTasks';
import TaskManager from '../tasks/TaskManager';
import TaskAssignment from '../tasks/TaskAssignment';
import ChatSection from '../chat/ChatSection';
import UserManagement from '../users/UserManagement';
import Settings from '../settings/Settings';
import Reports from '../reports/Reports';
import AuditLogs from '../admin/AuditLogs';
import ManagerManual from '../manual/ManagerManual';
import ThemeCustomizer from './ThemeCustomizer';
import RoleSwitcher from './RoleSwitcher';
import { ALL_MENU_ITEMS } from '../../constants/menu';
import { 
  LogOut,
  Bell,
  Menu,
  X,
  CheckCircle2,
  ArrowUp,
  UserPlus,
  BookOpen
} from 'lucide-react';
import { UserRole, CompanySettings, UserRoleLabels, Notification } from '../../types';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { doc, onSnapshot, query, collection, where, orderBy, limit, updateDoc, writeBatch, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

type View = 'dashboard' | 'my-tasks' | 'profile' | 'tasks' | 'assignments' | 'chat' | 'users' | 'settings' | 'reports' | 'manual' | 'audit-logs';

export default function Shell() {
  const { user, logout, effectiveRole, setImpersonatedRole } = useAuth();
  const [activeView, setActiveView] = useState<View>('my-tasks');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.id),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsub = onSnapshot(q, (s) => {
      setNotifications(s.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
    });

    return () => unsub();
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const [pendingUsersCount, setPendingUsersCount] = useState(0);

  useEffect(() => {
    if (!user || (effectiveRole !== UserRole.ADMIN && effectiveRole !== UserRole.MANAGER)) return;
    
    const q = query(
      collection(db, 'users'),
      where('status', '==', 'PENDING')
    );

    const unsub = onSnapshot(q, (s) => {
      setPendingUsersCount(s.size);
    });

    return () => unsub();
  }, [user, effectiveRole]);

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    const batch = writeBatch(db);
    unread.forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    await batch.commit();
  };

  const clearNotifications = async () => {
    const batch = writeBatch(db);
    notifications.forEach(n => {
      batch.delete(doc(db, 'notifications', n.id));
    });
    await batch.commit();
  };

  const navigateToChat = (chatId: string) => {
    setActiveChatId(chatId);
    setActiveView('chat');
  };
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const mainSection = document.getElementById('main-content-section');
    if (!mainSection) return;

    const handleScroll = () => {
      setShowScrollTop(mainSection.scrollTop > 300);
    };

    mainSection.addEventListener('scroll', handleScroll);
    return () => mainSection.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    const mainSection = document.getElementById('main-content-section');
    if (mainSection) {
      mainSection.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    // Listen to company settings
    const unsub = onSnapshot(doc(db, 'settings', 'company'), (doc) => {
      if (doc.exists()) {
        setCompany(doc.data() as CompanySettings);
      }
    }, (error) => {
      // Gracefully handle permission errors for company settings
      console.warn("Company settings listener failed:", error);
    });
    return () => unsub();
  }, []);

  const menuItems = ALL_MENU_ITEMS.map(item => {
    if (item.id === 'chat') {
      return {
        ...item,
        badge: notifications.filter(n => !n.read && n.type === 'CHAT').length
      };
    }
    if (item.id === 'users') {
      return {
        ...item,
        badge: pendingUsersCount
      };
    }
    return item;
  });

  const currentMenuItems = menuItems
    .filter(item => {
      if (!effectiveRole) return false;
      return item.roles.includes(effectiveRole as UserRole);
    })
    .sort((a, b) => {
      if (!company?.menuOrder) return 0;
      const indexA = company.menuOrder.indexOf(a.id);
      const indexB = company.menuOrder.indexOf(b.id);
      
      // If item not in order list, push to end
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      
      return indexA - indexB;
    });

  const getFontSize = (size?: string) => {
    switch(size) {
      case 'xs': return '12px';
      case 'sm': return '14px';
      case 'lg': return '18px';
      default: return '16px';
    }
  };

  const getFontWeight = (weight?: string) => {
    switch(weight) {
      case 'medium': return '500';
      case 'bold': return '700';
      case 'black': return '900';
      default: return '400';
    }
  };

  useEffect(() => {
    const handleNavInvite = () => setActiveView('users');
    window.addEventListener('nav-to-users-invite', handleNavInvite);
    return () => window.removeEventListener('nav-to-users-invite', handleNavInvite);
  }, []);

  const [lastNotificationCount, setLastNotificationCount] = useState(0);
  const [showToast, setShowToast] = useState<Notification | null>(null);

  useEffect(() => {
    if (unreadCount > lastNotificationCount) {
      const latest = notifications.find(n => !n.read);
      if (latest) {
        setShowToast(latest);
        setTimeout(() => setShowToast(null), 5000);
      }
    }
    setLastNotificationCount(unreadCount);
  }, [unreadCount, notifications]);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-slate-50">
      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            className="fixed top-20 right-6 z-[200] max-w-[calc(100vw-3rem)] sm:max-w-xs w-full"
          >
            <div className="absolute inset-0 bg-brand-500 rounded-2xl blur-xl opacity-20 animate-pulse" />
            <div 
              className="relative bg-white border-2 border-brand-500 p-4 rounded-2xl shadow-2xl flex items-start gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => {
                if (showToast.link === 'chat') setActiveView('chat');
                if (showToast.link === 'users') setActiveView('users');
                updateDoc(doc(db, 'notifications', showToast.id), { read: true });
                setShowToast(null);
              }}
            >
              <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight truncate leading-none mb-1">{showToast.title}</p>
                <p className="text-[10px] text-slate-500 font-bold leading-relaxed line-clamp-2">{showToast.message}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setShowToast(null); }} className="text-slate-400 hover:text-slate-600 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <style>
        {`
          :root {
            ${company?.primaryColor ? `--color-brand-500: ${company.primaryColor};` : ''}
            ${company?.secondaryColor ? `--color-secondary-500: ${company.secondaryColor};` : ''}
            ${company?.backgroundColor ? `--bg-color: ${company.backgroundColor};` : ''}
            ${company?.fontFamily ? `--font-family: ${company.fontFamily};` : ''}
            ${company?.textColor ? `--text-color: ${company.textColor};` : ''}
            ${company?.fontSize ? `--font-size: ${getFontSize(company.fontSize)};` : ''}
            ${company?.fontWeight ? `--font-weight: ${getFontWeight(company.fontWeight)};` : ''}
            ${company?.sidebarColor ? `--sidebar-bg: ${company.sidebarColor};` : ''}
          }
          
          /* Target 100dvh specifically for mobile UI bars */
          .mobile-viewport-fix {
            height: 100dvh;
          }
        `}
      </style>
      
      {/* Sidebar */}
      <AnimatePresence>
        {(isSidebarOpen || (typeof window !== 'undefined' && window.innerWidth >= 1024)) && (
          <motion.aside
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            style={{ backgroundColor: company?.sidebarColor || undefined }}
            className={cn(
              "fixed inset-y-0 lg:sticky top-0 left-0 z-50 w-72 bg-slate-900 flex flex-col h-screen lg:h-[100dvh] transition-all border-r border-slate-800 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700",
              !isSidebarOpen && "hidden lg:flex"
            )}
          >
            <div className="p-6 border-b border-slate-800 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3 min-w-0">
                  {company?.logoUrl && (
                    <img src={company.logoUrl} alt="Logo" className="w-8 h-8 object-contain shrink-0" />
                  )}
                  <h1 className="text-white font-bold text-lg tracking-tight uppercase truncate">
                    Sweet Ice <span className="text-brand-400 font-normal">PRO</span>
                  </h1>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 shrink-0">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest truncate">
                {company?.businessSector || 'Gestão Corporativa'}
              </p>
            </div>

            <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
              {currentMenuItems.map((item) => (
                <button
                  key={item.id}
                  id={`menu-item-${item.id}`}
                  onClick={() => {
                    setActiveView(item.id as View);
                    setSidebarOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all text-sm relative z-50 cursor-pointer pointer-events-auto",
                    activeView === item.id 
                      ? "bg-brand-600 text-white shadow-lg shadow-brand-500/20" 
                      : (item.id === 'settings' 
                          ? "text-brand-400 bg-brand-500/5 hover:bg-brand-500/10 border border-brand-500/10" 
                          : "text-slate-400 hover:bg-slate-800 hover:text-white")
                  )}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {item.badge !== undefined && item.badge !== 0 && (
                    <span className="px-2 py-0.5 bg-rose-500 text-white text-[9px] font-black rounded-full border border-white/20 shrink-0">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
              
              {(effectiveRole === UserRole.ADMIN || effectiveRole === UserRole.MANAGER) && (
                <div className="pt-2">
                  <ThemeCustomizer currentSettings={company} />
                </div>
              )}
            </nav>

            {(effectiveRole === UserRole.ADMIN || effectiveRole === UserRole.MANAGER) && (
              <div className="px-4 py-2 border-t border-slate-800 shrink-0">
                <button
                  onClick={() => {
                    setActiveView('users');
                    setSidebarOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-brand-600/10 hover:bg-brand-600/20 text-brand-400 rounded-xl font-bold transition-all text-xs border border-brand-500/20 group animate-pulse-slow"
                >
                  <UserPlus className="w-5 h-5 group-hover:scale-110 transition-transform shrink-0" />
                  <span className="flex-1 text-left uppercase tracking-widest truncate">Convidar Equipe</span>
                </button>
              </div>
            )}

            <div className="p-4 border-t border-slate-800 mt-auto shrink-0 bg-slate-900/50 backdrop-blur-sm">
              <div className="flex items-center gap-3 p-2 mb-4">
                <div className="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-bold border-2 border-slate-800 shadow-sm overflow-hidden shrink-0">
                  {user?.profilePic ? (
                    <img src={user.profilePic} alt={user.name} />
                  ) : (
                    user?.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{user?.name}</p>
                  <p className="text-[9px] text-slate-500 truncate capitalize">{effectiveRole ? UserRoleLabels[effectiveRole] : ''}</p>
                </div>
              </div>
              <button 
                onClick={logout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-slate-400 hover:text-white hover:bg-red-500/10 transition-colors text-sm"
              >
                <LogOut className="w-5 h-5 shrink-0" />
                Sair
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 shrink-0 relative z-20 shadow-sm gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-slate-50 rounded-xl transition-colors border border-slate-100 shrink-0"
            >
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
            <h2 className="font-bold text-xs sm:text-sm text-slate-800 uppercase tracking-widest truncate">
              {menuItems.find(m => m.id === activeView)?.label || 'Início'}
            </h2>
          </div>
          <div className="flex items-center gap-1 sm:gap-4 lg:gap-6 shrink-0">
            <RoleSwitcher />
            {(effectiveRole === UserRole.ADMIN || effectiveRole === UserRole.MANAGER) && (
              <div className="hidden sm:block">
                <ThemeCustomizer currentSettings={company} variant="header" />
              </div>
            )}
            <div className="relative">
              <button 
                onClick={() => {
                  setIsNotificationsOpen(!isNotificationsOpen);
                  if (!isNotificationsOpen && unreadCount > 0) markAllRead();
                }}
                className={cn(
                  "relative p-2 text-slate-400 hover:text-brand-600 transition-all active:scale-95",
                  unreadCount > 0 && "text-brand-600"
                )}
              >
                <Bell className={cn("w-5 h-5", unreadCount > 0 && "animate-pulse")} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white text-[8px] font-black rounded-full border-2 border-white flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-[calc(100vw-2rem)] sm:w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 z-[60] overflow-hidden"
                  >
                    <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notificações</h3>
                      <button 
                        onClick={clearNotifications}
                        className="text-[9px] font-bold text-slate-400 hover:text-rose-500 uppercase tracking-tighter"
                      >
                        Limpar Tudo
                      </button>
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-slate-300">
                          <Bell className="w-8 h-8 mx-auto mb-2 opacity-10" />
                          <p className="text-[10px] font-black uppercase tracking-widest">Nenhum alerta</p>
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div 
                            key={n.id}
                            className={cn(
                              "p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer relative",
                              !n.read && "bg-brand-50/30"
                            )}
                            onClick={() => {
                              if (n.link === 'chat') setActiveView('chat');
                              setIsNotificationsOpen(false);
                            }}
                          >
                            {!n.read && <div className="absolute top-4 right-4 w-2 h-2 bg-brand-500 rounded-full" />}
                            <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight mb-1">{n.title}</p>
                            <p className="text-[10px] text-slate-500 font-medium leading-relaxed">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 border-l pl-2 sm:pl-6 border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-900 truncate max-w-[120px]">{user?.name}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-tighter truncate max-w-[120px]">{effectiveRole ? UserRoleLabels[effectiveRole] : ''}</p>
              </div>
              <div className="w-8 h-8 bg-brand-50 rounded-full flex items-center justify-center text-brand-600 font-bold text-xs ring-1 ring-slate-100 overflow-hidden shrink-0">
                {user?.profilePic ? <img src={user.profilePic} alt="" className="w-full h-full object-cover" /> : user?.name.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        <section 
          id="main-content-section" 
          className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 relative scroll-smooth bg-slate-50 custom-scrollbar"
        >
          <AnimatePresence>
            {pendingUsersCount > 0 && (activeView !== 'users') && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="mb-6 relative z-10 group"
              >
                <div className="absolute inset-0 bg-amber-400 rounded-3xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity animate-pulse" />
                <div className="relative bg-white border-2 border-amber-400 p-4 sm:p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6 shadow-2xl shadow-amber-500/10 overflow-hidden">
                  <div className="flex items-center gap-4 sm:gap-5">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-amber-400 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0">
                      <UserPlus className="w-6 h-6 sm:w-8 h-8 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight leading-none mb-1 truncate">Membros Pendentes</h3>
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest line-clamp-1">
                        <span className="text-amber-700 underline underline-offset-4">{pendingUsersCount} novos membros</span> aguardando liberação.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveView('users')}
                    className="w-full md:w-auto px-6 py-3 sm:py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black transition-all shadow-xl shadow-slate-900/10 active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                  >
                    Gerenciar Acessos
                    <ArrowUp className="w-4 h-4 rotate-90" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="min-h-full"
            >
              {activeView === 'dashboard' && <Dashboard />}
              {activeView === 'my-tasks' && <MyTasks onNavigateToChat={navigateToChat} />}
              {activeView === 'tasks' && <TaskManager onNavigateToChat={navigateToChat} />}
              {activeView === 'assignments' && <TaskAssignment />}
              {activeView === 'chat' && (
                <ChatSection 
                  initialChatId={activeChatId} 
                  onChatOpened={() => setActiveChatId(null)} 
                />
              )}
              {activeView === 'users' && <UserManagement />}
              {activeView === 'reports' && <Reports />}
              {activeView === 'audit-logs' && effectiveRole === UserRole.ADMIN && <AuditLogs />}
              {activeView === 'manual' && <ManagerManual />}
              {activeView === 'settings' && <Settings />}
              {activeView === 'profile' && <Settings forceProfile />}
            </motion.div>
          </AnimatePresence>

          {/* Back to Top Button */}
          <AnimatePresence>
            {showScrollTop && (
              <motion.button
                initial={{ opacity: 0, scale: 0.5, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 20 }}
                onClick={scrollToTop}
                className="fixed bottom-8 right-8 z-50 p-4 bg-brand-600 text-white rounded-full shadow-2xl hover:bg-brand-700 transition-colors group flex items-center justify-center border-4 border-white"
              >
                <ArrowUp className="w-6 h-6 group-hover:-translate-y-1 transition-transform" />
              </motion.button>
            )}
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
}
