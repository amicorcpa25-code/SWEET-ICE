import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, getDocs, collection, query, where, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { User, UserRole, UserStatus } from './types';
import Login from './components/auth/Login';
import Shell from './components/layout/Shell';
import AwaitingApproval from './components/auth/AwaitingApproval';
import UserProfile from './components/settings/UserProfile';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  effectiveRole: UserRole | null;
  setImpersonatedRole: (role: UserRole | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [impersonatedRole, setImpersonatedRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      // Clean up previous user listener
      if (unsubscribeUser) {
        unsubscribeUser();
        unsubscribeUser = null;
      }

      if (fbUser) {
        // Set up real-time listener for user document
        const userDocRef = doc(db, 'users', fbUser.uid);
        
        unsubscribeUser = onSnapshot(userDocRef, async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            let role = data.role as UserRole;
            let status = data.status as UserStatus || UserStatus.APPROVED;
            
            if (fbUser.email === 'waralaliju@gmail.com') {
              role = UserRole.ADMIN;
              status = UserStatus.APPROVED;
              if (!data.isProfileComplete) {
                await updateDoc(userDocRef, { isProfileComplete: true });
              }
            } else {
              if ((role as string) === 'ADMINISTRADOR') role = UserRole.ADMIN;
              if ((role as string) === 'GERENTE') role = UserRole.MANAGER;
              if ((role as string) === 'COLABORADOR') role = UserRole.USER;
            }
            
            setUser({ ...data, id: snapshot.id, role, status } as User);
            setLoading(false);
          } else {
            // Handle first time login creation
            await handleFirstLogin(fbUser);
          }
        }, (error) => {
          console.error("User listener error:", error);
          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, []);

  const handleFirstLogin = async (fbUser: FirebaseUser) => {
    // If this is the first user (bootstrap admin), create them
    const userEmail = fbUser.email?.toLowerCase().trim() || '';
    const userPhone = fbUser.phoneNumber || '';
    const isBootstrap = userEmail === 'waralaliju@gmail.com';
    
    let initialRole = UserRole.USER;
    let initialStatus = UserStatus.PENDING;
    let invitedBy = null;

    if (isBootstrap) {
      initialRole = UserRole.ADMIN;
      initialStatus = UserStatus.APPROVED;
    } else {
      // Check for pre-existing invitation
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const inviteId = urlParams.get('inviteId');

        let invDoc = null;

        if (inviteId) {
          const docRef = doc(db, 'invitations', inviteId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().status === 'PENDING') {
            const data = docSnap.data();
            const matchesEmail = data.email && data.email === userEmail;
            const matchesPhone = data.phone && data.phone === userPhone;
            
            if (matchesEmail || matchesPhone) {
              invDoc = { id: docSnap.id, data };
            }
          }
        }

        if (!invDoc) {
          if (userEmail) {
            const emailQuery = query(
              collection(db, 'invitations'), 
              where('email', '==', userEmail),
              where('status', '==', 'PENDING')
            );
            const emailSnap = await getDocs(emailQuery);
            if (!emailSnap.empty) {
              invDoc = { id: emailSnap.docs[0].id, data: emailSnap.docs[0].data() };
            }
          }
          
          if (!invDoc && userPhone) {
            const phoneQuery = query(
              collection(db, 'invitations'), 
              where('phone', '==', userPhone),
              where('status', '==', 'PENDING')
            );
            const phoneSnap = await getDocs(phoneQuery);
            if (!phoneSnap.empty) {
              invDoc = { id: phoneSnap.docs[0].id, data: phoneSnap.docs[0].data() };
            }
          }
        }
        
        if (invDoc) {
          const invData = invDoc.data;
          
          initialRole = invData.role as UserRole;
          initialStatus = UserStatus.APPROVED;
          invitedBy = invData.invitedBy;

          await updateDoc(doc(db, 'invitations', invDoc.id), {
            status: 'ACCEPTED',
            acceptedAt: serverTimestamp(),
            userId: fbUser.uid
          });
        }
      } catch (err) {
        console.error('Error checking invitations:', err);
      }
    }

    const newUser: User = {
      id: fbUser.uid,
      name: fbUser.displayName || 'Nova Conta',
      email: userEmail,
      phone: userPhone,
      role: initialRole,
      status: initialStatus,
      isProfileComplete: isBootstrap,
      invitedBy: invitedBy as any,
      createdAt: serverTimestamp(),
    };
    
    await setDoc(doc(db, 'users', fbUser.uid), newUser);
    setUser(newUser);
    setLoading(false);
  };

  const logout = () => {
    setImpersonatedRole(null);
    return auth.signOut();
  };

  const effectiveRole = user ? (impersonatedRole || user.role) : null;

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      logout, 
      effectiveRole, 
      setImpersonatedRole 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (user.status !== UserStatus.APPROVED) {
    return <AwaitingApproval />;
  }

  // Force profile completion
  if (!user.isProfileComplete) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Complete seu Cadastro</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Para acessar o sistema, precisamos de algumas informações básicas</p>
          </div>
          <UserProfile onBack={() => {}} />
        </div>
      </div>
    );
  }

  return <Shell />;
}
