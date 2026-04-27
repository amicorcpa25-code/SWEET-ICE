import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../../App';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../../lib/firebase';
import { User, UserRole, UserRoleLabels } from '../../types';
import { 
  User as UserIcon, 
  Mail, 
  Shield, 
  Camera, 
  Save, 
  Loader2, 
  CheckCircle2, 
  Upload, 
  X, 
  RotateCw,
  Maximize2,
  Minimize2,
  Trash2,
  Phone,
  MapPin,
  Check,
  ChevronLeft,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle } from 'lucide-react'; // For WhatsApp style icon
import { cn } from '../../lib/utils';
import Cropper from 'react-easy-crop';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';

// Helper to create a cropped image
const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<Blob> => {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((resolve) => (image.onload = resolve));

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('No 2d context');

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas is empty'));
        return;
      }
      resolve(blob);
    }, 'image/jpeg');
  });
};

interface UserProfileProps {
  onBack?: () => void;
  targetUser?: User; // New prop to edit a specific user
  onDelete?: (userId: string) => Promise<void>;
}

export default function UserProfile({ onBack, targetUser, onDelete }: UserProfileProps) {
  const { user: currentUser, effectiveRole } = useAuth();
  
  // Use targetUser if provided, otherwise the logged in user
  const displayUser = targetUser || currentUser;
  const canEdit = effectiveRole === UserRole.ADMIN || effectiveRole === UserRole.MANAGER || displayUser?.id === currentUser?.id;

  const [formData, setFormData] = useState({
    name: displayUser?.name || '',
    bio: displayUser?.bio || '',
    profilePic: displayUser?.profilePic || '',
    phone: displayUser?.phone || '',
    address: displayUser?.address || '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Sync with user if it changes (e.g. from firestore update)
  useEffect(() => {
    if (displayUser) {
      setFormData({
        name: displayUser.name || '',
        bio: displayUser.bio || '',
        profilePic: displayUser.profilePic || '',
        phone: displayUser.phone || '',
        address: displayUser.address || '',
      });
    }
  }, [displayUser?.id]); // Only re-sync if the user ID changes

  // Photo editing states
  const [showEditor, setShowEditor] = useState(false);
  const [editorMode, setEditorMode] = useState<'upload' | 'camera' | 'crop'>('upload');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const onCropComplete = useCallback((_preventedCroppedArea: any, pixelCrop: any) => {
    setCroppedAreaPixels(pixelCrop);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
        setEditorMode('crop');
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { aspectRatio: 1 } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
      setEditorMode('camera');
    } catch (err) {
      console.error("Camera error:", err);
      alert("Não foi possível acessar a câmera.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const takePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      setImageSrc(canvas.toDataURL('image/jpeg'));
      stopCamera();
      setEditorMode('crop');
    }
  };

  const handleUploadCroppedImage = async () => {
    if (!imageSrc || !croppedAreaPixels || !displayUser?.id) return;

    setIsUploading(true);
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      const storageRef = ref(storage, `profiles/${displayUser.id}/avatar_${Date.now()}.jpg`);
      const snapshot = await uploadBytes(storageRef, croppedBlob);
      const downloadURL = await getDownloadURL(snapshot.ref);

      setFormData(prev => ({ ...prev, profilePic: downloadURL }));
      setShowEditor(false);
      setImageSrc(null);
    } catch (error) {
      console.error("Upload error:", error);
      alert("Erro ao enviar a imagem.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Deseja realmente sair da sua conta?')) {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("Erro ao sair:", error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayUser?.id || !canEdit) return;

    setLoading(true);
    setSuccess(false);

    try {
      const updateData: any = {
        ...formData,
        updatedAt: serverTimestamp(),
      };

      // If completing profile, set the flag
      if (!displayUser?.isProfileComplete && displayUser?.id === currentUser?.id) {
        updateData.isProfileComplete = true;
      }

      await updateDoc(doc(db, 'users', displayUser!.id), updateData);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${displayUser.id}`);
    } finally {
      setLoading(false);
    }
  };

  if (!canEdit && displayUser?.id !== currentUser?.id) {
    return (
      <div className="p-8 text-center bg-red-50 border border-red-100 rounded-2xl max-w-2xl mx-auto">
        <p className="text-red-600 font-bold uppercase tracking-widest text-[10px]">Acesso negado. Você não tem permissão para visualizar este perfil.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="bg-white rounded-[40px] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <div className="bg-brand-600 p-12 text-white relative">
          <div className="relative z-10">
            {onBack && (
              <button 
                onClick={onBack}
                className="mb-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-colors group"
              >
                <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                Voltar
              </button>
            )}
            <h2 className="text-2xl font-black uppercase tracking-tight">{displayUser?.id === currentUser?.id ? 'Meu Perfil' : `Perfil: ${displayUser?.name}`}</h2>
            <p className="text-brand-100 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">Gerenciamento de Identidade</p>
          </div>
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <UserIcon className="w-40 h-40" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-12 space-y-8">
          <div className="flex flex-col items-center gap-6 pb-8 border-b border-slate-100">
            <div className="relative group">
              <div className="w-32 h-32 rounded-[32px] bg-slate-50 border-4 border-white shadow-xl ring-1 ring-slate-100 flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105">
                {formData.profilePic ? (
                  <img src={formData.profilePic} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-12 h-12 text-slate-300" />
                )}
              </div>
              {canEdit && (
                <button 
                  type="button"
                  onClick={() => setShowEditor(true)}
                  className="absolute -bottom-2 -right-2 p-3 bg-brand-600 rounded-2xl shadow-xl text-white border-2 border-white hover:bg-brand-700 transition-all active:scale-90"
                >
                  <Camera className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="text-center">
              <span className="inline-block px-3 py-1 bg-brand-50 text-brand-600 text-[9px] font-black uppercase tracking-widest rounded-full">
                {displayUser?.role ? UserRoleLabels[displayUser.role] : 'Usuário'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome Completo</label>
              <div className="relative group">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-brand-600 transition-colors" />
                <input 
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-4 focus:ring-brand-500/10 transition-all outline-none"
                  placeholder="Seu nome..."
                  required
                  disabled={!canEdit}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Corporativo</label>
              <div className="relative opacity-60">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input 
                  type="email"
                  value={displayUser?.email || ''}
                  disabled
                  className="w-full pl-12 pr-6 py-4 bg-slate-100 border-none rounded-2xl text-xs font-bold outline-none cursor-not-allowed"
                />
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">O email não pode ser alterado por motivos de segurança.</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Biografia / Descrição</label>
              <textarea 
                value={formData.bio}
                onChange={e => setFormData({ ...formData, bio: e.target.value })}
                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-4 focus:ring-brand-500/10 transition-all outline-none min-h-[120px] resize-none"
                placeholder="Conte um pouco sobre suas responsabilidades..."
                disabled={!canEdit}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Telefone / WhatsApp</label>
                <div className="relative group">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-brand-600 transition-colors" />
                  <input 
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-4 focus:ring-brand-500/10 transition-all outline-none"
                    placeholder="(00) 00000-0000"
                    disabled={!canEdit}
                  />
                  {formData.phone && (
                    <a 
                      href={`https://wa.me/${formData.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 hover:text-emerald-600 transition-colors"
                      title="Testar WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Endereço Residencial/Comercial</label>
                <div className="relative group">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-brand-600 transition-colors" />
                  <input 
                    type="text"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    className="w-full pl-12 pr-12 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-4 focus:ring-brand-500/10 transition-all outline-none"
                    placeholder="Rua, Número, Bairro, Cidade..."
                    disabled={!canEdit}
                  />
                  {formData.address && (
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formData.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-500 hover:text-brand-600 transition-colors"
                      title="Ver no Google Maps"
                    >
                      <MapPin className="w-4 h-4 text-brand-600" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alternar URL Manualmente</label>
              <input 
                type="url"
                value={formData.profilePic}
                onChange={e => setFormData({ ...formData, profilePic: e.target.value })}
                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-4 focus:ring-brand-500/10 transition-all outline-none"
                placeholder="https://exemplo.com/sua-foto.jpg"
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="pt-6 space-y-4">
            {canEdit && (
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full py-5 rounded-[24px] text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 active:scale-95 shadow-xl",
                  success 
                    ? "bg-emerald-500 text-white shadow-emerald-500/20" 
                    : "bg-brand-600 text-white shadow-brand-500/20 hover:bg-brand-700"
                )}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : success ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {loading ? 'Salvando...' : success ? 'Perfil Atualizado!' : (!displayUser?.isProfileComplete && displayUser?.id === currentUser?.id) ? 'Finalizar Cadastro e Entrar' : 'Salvar Alterações'}
              </button>
            )}

            {targetUser && targetUser.id !== currentUser?.id && (effectiveRole === UserRole.ADMIN || effectiveRole === UserRole.MANAGER) && (
              <div className="pt-10 border-t border-slate-100 mt-10">
                <div className="mb-6">
                  <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] mb-1">Zona Crítica</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                    A exclusão removerá o acesso do membro, mas manterá seus dados históricos em relatórios para auditoria.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete?.(targetUser.id)}
                  className="w-full py-5 rounded-[24px] text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 active:scale-95 text-white bg-rose-500 hover:bg-rose-600 shadow-xl shadow-rose-500/20"
                >
                  <Trash2 className="w-5 h-5 text-white" />
                  Excluir Membro Definitivamente
                </button>
              </div>
            )}

            {displayUser?.id === currentUser?.id && (
              <div className="pt-8 border-t border-slate-100 mt-8">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-5 rounded-[24px] text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 active:scale-95 text-red-500 bg-red-50 hover:bg-red-100"
                >
                  <LogOut className="w-5 h-5" />
                  Sair da Conta
                </button>
              </div>
            )}
          </div>
        </form>
      </div>

      <AnimatePresence>
        {showEditor && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Editar Foto</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sua foto atualiza instantaneamente</p>
                </div>
                <button 
                  onClick={() => {
                    setShowEditor(false);
                    stopCamera();
                    setImageSrc(null);
                    setEditorMode('upload');
                  }}
                  className="p-2 bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 min-h-[400px] relative bg-slate-50">
                {editorMode === 'upload' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center text-slate-400">
                    <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <Upload className="w-10 h-10 text-brand-600" />
                    </div>
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-2">Escolha uma imagem</h4>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-8 leading-relaxed max-w-[200px]">FORMATOS ACEITOS: JPG, PNG OU CAPTURA DE CÂMERA</p>
                    
                    <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 flex items-center justify-center gap-2 py-4 bg-brand-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-brand-500/20 active:scale-95 transition-all"
                      >
                        <Upload className="w-4 h-4" />
                        Arquivo
                      </button>
                      <button 
                        onClick={startCamera}
                        className="flex-1 flex items-center justify-center gap-2 py-4 bg-brand-50 text-brand-600 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-brand-100 active:scale-95 transition-all"
                      >
                        <Camera className="w-4 h-4" />
                        Câmera
                      </button>
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      accept="image/*" 
                      className="hidden" 
                    />
                  </div>
                )}

                {editorMode === 'camera' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black overflow-hidden relative">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6">
                      <button 
                        onClick={() => {
                          stopCamera();
                          setEditorMode('upload');
                        }}
                        className="p-4 bg-white/20 backdrop-blur-xl rounded-full text-white hover:bg-white/30 transition-all"
                      >
                        <X className="w-6 h-6" />
                      </button>
                      <button 
                        onClick={takePhoto}
                        className="w-20 h-20 bg-white rounded-full border-8 border-brand-600 shadow-2xl flex items-center justify-center hover:scale-110 active:scale-90 transition-all"
                      >
                        <div className="w-12 h-12 bg-white rounded-full" />
                      </button>
                      <button className="p-4 bg-emerald-100/20 backdrop-blur-xl rounded-full text-emerald-400 opacity-0 cursor-default">
                        <Check className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                )}

                {editorMode === 'crop' && imageSrc && (
                  <div className="absolute inset-0">
                    <Cropper
                      image={imageSrc}
                      crop={crop}
                      zoom={zoom}
                      aspect={1}
                      onCropChange={setCrop}
                      onZoomChange={setZoom}
                      onCropComplete={onCropComplete}
                      cropShape="rect"
                      showGrid={true}
                    />
                  </div>
                )}
              </div>

              <div className="p-8 bg-white border-t border-slate-100">
                {editorMode === 'crop' && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <Minimize2 className="w-4 h-4 text-slate-400" />
                      <input 
                        type="range"
                        min={1}
                        max={3}
                        step={0.1}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="flex-1 accent-brand-600"
                      />
                      <Maximize2 className="w-4 h-4 text-slate-400" />
                    </div>

                    <div className="flex gap-4">
                      <button 
                        onClick={() => {
                          setImageSrc(null);
                          setEditorMode('upload');
                        }}
                        className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                      >
                        Reiniciar
                      </button>
                      <button 
                        onClick={handleUploadCroppedImage}
                        disabled={isUploading}
                        className="flex-[2] py-4 bg-brand-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-brand-500/20 hover:bg-brand-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        {isUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        {isUploading ? 'Processando...' : 'Aplicar Foto'}
                      </button>
                    </div>
                  </div>
                )}
                
                {editorMode !== 'crop' && (
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center italic">
                    {editorMode === 'camera' ? 'Capture o seu melhor ângulo' : 'Arraste um arquivo ou use os botões acima'}
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

