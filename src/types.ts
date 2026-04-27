export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  USER = 'USER',
}

export enum UserStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  BLOCKED = 'BLOCKED',
  DELETED = 'DELETED',
}

export const UserRoleLabels: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Administrador',
  [UserRole.MANAGER]: 'Gerente',
  [UserRole.USER]: 'Colaborador',
};

export const UserStatusLabels: Record<UserStatus, string> = {
  [UserStatus.PENDING]: 'Pendente',
  [UserStatus.APPROVED]: 'Aprovado',
  [UserStatus.BLOCKED]: 'Bloqueado',
  [UserStatus.DELETED]: 'Excluído',
};

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  profilePic?: string;
  bio?: string;
  phone?: string;
  address?: string;
  isProfileComplete?: boolean;
  customFields?: Record<string, any>;
  createdAt: any;
  invitedBy?: string;
}

export interface Invitation {
  id: string;
  email?: string;
  phone?: string;
  authMethod: 'EMAIL' | 'PHONE';
  role: UserRole;
  invitedBy: string;
  createdAt: any;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED';
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  DELAYED = 'DELAYED',
}

export const TaskStatusLabels: Record<TaskStatus, string> = {
  [TaskStatus.PENDING]: 'Pendente',
  [TaskStatus.IN_PROGRESS]: 'Em Andamento',
  [TaskStatus.COMPLETED]: 'Concluída',
  [TaskStatus.DELAYED]: 'Atrasada',
};

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export const TaskPriorityLabels: Record<TaskPriority, string> = {
  [TaskPriority.LOW]: 'Baixa',
  [TaskPriority.MEDIUM]: 'Média',
  [TaskPriority.HIGH]: 'Alta',
};

export enum TaskRecurrence {
  NONE = 'NONE',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  SEMIANNUAL = 'SEMIANNUAL',
  YEARLY = 'YEARLY',
}

export const TaskRecurrenceLabels: Record<TaskRecurrence, string> = {
  [TaskRecurrence.NONE]: 'Nenhuma',
  [TaskRecurrence.DAILY]: 'Diária',
  [TaskRecurrence.WEEKLY]: 'Semanal',
  [TaskRecurrence.MONTHLY]: 'Mensal',
  [TaskRecurrence.QUARTERLY]: 'Trimestral',
  [TaskRecurrence.SEMIANNUAL]: 'Semestral',
  [TaskRecurrence.YEARLY]: 'Anual',
};

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: any;
  recurrence: TaskRecurrence;
  recurrenceEndDate?: any;
  assignedTo: string[];
  creatorId: string;
  justification?: string;
  signedBy?: string;
  signedAt?: any;
  createdAt: any;
  updatedAt: any;
}

export interface Chat {
  id: string;
  type: 'DIRECT' | 'GROUP';
  name?: string;
  members: string[];
  lastMessage?: {
    content: string;
    senderId: string;
    createdAt: any;
  };
  createdAt: any;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  type: 'TEXT' | 'VOICE' | 'VIDEO' | 'FILE' | 'IMAGE';
  fileUrl?: string;
  createdAt: any;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  type: 'TASK' | 'CHAT' | 'SYSTEM';
  link?: string;
  createdAt: any;
}

export interface CompanySettings {
  id: string;
  companyName: string;
  businessSector: string;
  taxId: string;
  type: 'PJ' | 'PF';
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontSize?: 'xs' | 'sm' | 'base' | 'lg';
  fontWeight?: 'normal' | 'medium' | 'bold' | 'black';
  textColor?: string;
  sidebarColor?: string;
  menuOrder?: string[];
  systemUrl?: string;
  contactEmail: string;
  phone?: string;
  address?: string;
  updatedAt: any;
  updatedBy: string;
}
