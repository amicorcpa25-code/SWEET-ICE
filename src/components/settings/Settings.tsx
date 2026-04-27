import React, { useState } from 'react';
import { Settings as SettingsIcon, Bell, Shield, Palette, Globe, HelpCircle, Building2, ChevronLeft } from 'lucide-react';
import { useAuth } from '../../App';
import { UserRole } from '../../types';
import CompanySettings from './CompanySettings';
import UserProfile from './UserProfile';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface SettingsProps {
  forceProfile?: boolean;
}

export default function Settings({ forceProfile }: SettingsProps) {
  const { user, effectiveRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'root' | 'company' | 'profile'>(forceProfile ? 'profile' : 'root');

  const canManageCompany = effectiveRole === UserRole.ADMIN || effectiveRole === UserRole.MANAGER;

  const sections = [
    { id: 'profile', name: 'Perfil', icon: SettingsIcon, desc: 'Personalize suas informações e foto.' },
    { id: 'notifications', name: 'Notificações', icon: Bell, desc: 'Escolha como e quando ser avisado.' },
    { id: 'security', name: 'Segurança', icon: Shield, desc: 'Controle de acesso e logs de auditoria.' },
    { id: 'appearance', name: 'Aparência', icon: Palette, desc: 'Temas, cores e modos de visualização.' },
    { id: 'language', name: 'Idioma', icon: Globe, desc: 'Altere o idioma do sistema (Português BR).' },
  ];

  if (activeTab === 'company') {
    return (
      <div className="space-y-6">
        <button 
          onClick={() => setActiveTab('root')}
          className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-slate-900 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar para Configurações
        </button>
        <CompanySettings />
      </div>
    );
  }

  if (activeTab === 'profile') {
    return (
      <UserProfile onBack={() => setActiveTab('root')} />
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-12 font-sans">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {canManageCompany && (
          <button 
            id="admin-settings-button"
            onClick={() => setActiveTab('company')}
            className="md:col-span-2 flex items-center justify-between p-8 bg-brand-600 text-white rounded-2xl shadow-xl shadow-brand-500/20 hover:scale-[1.01] transition-all group cursor-pointer pointer-events-auto"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/20 rounded shadow-md">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <h4 className="text-xs font-bold uppercase tracking-widest">Painel Administrativo da Empresa</h4>
                <p className="text-[10px] text-brand-100 font-medium mt-2 uppercase tracking-tighter leading-relaxed">
                  Gerencie o ramo de atividade, dados cadastrais e a identidade visual corporativa do sistema.
                </p>
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 rotate-180 opacity-50 group-hover:opacity-100 transition-opacity" />
          </button>
        )}

        {sections.map(section => (
          <button 
            key={section.id}
            id={`settings-section-${section.id}`}
            onClick={() => {
              if (section.id === 'profile') {
                setActiveTab('profile');
              } else {
                alert(`${section.name} será implementado em breve!`);
              }
            }}
            className="flex items-start gap-4 p-8 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all text-left group cursor-pointer pointer-events-auto"
          >
            <div className="p-3 bg-brand-600 text-white rounded shadow-md group-hover:bg-brand-700 transition-colors">
              <section.icon className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest">{section.name}</h4>
              <p className="text-[10px] text-slate-400 font-medium mt-2 uppercase tracking-tighter leading-relaxed">{section.desc}</p>
            </div>
          </button>
        ))}
      </div>
      
      <div className="p-10 bg-brand-600 rounded-2xl text-white relative overflow-hidden shadow-2xl border border-brand-500 shadow-brand-500/10">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-md">
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2 uppercase tracking-widest">
              <HelpCircle className="w-4 h-4 text-white/50" />
              Suporte Técnico Avançado
            </h3>
            <p className="text-white/60 text-[10px] uppercase tracking-tighter leading-relaxed">
              Consulte nossa documentação técnica ou entre em contato com um engenheiro de soluções para otimizar sua instância corporativa.
            </p>
          </div>
          <button className="px-8 py-3 bg-white/20 text-white rounded text-[10px] font-bold uppercase tracking-widest hover:bg-white/30 transition-all shadow-lg active:scale-95 whitespace-nowrap border border-white/20">
            Abrir Chamado
          </button>
        </div>
        <div className="absolute -top-10 -right-10 p-8 opacity-5">
          <SettingsIcon className="w-64 h-64 rotate-12" />
        </div>
      </div>
    </div>
  );
}
