import React, { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, Shield, Cpu, Zap, Globe, Phone, ChevronRight, Check } from 'lucide-react';

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}

export default function Login() {
  const [loginMethod, setLoginMethod] = useState<'GOOGLE' | 'PHONE'>('GOOGLE');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loginMethod === 'PHONE' && !window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': () => {
          // reCAPTCHA solved, allow signInWithPhoneNumber.
        }
      });
    }
  }, [loginMethod]);

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      // Add Gmail send scope to allow sending invitations directly from the app
      provider.addScope('https://www.googleapis.com/auth/gmail.send');
      const result = await signInWithPopup(auth, provider);
      
      // Store the access token for direct Gmail sending if needed
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        sessionStorage.setItem('google_access_token', credential.accessToken);
      }
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      setError('Falha na autenticação Google.');
    }
  };

  const handleSendCode = async () => {
    if (!phoneNumber) return;
    setLoading(true);
    setError(null);
    try {
      // Automatic +55 prefix if not present
      let finalPhone = phoneNumber.trim();
      if (!finalPhone.startsWith('+')) {
        // Remove leading 0 if present
        if (finalPhone.startsWith('0')) finalPhone = finalPhone.substring(1);
        finalPhone = `+55${finalPhone.replace(/\D/g, '')}`;
      }

      const appVerifier = window.recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, finalPhone, appVerifier);
      setConfirmationResult(confirmation);
    } catch (error: any) {
      console.error('Erro ao enviar código:', error);
      setError('Erro ao enviar SMS. Verifique o número (ex: +5511999999999).');
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        delete (window as any).recaptchaVerifier;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || !confirmationResult) return;
    setLoading(true);
    setError(null);
    try {
      await confirmationResult.confirm(verificationCode);
    } catch (error) {
      console.error('Erro ao verificar código:', error);
      setError('Código inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 selection:bg-brand-500/30">
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-[440px] relative z-10"
      >
        <div className="text-center mb-10">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-brand-500 to-brand-700 rounded-3xl shadow-2xl shadow-brand-500/20 mb-8 transform -rotate-3"
          >
            <Shield className="w-10 h-10 text-white" />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-4xl font-black text-white tracking-tighter uppercase mb-2"
          >
            Sweet Ice <span className="text-brand-500">PRO</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-[10px] font-black text-slate-400 uppercase tracking-[0.6em]"
          >
            Sistemas de Gestão Inteligente
          </motion.p>
        </div>

        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[32px] p-5 sm:p-8 md:p-12 shadow-2xl">
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Portal de Acesso</h2>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                Sincronize sua identidade corporativa para acessar o ecossistema de produtividade e colaboração em tempo real.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                <Cpu className="w-5 h-5 text-brand-400 mb-2" />
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-tight">Engine de<br/>Alta Performance</p>
              </div>
              <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                <Shield className="w-5 h-5 text-emerald-400 mb-2" />
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-tight">Criptografia<br/>de Ponta</p>
              </div>
            </div>

            <div className="flex p-1 bg-white/5 rounded-2xl border border-white/10">
              <button
                onClick={() => setLoginMethod('GOOGLE')}
                className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                  loginMethod === 'GOOGLE' ? 'bg-white text-slate-900' : 'text-slate-400'
                }`}
              >
                Google
              </button>
              <button
                onClick={() => setLoginMethod('PHONE')}
                className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                  loginMethod === 'PHONE' ? 'bg-white text-slate-900' : 'text-slate-400'
                }`}
              >
                Telefone
              </button>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3"
              >
                <div className="w-5 h-5 bg-rose-500 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <Shield className="w-3 h-3 text-white" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest leading-none">Erro de Segurança</p>
                  <p className="text-[10px] font-bold text-rose-200/60 leading-tight">{error}</p>
                </div>
              </motion.div>
            )}

            {loginMethod === 'GOOGLE' ? (
              <button
                onClick={handleGoogleLogin}
                className="group w-full relative h-16 bg-white rounded-2xl flex items-center justify-center gap-4 transition-all hover:bg-slate-50 hover:scale-[1.02] active:scale-95 shadow-xl shadow-brand-500/5"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                <span className="text-slate-900 font-black text-xs uppercase tracking-[0.2em]">Continuar com Google</span>
                <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-brand-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ) : (
              <div className="space-y-4">
                {!confirmationResult ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2">Número de Celular</label>
                      <div className="relative group">
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/40 text-xs font-black">
                          +55
                        </div>
                        <input 
                          type="tel"
                          placeholder="(00) 00000-0000"
                          value={phoneNumber.startsWith('+55') ? phoneNumber.substring(3) : phoneNumber}
                          onChange={e => setPhoneNumber(e.target.value)}
                          className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 text-white text-xs font-bold focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleSendCode}
                      disabled={loading || !phoneNumber}
                      className="w-full h-14 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl flex items-center justify-center gap-3 transition-all disabled:opacity-50 font-black text-xs uppercase tracking-widest"
                    >
                      {loading ? 'Enviando...' : (
                        <>
                          Enviar Código SMS
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2">Código de Verificação</label>
                      <input 
                        type="text"
                        placeholder="000000"
                        maxLength={6}
                        value={verificationCode}
                        onChange={e => setVerificationCode(e.target.value)}
                        className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 text-white text-xs font-bold tracking-[1em] text-center focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                      />
                    </div>
                    <button
                      onClick={handleVerifyCode}
                      disabled={loading || verificationCode.length < 6}
                      className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl flex items-center justify-center gap-3 transition-all disabled:opacity-50 font-black text-xs uppercase tracking-widest"
                    >
                      {loading ? 'Verificando...' : (
                        <>
                          Validar Acesso
                          <Check className="w-4 h-4" />
                        </>
                      )}
                    </button>
                    <button 
                      onClick={() => setConfirmationResult(null)}
                      className="w-full text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
                    >
                      Voltar e trocar número
                    </button>
                  </div>
                )}
                <div id="recaptcha-container"></div>
              </div>
            )}
          </div>
          
          <div className="mt-12 flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.4em]">Infraestrutura</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
            
            <div className="flex items-center justify-between text-[8px] font-black text-slate-400 uppercase tracking-widest px-2">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                CÉLULA-DF 01
              </div>
              <div className="flex items-center gap-1.5">
                <Globe className="w-3 h-3" />
                SSL ATIVO
              </div>
              <div>VERSÃO 4.2.1-PRO</div>
            </div>
          </div>
        </div>

        <p className="text-center mt-12 text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em]">
          Copyright © 2024 • Todos os Direitos Reservados
        </p>
      </motion.div>
    </div>
  );
}
