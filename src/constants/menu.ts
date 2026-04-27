import { 
  LayoutDashboard, 
  CheckSquare, 
  MessageSquare, 
  Users, 
  Settings as SettingsIcon,
  UserPlus,
  CheckCircle2,
  User as UserIcon,
  FileText,
  BookOpen,
  Shield
} from 'lucide-react';
import { UserRole } from '../types';

export interface MenuItem {
  id: string;
  label: string;
  icon: any;
  roles: UserRole[];
  badge?: number | string;
}

export const ALL_MENU_ITEMS: MenuItem[] = [
  { id: 'dashboard', label: 'Painel', icon: LayoutDashboard, roles: [UserRole.ADMIN, UserRole.MANAGER] },
  { id: 'my-tasks', label: 'Minhas Tarefas', icon: CheckCircle2, roles: Object.values(UserRole) },
  { id: 'profile', label: 'Meu Perfil', icon: UserIcon, roles: Object.values(UserRole) },
  { id: 'tasks', label: 'Gerenciar Tarefas', icon: CheckSquare, roles: [UserRole.ADMIN, UserRole.MANAGER] },
  { id: 'assignments', label: 'Atribuição', icon: UserPlus, roles: [UserRole.ADMIN, UserRole.MANAGER] },
  { id: 'chat', label: 'Chat', icon: MessageSquare, roles: Object.values(UserRole) },
  { id: 'users', label: 'Gestão de Equipe', icon: Users, roles: [UserRole.ADMIN, UserRole.MANAGER] },
  { id: 'settings', label: 'Ajustes', icon: SettingsIcon, roles: [UserRole.ADMIN, UserRole.MANAGER] },
  { id: 'reports', label: 'Relatórios', icon: FileText, roles: [UserRole.ADMIN, UserRole.MANAGER] },
  { id: 'audit-logs', label: 'Audit Logs', icon: Shield, roles: [UserRole.ADMIN] },
  { id: 'manual', label: 'Manual do Gestor', icon: BookOpen, roles: [UserRole.ADMIN, UserRole.MANAGER] },
];
