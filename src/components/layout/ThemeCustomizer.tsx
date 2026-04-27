import React, { useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { CompanySettings } from '../../types';
import { Palette, X, RotateCcw, Check, Type, Save, CheckCircle, ChevronUp, ChevronDown, List } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../App';
import { cn } from '../../lib/utils';
import { UserRole } from '../../types';

interface ThemeCustomizerProps {
  currentSettings: CompanySettings | null;
  variant?: 'sidebar' | 'header';
}

import { ALL_MENU_ITEMS } from '../../constants/menu';

export default function ThemeCustomizer({ currentSettings, variant = 'sidebar' }: ThemeCustomizerProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [localSettings, setLocalSettings] = useState<Partial<CompanySettings>>({});

  useEffect(() => {
    if (isOpen && currentSettings) {
      setLocalSettings({ ...currentSettings });
      
      // Initialize menu order if it doesn't exist
      if (!currentSettings.menuOrder) {
        setLocalSettings(prev => ({ 
          ...prev, 
          menuOrder: ALL_MENU_ITEMS.map(item => item.id) 
        }));
      }
    }
  }, [isOpen, currentSettings]);

  const moveMenuItem = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...(localSettings.menuOrder || ALL_MENU_ITEMS.map(i => i.id))];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setLocalSettings(prev => ({ ...prev, menuOrder: newOrder }));
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'settings', 'company'), {
        ...localSettings,
        updatedAt: serverTimestamp(),
        updatedBy: user.id
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error updating theme:', error);
    } finally {
      setLoading(false);
    }
  };

  const colors = [
    { label: 'Marca (Botões)', key: 'primaryColor', default: '#8b5cf6' },
    { label: 'Fundo da Página', key: 'backgroundColor', default: '#f8fafc' },
    { label: 'Cor do Texto', key: 'textColor', default: '#1e293b' },
    { label: 'Barra Lateral', key: 'sidebarColor', default: '#0f172a' },
  ];

  const fonts = [
    { label: 'Padrão (Inter)', value: 'Inter, sans-serif' },
    { label: 'Moderno (Space Grotesk)', value: 'Space Grotesk, sans-serif' },
    { label: 'Elegante (Playfair Display)', value: 'Playfair Display, serif' },
    { label: 'Técnico (JetBrains Mono)', value: 'JetBrains Mono, monospace' },
  ];

  const currentOrderedItems = (localSettings.menuOrder || ALL_MENU_ITEMS.map(i => i.id))
    .map(id => ALL_MENU_ITEMS.find(item => item.id === id))
    .filter(Boolean) as typeof ALL_MENU_ITEMS;

  return (
    <div className={variant === 'sidebar' ? "w-full" : "relative"}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={variant === 'sidebar' 
          ? "w-full flex items-center gap-3 px-4 py-3 bg-brand-500/5 hover:bg-brand-500/10 text-brand-400 rounded-lg font-bold transition-all text-sm border border-brand-500/10 active:scale-[0.98]"
          : "flex items-center gap-2 px-3 py-1.5 bg-brand-50 text-brand-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-brand-100 transition-all border border-brand-200 shadow-sm whitespace-nowrap"
        }
      >
        <Palette className={variant === 'sidebar' ? "w-5 h-5" : "w-3.5 h-3.5"} />
        <span className={variant === 'sidebar' ? "flex-1 text-left uppercase tracking-widest text-[10px]" : "uppercase"}>
          {variant === 'sidebar' ? 'Personalizar Aparência' : 'Customizar'}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Preview style injection - allows testing without commiting to Firestore immediately */}
            <style>
              {`
                :root {
                  ${localSettings.primaryColor ? `--color-brand-500: ${localSettings.primaryColor};` : ''}
                  ${localSettings.backgroundColor ? `--bg-color: ${localSettings.backgroundColor};` : ''}
                  ${localSettings.textColor ? `--text-color: ${localSettings.textColor};` : ''}
                  ${localSettings.sidebarColor ? `--sidebar-bg: ${localSettings.sidebarColor};` : ''}
                  ${localSettings.fontFamily ? `--font-family: ${localSettings.fontFamily};` : ''}
                }
              `}
            </style>
            <div 
              className="fixed inset-0 z-[100]" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="fixed lg:absolute bottom-0 lg:bottom-auto lg:top-0 right-0 lg:mt-2 w-full lg:w-80 bg-white rounded-t-3xl lg:rounded-3xl shadow-2xl border border-slate-100 z-[101] overflow-hidden p-8 max-h-[85vh] overflow-y-auto custom-scrollbar flex flex-col"
            >
              <div className="flex items-center justify-between mb-6 sticky top-0 bg-white pb-2 z-10 shrink-0">
                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Aparência do Sistema</h3>
                <button onClick={() => setIsOpen(false)}>
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div className="space-y-8 flex-1">
                {/* Menu Order Section */}
                <div className="space-y-4">
                  <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Ordem do Menu</h4>
                  <div className="space-y-2">
                    {currentOrderedItems.map((item, index) => (
                      <div 
                        key={item.id}
                        className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl"
                      >
                        <List className="w-3.5 h-3.5 text-slate-300" />
                        <span className="flex-1 text-[10px] font-bold text-slate-600 uppercase tracking-tight truncate">{item.label}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moveMenuItem(index, 'up')}
                            disabled={index === 0}
                            className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-200 text-slate-400 disabled:opacity-20"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => moveMenuItem(index, 'down')}
                            disabled={index === currentOrderedItems.length - 1}
                            className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-200 text-slate-400 disabled:opacity-20"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Colors Section */}
                <div className="space-y-6 pt-6 border-t border-slate-100">
                  <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Cores Globais</h4>
                  {colors.map((color) => (
                    <div key={color.key} className="space-y-2">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex justify-between items-center">
                        {color.label}
                        <button 
                          onClick={() => setLocalSettings(prev => ({ ...prev, [color.key]: color.default }))}
                          className="text-brand-500 hover:text-brand-600"
                          title="Resetar"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      </label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="color" 
                          value={(localSettings as any)?.[color.key] || color.default}
                          onChange={(e) => setLocalSettings(prev => ({ ...prev, [color.key]: e.target.value }))}
                          className="w-10 h-10 rounded-xl overflow-hidden cursor-pointer border border-slate-200 shrink-0"
                        />
                        <input 
                          type="text"
                          value={(localSettings as any)?.[color.key] || color.default}
                          onChange={(e) => setLocalSettings(prev => ({ ...prev, [color.key]: e.target.value }))}
                          className="flex-1 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-mono text-slate-600 outline-none focus:ring-2 focus:ring-brand-500/20"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Fonts Section */}
                <div className="space-y-4 pt-6 border-t border-slate-100">
                  <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Tipografia</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {fonts.map((font) => (
                      <button
                        key={font.value}
                        onClick={() => setLocalSettings(prev => ({ ...prev, fontFamily: font.value }))}
                        className={`w-full px-3 py-2 rounded-xl text-left text-xs transition-all border ${
                          localSettings?.fontFamily === font.value
                            ? 'bg-brand-50 border-brand-200 text-brand-700'
                            : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
                        }`}
                        style={{ fontFamily: font.value }}
                      >
                        <div className="flex items-center justify-between">
                          <span>{font.label}</span>
                          {localSettings?.fontFamily === font.value && <Check className="w-3 h-3" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 sticky bottom-0 bg-white space-y-4 shrink-0">
                <button
                  disabled={loading || success}
                  onClick={handleSave}
                  className={cn(
                    "w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all relative overflow-hidden",
                    success 
                      ? "bg-emerald-500 text-white" 
                      : "bg-slate-900 text-white hover:bg-black active:scale-[0.98] disabled:opacity-50"
                  )}
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : success ? (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Salvo com Sucesso!
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Salvar Alterações
                    </>
                  )}
                </button>
                <p className="text-[8px] font-medium text-slate-400 italic text-center leading-normal">
                  As alterações em tempo real são temporárias.<br/>Clique em salvar para aplicar globalmente.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
