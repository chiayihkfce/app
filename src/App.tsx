import { useState, useEffect, useRef } from 'react';
import { BookOpen, Briefcase, Settings, ChevronRight, CheckCircle2, Trash2, Edit2, X, QrCode, Save, ChevronUp, Image as ImageIcon, Loader2, Clock, MapPin, Star, MoreHorizontal, ArrowLeft } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Html5QrcodeScanner } from "html5-qrcode";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";
import { motion, AnimatePresence } from 'framer-motion';

import 'leaflet/dist/leaflet.css';
import heroImage from './assets/hero.png';

// --- 打字機組件 ---
const TypewriterText = ({ text }: { text: string }) => {
  const [displayedText, setDisplayedText] = useState("");
  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      setDisplayedText(text.slice(0, i));
      i++;
      if (i > text.length) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [text]);
  return <p>{displayedText}</p>;
};

// --- 本地圖標設定 ---
const createCustomIcon = (color: string, isCurrent: boolean) => L.divIcon({
  html: `<div style="background-color: ${color}; width: ${isCurrent ? '40px' : '30px'}; height: ${isCurrent ? '40px' : '30px'}; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 0 15px rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: center;"><div style="transform: rotate(45deg); color: white;">${isCurrent ? '★' : ''}</div></div>`,
  className: 'custom-div-icon', iconSize: [40, 40], iconAnchor: [20, 40],
});

export type UnlockType = 'PASSWORD' | 'GPS' | 'QR_CODE';
export interface Stage {
  id: string; order: number; title: string; speaker: string; storyContent: string; imageUrl?: string; unlockType: UnlockType; unlockAnswer: string; lat?: number; lng?: number; hints: string[]; successMessage: string; itemReward?: string;
}
export interface Game { title: string; stages: Stage[]; }

const VERSION = "4.2.3";
const DEFAULT_GAME: Game = {
  title: '我的新遊戲',
  stages: [{
    id: 's1', order: 1, title: '時空的起點', speaker: '白鸞卿', storyContent: '我建立了一個新遊戲，快來玩玩看我做的遊戲！', imageUrl: '', unlockType: 'PASSWORD', unlockAnswer: '1234', hints: ['提示：初始密碼為 1234'], successMessage: '恭喜完成第一站！'
  }]
};

export default function App() {
  const [game, setGame] = useState<Game>(DEFAULT_GAME);
  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [inventory, setInventory] = useState<string[]>([]);
  const [userInput, setUserInput] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [solved, setSolved] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [panelMode, setPanelMode] = useState<'closed' | 'story' | 'backpack' | 'admin'>('story');
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLogged, setIsLogged] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "games", "shinkang_v4"), (snapshot) => {
      if (snapshot.exists()) setGame(snapshot.data() as Game);
      else setDoc(doc(db, "games", "shinkang_v4"), DEFAULT_GAME);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsubscribe();
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingStage) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `missions/${editingStage.id}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      const updatedStage = { ...editingStage, imageUrl: url };
      setEditingStage(updatedStage);
      const updatedStages = game.stages.map(s => s.id === editingStage.id ? updatedStage : s);
      setGame({ ...game, stages: updatedStages });
      alert("圖片上傳成功！");
    } catch (err: any) { 
      console.error(err);
      alert("上傳失敗：" + (err.message || "未知錯誤")); 
    } finally { 
      setUploading(false); 
    }
  };

  const currentStage = game.stages[currentStageIdx] || game.stages[0];

  useEffect(() => {
    if (isScanning && currentStage) {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
      scanner.render((text) => {
        if (text.toLowerCase() === currentStage.unlockAnswer.toLowerCase()) {
          scanner.clear(); setIsScanning(false); setSolved(true);
        } else alert("內容不符！");
      }, () => {});
      return () => { scanner.clear().catch(() => {}); };
    }
  }, [isScanning, currentStage]);

  if (loading) return <div className="h-screen bg-white flex items-center justify-center text-blue-500 font-bold animate-pulse flex-col gap-4"><span>系統連線中...</span></div>;

  return (
    <div className="h-screen w-full bg-slate-50 overflow-hidden relative font-sans text-slate-700">
      {/* --- 背景地圖 --- */}
      <div className="absolute inset-0 z-0">
        <MapContainer center={[currentStage.lat || 23.55, currentStage.lng || 120.35]} zoom={17} zoomControl={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {game.stages.map((s, idx) => ( s.lat && s.lng && (
              <Marker key={s.id} position={[s.lat, s.lng]} icon={createCustomIcon(idx === currentStageIdx ? '#2ca6e0' : idx < currentStageIdx ? '#bed53f' : '#bdbdbd', idx === currentStageIdx)} eventHandlers={{ click: () => { setCurrentStageIdx(idx); setPanelMode('story'); setSolved(false); } }} />
          )))}
        </MapContainer>
      </div>

      {/* --- 頂部狀態列 --- */}
      <div className="absolute top-8 left-6 right-6 z-10 flex justify-between items-center pointer-events-none">
         <div className="bg-white/90 backdrop-blur-md px-5 py-2.5 rounded-2xl shadow-xl text-slate-800 font-bold border-2 border-slate-200 pointer-events-auto flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 border border-blue-200"><MapPin size={18}/></div>
            <span>{game.title}</span>
         </div>
         <div className="flex gap-3 pointer-events-auto">
            <button onClick={() => setPanelMode('backpack')} className="w-12 h-12 bg-white/90 backdrop-blur-md rounded-2xl flex items-center justify-center text-slate-600 shadow-xl border-2 border-slate-200 active:scale-95 transition-all"><Briefcase size={22}/></button>
            <button onClick={() => setPanelMode('admin')} className="w-12 h-12 bg-white/90 backdrop-blur-md rounded-2xl flex items-center justify-center text-slate-600 shadow-xl border-2 border-slate-200 active:scale-95 transition-all"><Settings size={22}/></button>
         </div>
      </div>

      <AnimatePresence>
        {panelMode !== 'closed' && !isAdmin && (
          <motion.div initial={{ y: "100%" }} animate={{ y: "0%" }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 200 }} className="absolute bottom-0 left-0 right-0 z-[100] h-[88vh] bg-white rounded-t-[40px] shadow-[0_-20px_60px_rgba(0,0,0,0.15)] border-t-2 border-slate-200 flex flex-col overflow-hidden">
            {/* --- 控制條 --- */}
            <div className="flex flex-col items-center pt-4 pb-2 shrink-0 border-b-2 border-slate-100">
               <div className="w-12 h-1.5 bg-slate-300 rounded-full mb-4 cursor-pointer" onClick={() => setPanelMode('closed')}/>
               <div className="w-full flex items-center justify-between px-8 pb-2">
                  <button onClick={() => setPanelMode('closed')} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-800 transition-colors"><ArrowLeft size={24} /></button>
                  <span className="font-black text-slate-800 tracking-widest text-xs uppercase opacity-50">Operational Panel</span>
                  <div className="w-10 h-10 flex items-center justify-center text-slate-400"><MoreHorizontal size={24} /></div>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 pb-12 scroll-smooth">
               {panelMode === 'story' && (
                 <div className="space-y-10 pt-6">
                    {/* --- 主視覺 --- */}
                    <div className="relative group">
                       <div className="aspect-[4/3] rounded-[32px] overflow-hidden shadow-2xl border-2 border-slate-300 bg-slate-100">
                          <img 
                             src={currentStage.imageUrl || heroImage} 
                             className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                             alt="Mission" 
                             onError={(e) => { const t = e.target as HTMLImageElement; if (t.src !== heroImage) t.src = heroImage; }}
                          />
                       </div>
                       <div className="absolute -bottom-4 left-6 bg-blue-600 text-white px-5 py-2 rounded-xl font-black shadow-lg shadow-blue-600/30 text-xs tracking-widest uppercase italic border border-white/20">
                          Node {currentStageIdx + 1}
                       </div>
                    </div>

                    {/* --- 標題與評分 (極端強制橫向) --- */}
                    <div className="space-y-4 pt-2">
                       <h2 className="text-3xl font-black text-slate-900 leading-tight tracking-tight">{currentStage.title}</h2>
                       <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px', flexWrap: 'nowrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '4px', flexWrap: 'nowrap' }}>
                             <Star size={22} fill="#f59e0b" color="#f59e0b" strokeWidth={0} />
                             <Star size={22} fill="#f59e0b" color="#f59e0b" strokeWidth={0} />
                             <Star size={22} fill="#f59e0b" color="#f59e0b" strokeWidth={0} />
                             <Star size={22} fill="#f59e0b" color="#f59e0b" strokeWidth={0} />
                             <Star size={22} fill="#e2e8f0" color="#e2e8f0" strokeWidth={0} />
                             <span style={{ color: '#94a3b8', fontWeight: '900', marginLeft: '8px', fontSize: '14px' }}>(4.0)</span>
                          </div>
                          <div style={{ width: '2px', height: '16px', backgroundColor: '#f1f5f9' }} />
                          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '13px', fontWeight: '800', letterSpacing: '0.05em' }}>
                             <Clock size={14}/> 15 MINS
                          </div>
                       </div>
                    </div>

                    {/* --- 故事對話區 (加強框線) --- */}
                    <div className="bg-slate-50 p-7 rounded-[32px] border-2 border-slate-200 shadow-sm space-y-4">
                       <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-slate-800 rounded-full flex items-center justify-center text-white font-black text-[11px] border-2 border-white/10 shadow-md">{currentStage.speaker[0]}</div>
                          <span className="font-black text-slate-900 text-xs tracking-[0.2em] uppercase">{currentStage.speaker}</span>
                       </div>
                       <div className="text-slate-700 leading-relaxed font-bold text-lg italic tracking-tight">
                          <TypewriterText text={currentStage.storyContent} />
                       </div>
                    </div>

                    {/* --- 互動操作區 --- */}
                    <div className="space-y-6">
                       {!solved ? (
                         <div className="space-y-4">
                            {currentStage.unlockType === 'PASSWORD' ? (
                              <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] ml-4">Access Key Required</label>
                                <input type="text" value={userInput} onChange={e => setUserInput(e.target.value)} placeholder="••••••••" className="w-full bg-white border-2 border-slate-300 focus:border-blue-600 rounded-[24px] py-5 px-8 outline-none font-black text-center text-2xl tracking-[0.3em] transition-all placeholder:text-slate-200 shadow-inner" />
                                <button onClick={() => { if(userInput.trim().toLowerCase() === currentStage.unlockAnswer.toLowerCase()) setSolved(true); else alert('密碼錯誤'); }} className="w-full bg-slate-900 text-white py-5 rounded-[24px] font-black tracking-widest text-lg shadow-xl active:scale-[0.98] transition-all border border-white/10 uppercase hover:bg-black">Authorize</button>
                              </div>
                            ) : currentStage.unlockType === 'GPS' ? (
                              <button onClick={() => navigator.geolocation.getCurrentPosition(pos => {
                                const d = L.latLng(pos.coords.latitude, pos.coords.longitude).distanceTo(L.latLng(currentStage.lat!, currentStage.lng!));
                                if(d < 100) setSolved(true); else alert(`範圍外 (${Math.round(d)}m)`);
                              })} className="w-full bg-blue-600 text-white py-5 rounded-[24px] font-black tracking-widest text-lg shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 active:scale-[0.98] transition-all border border-white/10 uppercase">Ping Location</button>
                            ) : (
                              <button onClick={() => setIsScanning(true)} className="w-full bg-blue-600 text-white py-5 rounded-[24px] font-black tracking-widest text-lg shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 active:scale-[0.98] transition-all border border-white/10 uppercase">Launch Scanner</button>
                            )}
                            
                            <button onClick={() => setShowHint(!showHint)} className="w-full py-4 text-slate-400 font-black text-[10px] uppercase tracking-[0.6em] text-center hover:text-blue-600 transition-colors">Request Intel</button>
                            {showHint && (
                              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-amber-50 border-2 border-amber-200 p-6 rounded-[24px] text-amber-800 font-bold text-sm leading-relaxed text-center shadow-md">
                                 {currentStage.hints[0]}
                              </motion.div>
                            )}
                         </div>
                       ) : (
                         <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-emerald-50 border-2 border-emerald-200 p-10 rounded-[40px] text-center space-y-6 shadow-lg">
                            <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center text-white mx-auto shadow-xl shadow-emerald-500/20 border-4 border-white"><CheckCircle2 size={40} /></div>
                            <div className="space-y-2">
                               <p className="text-emerald-700 font-black text-3xl tracking-tighter uppercase">Mission Clear</p>
                               <p className="text-emerald-600/70 font-bold text-sm italic">{currentStage.successMessage}</p>
                            </div>
                            <button onClick={() => { if(currentStage.itemReward) setInventory([...inventory, currentStage.itemReward]); setSolved(false); setCurrentStageIdx(prev => (prev+1)%game.stages.length); setUserInput(''); setShowHint(false); }} className="w-full bg-emerald-600 text-white py-5 rounded-[24px] font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20 active:scale-[0.98] transition-all border border-white/10 uppercase">Proceed</button>
                         </motion.div>
                       )}
                    </div>

                    {/* --- 關於與難度 (加強框線與對比) --- */}
                    <div className="grid grid-cols-2 gap-5 pb-10">
                       <div className="bg-white border-2 border-slate-300 p-6 rounded-[32px] space-y-2 shadow-sm text-center">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block">Difficulty</span>
                          <div className="flex flex-row items-center justify-center gap-2">
                             <div className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-rose-600/20 shadow-sm" />
                             <div className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-rose-600/20 shadow-sm" />
                             <div className="w-2.5 h-2.5 rounded-full bg-slate-200 border border-slate-300/20 shadow-inner" />
                          </div>
                       </div>
                       <div className="bg-white border-2 border-slate-300 p-6 rounded-[32px] space-y-2 shadow-sm text-center">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block">Artifacts</span>
                          <span className="block font-black text-slate-900 text-xs truncate uppercase tracking-tighter">{currentStage.itemReward || "UNIDENTIFIED"}</span>
                       </div>
                    </div>
                 </div>
               )}

               {panelMode === 'backpack' && (
                 <div className="py-10 space-y-12">
                    <div className="text-center space-y-2">
                       <h2 className="text-5xl font-black text-slate-900 tracking-tighter italic">STORAGE</h2>
                       <p className="text-slate-400 font-bold text-[11px] uppercase tracking-[0.5em] opacity-60">Asset Management System</p>
                    </div>
                    {inventory.length === 0 ? (
                      <div className="py-24 flex flex-col items-center text-slate-300 border-2 border-dashed border-slate-200 rounded-[48px] bg-slate-50/50">
                         <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 border-2 border-slate-100 shadow-inner"><Briefcase size={48} className="opacity-20"/></div>
                         <p className="font-black text-sm tracking-[0.4em] uppercase opacity-40">No Assets Found</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-6">
                        {inventory.map((item, i) => (
                          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} key={i} className="bg-white border-2 border-slate-300 p-8 rounded-[40px] flex flex-col items-center gap-6 text-center shadow-md hover:shadow-2xl hover:border-blue-500 transition-all group">
                            <div className="w-20 h-20 bg-blue-50 rounded-[28px] flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 border-2 border-blue-100/50 shadow-sm"><BookOpen size={32}/></div>
                            <span className="font-black text-slate-900 text-sm tracking-tight uppercase">{item}</span>
                          </motion.div>
                        ))}
                      </div>
                    )}
                 </div>
               )}

               {panelMode === 'admin' && (
                 <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 space-y-12">
                    <div className="relative">
                       <div className="w-36 h-32 bg-white rounded-[56px] flex items-center justify-center text-slate-200 border-4 border-slate-300 shadow-2xl"><Settings size={64} /></div>
                       <div className="absolute -top-2 -right-2 w-10 h-10 bg-rose-600 rounded-full border-4 border-white shadow-xl animate-ping opacity-75" />
                       <div className="absolute -top-2 -right-2 w-10 h-10 bg-rose-600 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-white font-black text-[10px]">!!</div>
                    </div>
                    <div className="text-center space-y-4">
                       <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">Restricted</h2>
                       <p className="text-slate-400 text-sm font-bold max-w-[220px] mx-auto leading-relaxed uppercase tracking-[0.2em] opacity-70">L-Level Clearance Required For System Access</p>
                    </div>
                    <button onClick={() => setIsAdmin(true)} className="w-full bg-slate-950 text-white py-6 rounded-[32px] font-black tracking-[0.3em] text-lg shadow-2xl active:scale-95 transition-all border border-white/10 uppercase hover:bg-black">Initiate Auth</button>
                 </div>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- 管理員編輯介面 (加強視覺) --- */}
      {isAdmin && (
        <div className="absolute inset-0 z-[1000] bg-white overflow-y-auto text-slate-900 pb-20 font-sans">
           {!isLogged ? (
             <div className="h-screen bg-slate-100 flex items-center justify-center p-8">
               <div className="bg-white p-14 rounded-[56px] shadow-[0_40px_100px_rgba(0,0,0,0.2)] w-full max-w-md border-2 border-slate-300 space-y-12 text-center">
                 <div className="space-y-3">
                    <h1 className="text-4xl font-black tracking-tighter italic uppercase leading-none">Security Console</h1>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.6em] opacity-50">Authorized Personnel Only</p>
                 </div>
                 <input type="password" value={adminPass} onChange={e => setAdminPass(e.target.value)} placeholder="••••" className="w-full bg-slate-50 border-2 border-slate-300 focus:border-blue-600 rounded-[32px] py-7 px-8 outline-none text-center font-black text-5xl tracking-[0.8em] transition-all shadow-inner" />
                 <div className="space-y-4">
                    <button onClick={() => { if(adminPass === '8888') setIsLogged(true); else alert('身分證失敗'); }} className="w-full bg-slate-900 text-white py-6 rounded-[28px] font-black tracking-widest shadow-2xl border border-white/10 uppercase text-sm hover:bg-black">Decrypt & Access</button>
                    <button onClick={() => setIsAdmin(false)} className="text-slate-400 font-black text-[10px] uppercase tracking-[0.5em] hover:text-rose-600 transition-colors">Terminate Link</button>
                 </div>
               </div>
             </div>
           ) : (
             <div className="max-w-5xl mx-auto p-12">
                {editingStage && (
                  <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[2000] flex items-center justify-center p-6 overflow-y-auto">
                    <div className="bg-white w-full max-w-3xl rounded-[56px] p-14 space-y-10 shadow-[0_50px_150px_rgba(0,0,0,0.5)] border-2 border-slate-300">
                       <div className="flex justify-between items-center pb-6 border-b-2 border-slate-100">
                          <h3 className="text-4xl font-black tracking-tighter italic uppercase">Node Configuration</h3>
                          <button onClick={() => setEditingStage(null)} className="w-14 h-14 flex items-center justify-center bg-slate-100 rounded-3xl text-slate-600 hover:bg-rose-500 hover:text-white transition-all border-2 border-slate-200 shadow-sm"><X size={28}/></button>
                       </div>
                       <div className="space-y-8">
                          <div className="space-y-4">
                             <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] ml-6 opacity-70">Visual Resource</label>
                             <div onClick={() => fileInputRef.current?.click()} className="h-72 w-full rounded-[40px] border-4 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all overflow-hidden relative group shadow-inner">
                                {editingStage.imageUrl ? (
                                  <>
                                    <img src={editingStage.imageUrl} className="w-full h-full object-cover" alt="Preview" />
                                    <div className="absolute inset-0 bg-slate-900/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-sm">
                                       <div className="bg-white/20 px-8 py-4 rounded-full border-2 border-white/30 text-white font-black tracking-[0.2em] uppercase text-xs">Update Asset</div>
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-center text-slate-300">
                                    {uploading ? <Loader2 className="animate-spin mx-auto mb-4 text-blue-600" size={40} /> : <ImageIcon size={64} className="mx-auto mb-4 opacity-20"/>}
                                    <p className="font-black text-xs uppercase tracking-[0.4em]">Mount Storage</p>
                                  </div>
                                )}
                                {uploading && <div className="absolute inset-0 bg-white/95 flex items-center justify-center font-black text-blue-600 animate-pulse uppercase tracking-[0.5em] text-sm">Processing Payload...</div>}
                             </div>
                             <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
                          </div>
                          <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 ml-6 uppercase tracking-[0.3em]">Node Title</label><input className="w-full bg-slate-50 border-2 border-slate-200 rounded-[24px] py-5 px-8 outline-none font-black focus:border-blue-600 focus:bg-white transition-all" value={editingStage.title} onChange={e => setEditingStage({...editingStage, title: e.target.value})} /></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 ml-6 uppercase tracking-[0.3em]">Identity</label><input className="w-full bg-slate-50 border-2 border-slate-200 rounded-[24px] py-5 px-8 outline-none font-black focus:border-blue-600 focus:bg-white transition-all" value={editingStage.speaker} onChange={e => setEditingStage({...editingStage, speaker: e.target.value})} /></div>
                          </div>
                          <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 ml-6 uppercase tracking-[0.3em]">Narrative Protocol</label><textarea className="w-full bg-slate-50 border-2 border-slate-200 rounded-[24px] p-8 h-48 outline-none font-bold leading-relaxed focus:border-blue-600 focus:bg-white transition-all" value={editingStage.storyContent} onChange={e => setEditingStage({...editingStage, storyContent: e.target.value})} /></div>
                          <div className="grid grid-cols-2 gap-8">
                             <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 ml-6 uppercase tracking-[0.3em]">Unlock Mechanism</label><select className="w-full bg-slate-50 border-2 border-slate-200 rounded-[24px] py-5 px-8 outline-none font-black appearance-none focus:border-blue-600 focus:bg-white transition-all" value={editingStage.unlockType} onChange={e => setEditingStage({...editingStage, unlockType: e.target.value as any})}><option value="PASSWORD">Password Auth</option><option value="GPS">GPS Geofencing</option><option value="QR_CODE">QR Code Scan</option></select></div>
                             <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 ml-6 uppercase tracking-[0.3em]">Access Key</label><input className="w-full bg-slate-50 border-2 border-slate-200 rounded-[24px] py-5 px-8 outline-none font-black focus:border-blue-600 focus:bg-white transition-all" value={editingStage.unlockAnswer} onChange={e => setEditingStage({...editingStage, unlockAnswer: e.target.value})} /></div>
                          </div>
                          
                          <div className="h-56 rounded-[32px] overflow-hidden border-2 border-slate-300 shadow-inner bg-slate-100">
                            <MapContainer center={[editingStage.lat || 23.55, editingStage.lng || 120.35]} zoom={15} style={{ height: '100%', width: '100%' }}>
                              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                              {editingStage.lat !== undefined && editingStage.lng !== undefined && <Marker position={[editingStage.lat, editingStage.lng]} />}
                              <MapPickerEvents onPick={(lat, lng) => setEditingStage({...editingStage, lat, lng})} />
                            </MapContainer>
                          </div>

                          <button onClick={() => {
                            const newStages = editingStage.id === 'NEW' ? [...game.stages, {...editingStage, id: Date.now().toString()}] : game.stages.map(s => s.id === editingStage.id ? editingStage : s);
                            setGame({...game, stages: newStages}); setEditingStage(null);
                          }} className="w-full bg-blue-600 text-white py-7 rounded-[32px] font-black uppercase tracking-[0.4em] shadow-2xl shadow-blue-600/30 active:scale-[0.98] transition-all border border-white/20 text-lg hover:bg-blue-700">Commit Node Changes</button>
                       </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 mb-20 border-b-8 border-slate-900 pb-12">
                   <div className="space-y-5">
                      <div className="flex items-center gap-6">
                         <div className="w-16 h-16 bg-slate-950 rounded-[28px] flex items-center justify-center text-white shadow-xl"><Settings size={32}/></div>
                         <h1 className="text-7xl font-black tracking-tighter italic uppercase leading-none">Console</h1>
                      </div>
                      <div className="flex items-center gap-4 opacity-40">
                         <p className="text-slate-900 font-black text-[11px] uppercase tracking-[0.8em]">Build Revision v{VERSION}</p>
                         <div className="h-px flex-1 bg-slate-900 min-w-[100px]" />
                      </div>
                   </div>
                   <div className="flex gap-5 w-full lg:w-auto">
                      <button onClick={async () => { await setDoc(doc(db, "games", "shinkang_v4"), game); alert("雲端核心已更新"); }} className="flex-1 lg:flex-none bg-emerald-500 text-white px-10 py-6 rounded-[32px] font-black flex items-center justify-center gap-4 shadow-2xl shadow-emerald-500/30 active:scale-95 transition-all border border-white/10 uppercase text-xs hover:bg-emerald-600">Deploy Changes</button>
                      <button onClick={() => { setIsAdmin(false); setIsLogged(false); setAdminPass(''); }} className="flex-1 lg:flex-none bg-white border-2 border-slate-900 px-10 py-6 rounded-[32px] font-black text-slate-900 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all uppercase tracking-[0.2em] text-xs shadow-lg">Kill Session</button>
                   </div>
                </div>

                <div className="space-y-12">
                   <div className="bg-white p-14 rounded-[64px] shadow-2xl border-2 border-slate-900 flex items-center justify-between group relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 -mr-16 -mt-16 rounded-full opacity-50" />
                      <div className="flex-1 relative z-10">
                         <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.8em] block mb-4 opacity-60">System Identifier</label>
                         <input className="text-5xl font-black w-full outline-none text-slate-950 focus:text-blue-600 transition-colors uppercase tracking-tighter bg-transparent" value={game.title} onChange={e => setGame({...game, title: e.target.value})} />
                      </div>
                      <button onClick={() => setEditingStage({ id: 'NEW', order: game.stages.length+1, title: 'NEW MISSION', speaker: 'AGENT', storyContent: 'Initialize mission narrative here...', unlockType: 'PASSWORD', unlockAnswer: '0000', hints: ['Intel encrypted'], successMessage: 'Access granted' })} className="bg-slate-950 text-white w-24 h-24 rounded-[36px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center justify-center hover:rotate-90 transition-all duration-1000 active:scale-90 border-2 border-white/10 relative z-10 hover:bg-blue-600"><PlusIcon size={48}/></button>
                   </div>

                   <div className="grid gap-8">
                      {game.stages.map((s, i) => (
                        <div key={s.id} className="bg-white p-12 rounded-[56px] border-2 border-slate-300 flex items-center gap-12 hover:shadow-2xl hover:border-blue-600 transition-all group relative overflow-hidden">
                           <div className="absolute top-0 left-0 w-3 h-full bg-slate-100 group-hover:bg-blue-600 transition-colors" />
                           <div className="w-24 h-24 bg-slate-50 rounded-[32px] flex items-center justify-center font-black text-slate-300 text-4xl group-hover:bg-blue-50 group-hover:text-blue-600 transition-all shadow-inner border-2 border-slate-100">{i+1}</div>
                           <div className="flex-1">
                              <h4 className="text-3xl font-black text-slate-950 mb-3 tracking-tighter uppercase leading-none">{s.title}</h4>
                              <div className="flex flex-wrap gap-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">
                                 <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-600 shadow-sm"/> {s.unlockType}</span>
                                 <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm"/> Key: {s.unlockAnswer}</span>
                              </div>
                           </div>
                           <div className="flex gap-5">
                              <button onClick={() => setEditingStage(s)} className="w-20 h-20 bg-white border-2 border-slate-300 text-slate-400 hover:bg-blue-600 hover:text-white hover:border-blue-600 rounded-[32px] flex items-center justify-center transition-all active:scale-90 shadow-lg group/btn"><Edit2 size={32}/></button>
                              <button onClick={() => { if(confirm('永久刪除？')) setGame({...game, stages: game.stages.filter(item => item.id !== s.id)}) }} className="w-20 h-20 bg-white border-2 border-slate-300 text-slate-400 hover:bg-rose-600 hover:text-white hover:border-rose-600 rounded-[32px] flex items-center justify-center transition-all active:scale-90 shadow-lg group/btn"><Trash2 size={32}/></button>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
           )}
        </div>
      )}

      {/* --- 全螢幕掃描器 --- */}
      {isScanning && (
        <div className="absolute inset-0 bg-slate-950 z-[2000] flex flex-col items-center justify-center p-10">
           <div className="w-full max-w-sm aspect-square bg-black rounded-[56px] overflow-hidden border-4 border-blue-600 shadow-[0_0_150px_rgba(37,99,235,0.4)] mb-20 relative">
              <div id="reader" className="w-full h-full scale-110"></div>
              <div className="absolute inset-x-0 top-1/2 h-1 bg-blue-500 shadow-[0_0_30px_rgba(37,99,235,1)] animate-scan opacity-50" />
           </div>
           <button onClick={() => setIsScanning(false)} className="bg-white/5 text-white/50 px-20 py-7 rounded-[32px] font-black tracking-[0.5em] text-xs hover:bg-rose-600 hover:text-white transition-all active:scale-95 border-2 border-white/10 uppercase backdrop-blur-md">Abort Scanner</button>
        </div>
      )}

      {/* --- 開啟按鈕 --- */}
      {panelMode === 'closed' && !isAdmin && (
        <div className="absolute bottom-12 left-0 right-0 z-10 flex justify-center animate-bounce-slow">
           <button onClick={() => setPanelMode('story')} className="bg-slate-950 text-white px-14 py-7 rounded-full font-black flex items-center gap-5 shadow-[0_30px_60px_rgba(0,0,0,0.4)] border-2 border-white/10 active:scale-95 transition-all uppercase tracking-[0.3em] text-xs hover:bg-black">
              Launch Interface <ChevronUp size={24} />
           </button>
        </div>
      )}
    </div>
  );
}

function MapPickerEvents({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e: L.LeafletMouseEvent) { onPick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

const PlusIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);
