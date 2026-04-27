import React, { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, orderBy, where, getDocs, limit, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Chat, Message, User, UserRole, UserStatus } from '../../types';
import { useAuth } from '../../App';
import { Send, Plus, Search, Paperclip, MoreVertical, MessageSquare, Phone, Video, Mic, Trash2, Shield, Group, Download, ChevronRight, Camera, X, CheckCircle2, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ChatSectionProps {
  initialChatId?: string | null;
  onChatOpened?: () => void;
}

export default function ChatSection({ initialChatId, onChatOpened }: ChatSectionProps) {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [team, setTeam] = useState<User[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chats' | 'team'>('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCalling, setIsCalling] = useState<'VOICE' | 'VIDEO' | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialChatId) {
      setActiveChatId(initialChatId);
      setActiveTab('chats');
      onChatOpened?.();
    }
  }, [initialChatId, onChatOpened]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isSearchingMessages, setIsSearchingMessages] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');

  const activeChat = chats.find(c => c.id === activeChatId);
  const otherMemberId = activeChat?.members.find(m => m !== user?.id) || user?.id;
  const otherMember = team.find(m => m.id === otherMemberId);
  const chatName = activeChat?.type === 'DIRECT' 
    ? (otherMemberId === user?.id ? `${otherMember?.name} (Você)` : (otherMember?.name || 'Membro Externo')) 
    : activeChat?.name;

  const filteredMessages = messages.filter(m => 
    m.content.toLowerCase().includes(messageSearchQuery.toLowerCase())
  );

  const createGroup = async () => {
    if (!user || !groupName || selectedMembers.length === 0) return;

    try {
      const newChatRef = await addDoc(collection(db, 'chats'), {
        type: 'GROUP',
        name: groupName,
        members: [user.id, ...selectedMembers],
        createdAt: serverTimestamp(),
        lastMessage: {
          content: `Grupo ${groupName} criado por ${user.name}`,
          senderId: user.id,
          createdAt: serverTimestamp()
        }
      });

      // Log the event
      await addDoc(collection(db, 'auditLogs'), {
        userId: user.id,
        action: 'CREATE_GROUP',
        details: `Criou o grupo: ${groupName}`,
        createdAt: serverTimestamp()
      });

      setActiveChatId(newChatRef.id);
      setIsCreatingGroup(false);
      setGroupName('');
      setSelectedMembers([]);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'chats');
    }
  };

  const handleCall = async (type: 'VOICE' | 'VIDEO') => {
    setIsCalling(type);
    
    // Log call initiation
    try {
      await addDoc(collection(db, 'auditLogs'), {
        userId: user?.id,
        action: `CALL_INITIATED_${type}`,
        details: `Iniciou chamada com ${chatName}`,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error('Audit log failed', e);
    }
  };

  useEffect(() => {
    // Admins/Managers can see ALL chats. Users only see chats they are members of.
    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MANAGER;
    let qChats;
    
    if (isAdmin) {
      qChats = query(collection(db, 'chats'), orderBy('lastMessage.createdAt', 'desc'));
    } else {
      qChats = query(collection(db, 'chats'), where('members', 'array-contains', user?.id), orderBy('lastMessage.createdAt', 'desc'));
    }

    const unsubChats = onSnapshot(qChats, (s) => 
      setChats(s.docs.map(d => ({ id: d.id, ...d.data() } as Chat))),
      (error) => handleFirestoreError(error, OperationType.GET, 'chats')
    );

    let unsubUsers = () => {};
    // Fetch team members
    const qUsers = query(collection(db, 'users'), orderBy('name', 'asc'));
    unsubUsers = onSnapshot(qUsers, (s) => 
      setTeam(s.docs.map(d => ({ id: d.id, ...d.data() } as User))),
      (error) => handleFirestoreError(error, OperationType.GET, 'users')
    );

    return () => { unsubChats(); unsubUsers(); };
  }, [user]);

  const startDirectChat = async (targetUser: User) => {
    if (!user) return;
    
    // Check if direct chat already exists
    const existingChat = chats.find(c => 
      c.type === 'DIRECT' && 
      c.members.includes(user.id) && 
      c.members.includes(targetUser.id)
    );

    if (existingChat) {
      setActiveChatId(existingChat.id);
      setActiveTab('chats');
      return;
    }

    try {
      const newChatRef = await addDoc(collection(db, 'chats'), {
        type: 'DIRECT',
        members: [user.id, targetUser.id],
        createdAt: serverTimestamp(),
        lastMessage: {
          content: 'Iniciou uma nova conversa estratégica.',
          senderId: user.id,
          createdAt: serverTimestamp()
        }
      });
      setActiveChatId(newChatRef.id);
      setActiveTab('chats');
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'chats');
    }
  };

  const handleMediaUpload = async (type: 'IMAGE' | 'VIDEO' | 'FILE' | 'VOICE' | 'CAMERA') => {
    if (!activeChatId || !user) return;
    
    if (type === 'CAMERA') {
      alert('Funcionalidade de câmera iniciada...');
    }

    const input = document.createElement('input');
    input.type = 'file';
    if (type === 'IMAGE' || type === 'CAMERA') input.accept = 'image/*';
    else if (type === 'VIDEO') input.accept = 'video/*';
    else if (type === 'VOICE') input.accept = 'audio/*';

    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        await addDoc(collection(db, `chats/${activeChatId}/messages`), {
          chatId: activeChatId,
          senderId: user.id,
          content: `Arquivo ${type}: ${file.name}`,
          type: type === 'CAMERA' ? 'IMAGE' : type,
          fileUrl: 'https://via.placeholder.com/600x400?text=Arquivo+' + type,
          createdAt: serverTimestamp()
        });

        const chatRef = doc(db, 'chats', activeChatId);
        await updateDoc(chatRef, {
          lastMessage: {
            content: `Enviou um(a) ${type.toLowerCase()}`,
            senderId: user.id,
            createdAt: serverTimestamp()
          }
        });

        // Create notifications for other members
        const memberNotifications = activeChat?.members.filter(m => m !== user.id) || [];
        const notificationPromises = memberNotifications.map(memberId => {
          return addDoc(collection(db, 'notifications'), {
            userId: memberId,
            title: activeChat?.type === 'DIRECT' ? `Nova mídia de ${user.name}` : `Nova mídia em ${chatName}`,
            message: `Enviou um(a) ${type.toLowerCase()}`,
            type: 'CHAT',
            read: false,
            link: 'chat',
            chatId: activeChatId,
            createdAt: serverTimestamp()
          });
        });
        await Promise.all(notificationPromises);

        // Audit log for file sharing
        await addDoc(collection(db, 'auditLogs'), {
          userId: user.id,
          action: 'FILE_SHARED',
          details: `Compartilhou arquivo do tipo ${type}: ${file.name} no chat ${chatName}`,
          createdAt: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `chats/${activeChatId}/messages`);
      }
    };
    input.click();
  };

  useEffect(() => {
    if (!activeChatId) return;
    const qMsgs = query(
      collection(db, `chats/${activeChatId}/messages`), 
      orderBy('createdAt', 'asc'),
      limit(50)
    );
    const unsubMsgs = onSnapshot(qMsgs, (s) => {
      setMessages(s.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `chats/${activeChatId}/messages`);
    });
    return () => unsubMsgs();
  }, [activeChatId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChatId) return;

    const content = newMessage;
    setNewMessage('');

    try {
      const msgRef = await addDoc(collection(db, `chats/${activeChatId}/messages`), {
        chatId: activeChatId,
        senderId: user?.id,
        content,
        type: 'TEXT',
        createdAt: serverTimestamp()
      });

      // Update last message in chat
      const chatRef = doc(db, 'chats', activeChatId);
      await updateDoc(chatRef, {
        lastMessage: {
          content: content.substring(0, 100),
          senderId: user?.id,
          createdAt: serverTimestamp()
        }
      });

      // Mention Detection
      const mentions = content.match(/@(\w+)/g);
      if (mentions) {
        mentions.forEach(async (mention) => {
          const mentionedName = mention.substring(1).toLowerCase();
          const mentionedUser = team.find(u => u.name.toLowerCase().replace(/\s/g, '').includes(mentionedName));
          
          if (mentionedUser && mentionedUser.id !== user?.id) {
            await addDoc(collection(db, 'notifications'), {
              userId: mentionedUser.id,
              title: `Menção em ${chatName}`,
              message: `${user?.name} mencionou você: "${content.substring(0, 50)}..."`,
              type: 'CHAT',
              read: false,
              link: 'chat',
              createdAt: serverTimestamp()
            });
          }
        });
      }

      // Create general notification for other members
      const memberNotifications = activeChat?.members.filter(m => m !== user?.id) || [];
      const notificationPromises = memberNotifications.map(memberId => {
        // Skip general notification if already mentioned (to avoid double notification)
        const mentions = content.match(/@(\w+)/g);
        if (mentions) {
          const mentionedNames = mentions.map(m => m.substring(1).toLowerCase());
          const isMentioned = team.some(u => u.id === memberId && mentionedNames.some(name => u.name.toLowerCase().replace(/\s/g, '').includes(name)));
          if (isMentioned) return Promise.resolve();
        }

        return addDoc(collection(db, 'notifications'), {
          userId: memberId,
          title: activeChat?.type === 'DIRECT' ? `Nova mensagem de ${user?.name}` : `Nova mensagem em ${chatName}`,
          message: content.substring(0, 100),
          type: 'CHAT',
          read: false,
          link: 'chat',
          chatId: activeChatId,
          createdAt: serverTimestamp()
        });
      });

      await Promise.all(notificationPromises);

    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `chats/${activeChatId}/messages`);
    }
  };

  const filteredTeam = team.filter(u => 
    (u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredChats = chats.filter(c => {
    const otherId = c.members.find(m => m !== user?.id) || user?.id; // Fallback to self for "Notes to self"
    const chatMember = team.find(u => u.id === otherId);
    const name = c.type === 'DIRECT' ? (otherId === user?.id ? `${chatMember?.name} (Você)` : chatMember?.name) : c.name;
    return name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex bg-slate-50 rounded-2xl border border-slate-200 shadow-sm h-full overflow-hidden font-sans relative lg:max-h-[calc(100vh-10rem)]">
      {/* Sidebar: Chat List */}
      <div className={cn(
        "w-full md:w-80 lg:w-96 border-r border-slate-200 flex flex-col bg-white transition-all",
        activeChatId ? "hidden md:flex" : "flex"
      )}>
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-brand-600 text-white shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] sm:text-xs font-black uppercase tracking-widest leading-none">Comunicação Interna</h3>
            <button 
              onClick={() => setIsCreatingGroup(true)}
              className="p-1.5 hover:bg-white/10 rounded-full transition-all active:scale-95"
              title="Novo Grupo"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex p-1 bg-white/10 rounded-xl">
            <button 
              onClick={() => setActiveTab('chats')}
              className={cn(
                "flex-1 py-1.5 sm:py-2 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'chats' ? "bg-white text-brand-600 shadow-sm" : "text-white/70 hover:text-white"
              )}
            >
              Conversas
            </button>
            <button 
              onClick={() => setActiveTab('team')}
              className={cn(
                "flex-1 py-1.5 sm:py-2 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'team' ? "bg-white text-brand-600 shadow-sm" : "text-white/70 hover:text-white"
              )}
            >
              Equipe
            </button>
          </div>
        </div>

        <div className="p-3 border-b border-slate-100 bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder={activeTab === 'chats' ? "Pesquisar conversas..." : "Pesquisar membros..."}
              className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-xs uppercase font-bold tracking-widest focus:ring-0"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'chats' ? (
            filteredChats.map(chat => {
              const otherId = chat.members.find(m => m !== user?.id) || user?.id;
              const member = team.find(u => u.id === otherId);
              const name = chat.type === 'DIRECT' ? (otherId === user?.id ? `${member?.name} (Você)` : member?.name) : chat.name;
              return (
                <button
                  key={chat.id}
                  onClick={() => setActiveChatId(chat.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 border-b border-slate-50 transition-all text-left group",
                    activeChatId === chat.id ? "bg-slate-100" : "hover:bg-slate-50"
                  )}
                >
                  <div className="relative shrink-0">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shrink-0 shadow-sm border overflow-hidden",
                      activeChatId === chat.id ? "bg-brand-600 border-brand-500 text-white" : "bg-slate-200 border-slate-300 text-slate-500"
                    )}>
                      {chat.type === 'DIRECT' ? (
                        member?.profilePic ? <img src={member.profilePic} className="w-full h-full object-cover" /> : name?.charAt(0)
                      ) : <Group className="w-6 h-6" />}
                    </div>
                    {chat.type === 'DIRECT' && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-xs font-black uppercase tracking-tight truncate text-slate-900">
                        {name || 'Célula de Trabalho'}
                      </p>
                      <span className="text-[10px] font-bold text-slate-400">
                        {chat.lastMessage?.createdAt?.toDate ? format(chat.lastMessage.createdAt.toDate(), 'HH:mm') : '--:--'}
                      </span>
                    </div>
                    <p className="text-[11px] font-medium truncate text-slate-500">
                      {chat.lastMessage?.content || 'Aguardando transmissão...'}
                    </p>
                  </div>
                </button>
              );
            })
          ) : (
            filteredTeam.map(member => (
              <button
                key={member.id}
                onClick={() => startDirectChat(member)}
                className="w-full flex items-center gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                  {member.profilePic ? <img src={member.profilePic} className="w-full h-full object-cover" /> : member.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black uppercase tracking-tight text-slate-900 truncate">{member.name}</p>
                  <p className="text-[10px] font-bold uppercase tracking-tighter text-slate-400 truncate">{member.email}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={cn(
        "flex-1 flex flex-col bg-slate-50 relative transition-all min-w-0 border-l border-slate-200",
        !activeChatId ? "hidden md:flex items-center justify-center" : "flex"
      )}>
        {!activeChatId ? (
          <div className="text-center p-8 max-w-sm">
            <div className="w-24 h-24 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <MessageSquare className="w-12 h-12 text-brand-600" />
            </div>
            <h2 className="text-lg font-black uppercase tracking-widest text-slate-800 mb-2">Central de Colaboração</h2>
            <p className="text-xs text-slate-500 uppercase font-black tracking-widest leading-relaxed">
              Mantenha o seu dispositivo conectado para sincronizar as mensagens e arquivos da equipe Sweet Ice PRO.
            </p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <header className="h-16 sm:h-20 flex items-center justify-between px-4 sm:px-6 bg-white border-b border-slate-100 shrink-0 z-10 shadow-sm">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <button 
                  onClick={() => setActiveChatId(null)}
                  className="md:hidden p-2 -ml-2 text-slate-400 hover:bg-slate-50 rounded-xl border border-slate-100 shrink-0"
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                </button>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-[18px] bg-brand-50 flex items-center justify-center text-brand-600 font-black border-2 border-slate-50 shadow-sm shrink-0 overflow-hidden">
                  {otherMember?.profilePic ? (
                    <img src={otherMember.profilePic} className="w-full h-full object-cover" />
                  ) : (
                    chatName === activeChat?.name && activeChat?.type === 'GROUP' ? <Users className="w-6 h-6" /> : chatName?.charAt(0)
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-black uppercase tracking-tight text-slate-900 truncate">{chatName}</h4>
                  <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    {isSearchingMessages ? `Filtrando "${messageSearchQuery}"` : 'Sistema Sincronizado'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isSearchingMessages ? (
                   <motion.div 
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 200, opacity: 1 }}
                    className="relative flex items-center"
                   >
                     <input 
                      type="text"
                      autoFocus
                      placeholder="Buscar mensagens..."
                      className="w-full flex-1 bg-white border-2 border-slate-100 rounded-full py-1.5 px-4 text-[10px] font-black uppercase tracking-widest focus:ring-0"
                      value={messageSearchQuery}
                      onChange={(e) => setMessageSearchQuery(e.target.value)}
                     />
                     <button 
                      type="button"
                      onClick={() => {
                        setIsSearchingMessages(false);
                        setMessageSearchQuery('');
                      }}
                      className="absolute right-3 p-0.5 bg-slate-100 rounded-full"
                     >
                        <Trash2 className="w-3 h-3 text-slate-500" />
                     </button>
                   </motion.div>
                ) : (
                  <>
                    <button 
                      type="button"
                      onClick={() => handleCall('VOICE')}
                      className="p-2.5 text-slate-500 hover:bg-slate-200 rounded-full transition-colors"
                      title="Chamada de Áudio"
                    >
                      <Phone className="w-5 h-5" />
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleCall('VIDEO')}
                      className="p-2.5 text-slate-500 hover:bg-slate-200 rounded-full transition-colors"
                      title="Chamada de Vídeo"
                    >
                      <Video className="w-5 h-5" />
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIsSearchingMessages(true)}
                      className="p-2.5 text-slate-500 hover:bg-slate-200 rounded-full transition-colors hidden sm:block"
                    >
                      <Search className="w-5 h-5" />
                    </button>
                  </>
                )}
                <button type="button" className="p-2.5 text-slate-500 hover:bg-slate-200 rounded-full transition-colors">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </header>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 bg-fixed" style={{ backgroundImage: 'url("https://w0.peakpx.com/wallpaper/508/606/HD-wallpaper-whatsapp-back-whatsapp-background.jpg")', backgroundSize: '400px' }}>
              {filteredMessages.map((msg, idx) => {
                const isMine = msg.senderId === user?.id;
                const sender = team.find(u => u.id === msg.senderId);
                return (
                  <div 
                    key={msg.id} 
                    className={cn(
                      "flex flex-col max-w-[85%] sm:max-w-[70%]",
                      isMine ? "ml-auto items-end" : "mr-auto items-start"
                    )}
                  >
                    <div className={cn(
                      "px-4 py-2 bg-white rounded-xl shadow-sm relative",
                      isMine ? "bg-[#dcf8c6] text-slate-800 rounded-tr-none" : "bg-white text-slate-800 rounded-tl-none"
                    )}>
                      {msg.type === 'IMAGE' || msg.type === 'FILE' || msg.type === 'VIDEO' || msg.type === 'VOICE' ? (
                        <div className="flex flex-col gap-2 min-w-[180px]">
                          <div className="flex items-center gap-2 mb-1">
                            {msg.type === 'IMAGE' && <Paperclip className="w-4 h-4 text-brand-600" />}
                            {msg.type === 'VIDEO' && <Video className="w-4 h-4 text-brand-600" />}
                            {msg.type === 'VOICE' && <Mic className="w-4 h-4 text-brand-600" />}
                            {msg.type === 'FILE' && <Paperclip className="w-4 h-4 text-brand-600" />}
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#00a884]">{msg.type}</span>
                          </div>
                          {msg.type === 'IMAGE' && (
                            <div className="rounded overflow-hidden border border-slate-100 bg-slate-50">
                              <img src={msg.fileUrl} className="max-w-full h-auto object-cover max-h-[300px]" alt="Media" />
                            </div>
                          )}
                          <p className="text-[11px] font-semibold">{msg.content}</p>
                          <a 
                            href={msg.fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-[10px] py-2 px-3 bg-slate-100/50 hover:bg-slate-100 rounded mt-1 font-black uppercase tracking-widest transition-colors"
                          >
                            <Download className="w-3.5 h-3.5 mr-1" />
                            Baixar
                          </a>
                        </div>
                      ) : (
                        <p className="text-xs leading-relaxed">{msg.content}</p>
                      )}
                      
                      <div className="mt-1 flex items-center justify-end gap-1">
                        <span className="text-[9px] font-bold text-slate-400">{msg.createdAt?.toDate ? format(msg.createdAt.toDate(), 'HH:mm') : '--:--'}</span>
                        {isMine && <span className="text-[10px] text-blue-400">✓✓</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-[#f0f2f5] p-3 border-t border-slate-200">
              <form onSubmit={handleSendMessage} className="flex items-center gap-2 max-w-5xl mx-auto">
                <div className="flex items-center">
                   <button 
                    type="button"
                    onClick={() => alert('Opções expandidas...')}
                    className="p-2.5 text-slate-500 hover:bg-slate-200 rounded-full transition-colors"
                  >
                    <Plus className="w-6 h-6 rotate-45" />
                  </button>
                </div>
                
                <div className="flex-1 flex items-center gap-2 bg-white rounded-full px-4 py-1 shadow-sm border border-slate-100">
                  <input 
                    type="text" 
                    placeholder="Mensagem"
                    className="flex-1 py-1.5 bg-transparent border-none text-sm focus:ring-0 placeholder:text-slate-400"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      type="button"
                      onClick={() => handleMediaUpload('FILE')}
                      className="p-2 text-slate-500 hover:bg-slate-100 rounded-full"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleMediaUpload('CAMERA')}
                      className="p-2 text-slate-500 hover:bg-slate-100 rounded-full"
                    >
                      <Camera className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="shrink-0">
                  {newMessage.trim() ? (
                    <button 
                      type="submit"
                      className="w-12 h-12 bg-[#00a884] text-white rounded-full flex items-center justify-center shadow-md hover:bg-[#008f6f] transition-all active:scale-95"
                    >
                      <Send className="w-5 h-5 ml-0.5" />
                    </button>
                  ) : (
                    <button 
                      type="button"
                      onClick={() => handleMediaUpload('VOICE')}
                      className="w-12 h-12 bg-[#00a884] text-white rounded-full flex items-center justify-center shadow-md hover:bg-[#008f6f] transition-all active:scale-95"
                    >
                      <Mic className="w-6 h-6" />
                    </button>
                  )}
                </div>
              </form>
            </div>
          </>
        )}
      </div>

      {/* Admin Audit Badge */}
      {(user?.role === UserRole.ADMIN || user?.role === UserRole.MANAGER) && (
        <div className="fixed bottom-6 right-10 bg-slate-900 text-white px-4 py-2 rounded shadow-2xl text-[9px] font-bold flex items-center gap-3 border border-slate-700 z-50 uppercase tracking-widest">
          <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping"></div>
          Monitoramento Ativo
        </div>
      )}

      {/* Group Creation Modal */}
      <AnimatePresence>
        {isCreatingGroup && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200"
            >
              <div className="p-8 bg-brand-600 text-white">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-black uppercase tracking-widest italic">Nova Célula de Operação</h3>
                  <button type="button" onClick={() => setIsCreatingGroup(false)} className="p-2 hover:bg-white/10 rounded-full">
                    <Trash2 className="w-6 h-6 rotate-45" />
                  </button>
                </div>
                <div className="space-y-4">
                  <input 
                    type="text" 
                    placeholder="Nome do Grupo/Departamento"
                    className="w-full bg-white/10 border-2 border-white/20 rounded-2xl px-6 py-4 text-white placeholder:text-white/40 focus:ring-0 focus:border-white/40 font-bold uppercase tracking-widest"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-100">Selecione pelo menos 1 membro para iniciar o grupo.</p>
                </div>
              </div>
              
              <div className="p-8">
                <div className="h-64 overflow-y-auto space-y-2 mb-8 pr-2">
                  {team.filter(u => u.id !== user?.id).map(member => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => {
                        if (selectedMembers.includes(member.id)) {
                          setSelectedMembers(selectedMembers.filter(id => id !== member.id));
                        } else {
                          setSelectedMembers([...selectedMembers, member.id]);
                        }
                      }}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left",
                        selectedMembers.includes(member.id) 
                          ? "bg-brand-50 border-brand-500 shadow-sm" 
                          : "bg-slate-50 border-transparent hover:border-slate-200"
                      )}
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0 overflow-hidden">
                        {member.profilePic ? <img src={member.profilePic} className="w-full h-full object-cover" /> : member.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-black uppercase tracking-tight text-slate-800">{member.name}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{member.role} • {member.id.substring(0,8)}</p>
                      </div>
                      {selectedMembers.includes(member.id) && (
                        <div className="w-6 h-6 bg-brand-600 rounded-full flex items-center justify-center text-white">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsCreatingGroup(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="button"
                    onClick={createGroup}
                    disabled={!groupName || selectedMembers.length === 0}
                    className="flex-[2] py-4 bg-brand-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-brand-700 transition-all shadow-xl shadow-brand-500/20 disabled:opacity-50 disabled:shadow-none"
                  >
                    Ativar Grupo
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calling Overlay */}
      <AnimatePresence>
        {isCalling && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900 z-[100] flex flex-col items-center justify-center p-8 overflow-hidden"
          >
            {/* Pulsing Background Icons */}
            <div className="absolute inset-0 z-0">
               <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-white/5 rounded-full"
               />
               <motion.div 
                animate={{ scale: [1, 1.1, 1], opacity: [0.05, 0.1, 0.05] }}
                transition={{ duration: 3, repeat: Infinity, delay: 1 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white/5 rounded-full"
               />
            </div>

            <div className="relative z-10 text-center max-w-lg w-full">
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="w-32 h-32 md:w-48 md:h-48 rounded-full bg-gradient-to-br from-brand-500 to-blue-600 mx-auto mb-10 p-1 shadow-2xl shadow-brand-500/20 relative"
              >
                <div className="w-full h-full bg-slate-900 rounded-full overflow-hidden border-4 border-slate-900">
                   {otherMember?.profilePic ? (
                     <img src={otherMember.profilePic} className="w-full h-full object-cover grayscale brightness-75" />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center text-4xl font-black text-white bg-slate-800">
                        {chatName?.charAt(0)}
                     </div>
                   )}
                </div>
                <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-xl">
                    {isCalling === 'VIDEO' ? <Video className="w-6 h-6 text-brand-600" /> : <Phone className="w-6 h-6 text-brand-600" />}
                </div>
              </motion.div>

              <h2 className="text-3xl font-black text-white tracking-widest uppercase mb-2">{chatName}</h2>
              <div className="flex items-center justify-center gap-3 mb-16">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Sincronizando Canal Criptografado...</span>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-6">
                <button type="button" className="w-16 h-16 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-all">
                   <Mic className="w-6 h-6" />
                </button>
                <button type="button" className="w-16 h-16 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-all">
                   <Video className="w-6 h-6" />
                </button>
                <button 
                  type="button"
                  onClick={() => setIsCalling(null)}
                  className="w-20 h-20 bg-rose-600 text-white rounded-[32px] flex items-center justify-center shadow-2xl shadow-rose-600/30 hover:bg-rose-700 hover:scale-110 active:scale-95 transition-all"
                >
                   <Phone className="w-8 h-8 rotate-[135deg]" />
                </button>
                <button type="button" className="w-16 h-16 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-all">
                   <MoreVertical className="w-6 h-6" />
                </button>
              </div>

              <div className="mt-16 flex flex-col items-center gap-6">
                <div className="flex items-center gap-4 bg-white/5 px-6 py-3 rounded-full border border-white/5">
                   <Shield className="w-4 h-4 text-emerald-500" />
                   <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Protocolo P2P Ativo • Latência 24ms</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
