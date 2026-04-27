import React, { useState } from 'react';
import { useAuth } from '../../App';
import { UserRole, UserRoleLabels } from '../../types';
import { Eye, ChevronDown, Check, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

export default function RoleSwitcher() {
  const { user, effectiveRole, setImpersonatedRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Allow admins and managers to switch roles
  if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER)) return null;

  const allRoles = [
    { value: UserRole.ADMIN, label: 'Visualização Administrador' },
    { value: UserRole.MANAGER, label: 'Visualização Gerente' },
    { value: UserRole.USER, label: 'Visualização Colaborador' },
  ];

  const roles = allRoles.filter(role => {
    if (user.role === UserRole.ADMIN) return true;
    if (user.role === UserRole.MANAGER) {
      return role.value === UserRole.MANAGER || role.value === UserRole.USER;
    }
    return false;
  });

  const isImpersonating = effectiveRole !== user.role;

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-1.5 sm:px-2 py-1 rounded-lg text-xs font-black uppercase tracking-wider transition-all border shadow-sm",
          isImpersonating 
            ? "bg-amber-50 text-amber-600 border-amber-200 animate-pulse" 
            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
        )}
      >
        <Eye className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">
          {isImpersonating ? `Modo: ${UserRoleLabels[effectiveRole!]}` : 'Alternar Visão'}
        </span>
        <span className="sm:hidden">
          {isImpersonating ? UserRoleLabels[effectiveRole!].charAt(0) : 'Alternar'}
        </span>
        <ChevronDown className={cn("w-3 h-3 transition-transform shrink-0", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-[100]" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-slate-100 z-[101] overflow-hidden p-2"
            >
              <div className="px-3 py-2 mb-1 border-b border-slate-50">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Simular Perfil</p>
              </div>
              
              <div className="space-y-1">
                {roles.map((role) => (
                  <button
                    key={role.value}
                    onClick={() => {
                      setImpersonatedRole(role.value === user.role ? null : role.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-bold transition-colors",
                      effectiveRole === role.value 
                        ? "bg-brand-50 text-brand-700" 
                        : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {role.label}
                    {effectiveRole === role.value && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>

              {isImpersonating && (
                <button
                  onClick={() => {
                    setImpersonatedRole(null);
                    setIsOpen(false);
                  }}
                  className="w-full mt-2 flex items-center gap-2 px-2 py-1.5 text-xs font-black text-red-600 hover:bg-red-50 rounded-lg uppercase tracking-wider transition-colors border-t border-slate-50 pt-3"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Sair da Simulação
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
