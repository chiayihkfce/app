import { useState, useEffect, useRef } from 'react';
import { BookOpen, Map as MapIcon, Briefcase, Settings, ChevronRight, CheckCircle2, Trash2, Edit2, X, QrCode, Save, ChevronUp, Image as ImageIcon, Loader2, Clock, MapPin, Star, MoreHorizontal, ArrowLeft } from 'lucide-react';
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

const VERSION = "4.2.1";
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

  if (loading) return <div className="h-screen bg-white flex items-center justify-center text-pwBlue font-bold animate-pulse flex-col gap-4"><span>系統連線中...</span></div>;

  return (
    <div className="h-screen w-full bg-pwGray1 overflow-hidden relative font-sans text-pwGray6">
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
         <div className="bg-white/90 backdrop-blur-md px-5 py-2.5 rounded-2xl shadow-xl text-pwGray7 font-bold border border-white pointer-events-auto flex items-center gap-3">
            <div className="w-8 h-8 bg-pwBlue/10 rounded-full flex items-center justify-center text-pwBlue"><MapPin size={18}/></div>
            <span>{game.title}</span>
         </div>
         <div className="flex gap-3 pointer-events-auto">
            <button onClick={() => setPanelMode('backpack')} className="w-12 h-12 bg-white/90 backdrop-blur-md rounded-2xl flex items-center justify-center text-pwGray6 shadow-xl border border-white active:scale-95 transition-all"><Briefcase size={22}/></button>
            <button onClick={() => setPanelMode('admin')} className="w-12 h-12 bg-white/90 backdrop-blur-md rounded-2xl flex items-center justify-center text-pwGray6 shadow-xl border border-white active:scale-95 transition-all"><Settings size={22}/></button>
         </div>
      </div>

      <AnimatePresence>
        {panelMode !== 'closed' && !isAdmin && (
          <motion.div initial={{ y: "100%" }} animate={{ y: "0%" }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 200 }} className="absolute bottom-0 left-0 right-0 z-[100] h-[88vh] bg-white rounded-t-[40px] shadow-[0_-20px_60px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden">
            {/* --- 控制條 --- */}
            <div className="flex flex-col items-center pt-4 pb-2 shrink-0">
               <div className="w-12 h-1.5 bg-pwGray2 rounded-full mb-4 cursor-pointer" onClick={() => setPanelMode('closed')}/>
               <div className="w-full flex items-center justify-between px-8">
                  <button onClick={() => setPanelMode('closed')} className="w-10 h-10 flex items-center justify-center text-pwGray3 hover:text-pwGray7 transition-colors"><ArrowLeft size={24} /></button>
                  <span className="font-black text-pwGray7 tracking-widest">MISSION CENTER</span>
                  <div className="w-10 h-10 flex items-center justify-center text-pwGray3"><MoreHorizontal size={24} /></div>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 pb-12 scroll-smooth">
               {panelMode === 'story' && (
                 <div className="space-y-10 pt-4">
                    {/* --- 主視覺 --- */}
                    <div className="relative group">
                       <div className="aspect-[4/3] rounded-[32px] overflow-hidden shadow-2xl border-4 border-white">
                          <img 
                             src={currentStage.imageUrl || heroImage} 
                             className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                             alt="Mission" 
                             onError={(e) => { const t = e.target as HTMLImageElement; if (t.src !== heroImage) t.src = heroImage; }}
                          />
                       </div>
                       <div className="absolute -bottom-6 left-8 bg-pwBlue text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-pwBlue/30 text-sm tracking-widest uppercase italic">
                          Stage {currentStageIdx + 1}
                       </div>
                    </div>

                    {/* --- 標題與評分 --- */}
                    <div className="space-y-4 pt-2">
                       <h2 className="text-3xl font-black text-pwGray7 leading-tight">{currentStage.title}</h2>
                       <div className="flex items-center gap-6">
                          <div className="flex flex-row items-center gap-1.5 text-pwDeepYellow">
                             <Star size={20} fill="currentColor" />
                             <Star size={20} fill="currentColor" />
                             <Star size={20} fill="currentColor" />
                             <Star size={20} fill="currentColor" />
                             <Star size={20} fill="currentColor" className="text-pwGray2" />
                             <span className="text-pwGray3 font-bold ml-2 text-sm">(4.0)</span>
                          </div>
                          <div className="h-1 w-1 bg-pwGray2 rounded-full" />
                          <div className="text-pwGray4 text-sm font-bold flex items-center gap-1"><Clock size={14}/> 預計 15 分鐘</div>
                       </div>
                    </div>

                    <hr className="border-pwGray1" />

                    {/* --- 故事對話區 --- */}
                    <div className="bg-pwGray1/50 p-8 rounded-[32px] border border-white space-y-4 relative">
                       <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 bg-pwBlue rounded-full flex items-center justify-center text-white font-black text-[10px]">{currentStage.speaker[0]}</div>
                          <span className="font-black text-pwGray7 text-sm tracking-widest">{currentStage.speaker}</span>
                       </div>
                       <div className="text-pwGray6 leading-relaxed font-bold text-lg italic">
                          <TypewriterText text={currentStage.storyContent} />
                       </div>
                    </div>

                    {/* --- 互動操作區 --- */}
                    <div className="space-y-6">
                       {!solved ? (
                         <div className="space-y-4">
                            {currentStage.unlockType === 'PASSWORD' ? (
                              <div className="space-y-3">
                                <label className="text-[10px] font-black text-pwGray4 uppercase tracking-[0.3em] ml-4">請輸入時空密碼</label>
                                <input type="text" value={userInput} onChange={e => setUserInput(e.target.value)} placeholder="••••••••" className="w-full bg-pwGray1/50 border-2 border-transparent focus:border-pwBlue rounded-[24px] py-5 px-8 outline-none font-black text-center text-xl tracking-widest transition-all placeholder:text-pwGray2" />
                                <button onClick={() => { if(userInput.trim().toLowerCase() === currentStage.unlockAnswer.toLowerCase()) setSolved(true); else alert('密碼錯誤，請再試一次'); }} className="w-full bg-pwGray7 text-white py-5 rounded-[24px] font-black tracking-widest text-lg shadow-xl active:scale-[0.98] transition-all">解鎖任務</button>
                              </div>
                            ) : currentStage.unlockType === 'GPS' ? (
                              <button onClick={() => navigator.geolocation.getCurrentPosition(pos => {
                                const d = L.latLng(pos.coords.latitude, pos.coords.longitude).distanceTo(L.latLng(currentStage.lat!, currentStage.lng!));
                                if(d < 100) setSolved(true); else alert(`目標物尚在 ${Math.round(d)} 公尺外`);
                              })} className="w-full bg-pwBlue text-white py-5 rounded-[24px] font-black tracking-widest text-lg shadow-xl shadow-pwBlue/20 flex items-center justify-center gap-3 active:scale-[0.98] transition-all"><MapPin size={24}/> 確認目前座標</button>
                            ) : (
                              <button onClick={() => setIsScanning(true)} className="w-full bg-pwBlue text-white py-5 rounded-[24px] font-black tracking-widest text-lg shadow-xl shadow-pwBlue/20 flex items-center justify-center gap-3 active:scale-[0.98] transition-all"><QrCode size={24}/> 掃描環境代碼</button>
                            )}
                            
                            <button onClick={() => setShowHint(!showHint)} className="w-full py-4 text-pwGray3 font-black text-[10px] uppercase tracking-[0.5em] text-center hover:text-pwBlue transition-colors">Request Support Data</button>
                            {showHint && (
                              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-pwDeepYellow/10 border-2 border-pwDeepYellow/20 p-6 rounded-[24px] text-pwDeepYellow font-bold text-sm leading-relaxed text-center">
                                 {currentStage.hints[0]}
                              </motion.div>
                            )}
                         </div>
                       ) : (
                         <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-pwGreen/10 border-2 border-pwGreen/20 p-10 rounded-[40px] text-center space-y-6">
                            <div className="w-20 h-20 bg-pwGreen rounded-full flex items-center justify-center text-white mx-auto shadow-xl shadow-pwGreen/30 animate-bounce"><CheckCircle2 size={40} /></div>
                            <div className="space-y-2">
                               <p className="text-pwGreen font-black text-2xl tracking-tighter">任務圓滿達成</p>
                               <p className="text-pwGray4 font-bold text-sm italic">{currentStage.successMessage}</p>
                            </div>
                            <button onClick={() => { if(currentStage.itemReward) setInventory([...inventory, currentStage.itemReward]); setSolved(false); setCurrentStageIdx(prev => (prev+1)%game.stages.length); setUserInput(''); setShowHint(false); }} className="w-full bg-pwGreen text-white py-5 rounded-[24px] font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-pwGreen/20 active:scale-[0.98] transition-all">繼續前進 <ChevronRight size={24}/></button>
                         </motion.div>
                       )}
                    </div>

                    <hr className="border-pwGray1" />

                    {/* --- 關於與難度 --- */}
                    <div className="grid grid-cols-2 gap-4">
                       <div className="bg-pwGray1 p-6 rounded-[24px] space-y-2">
                          <span className="text-[10px] font-black text-pwGray3 uppercase tracking-widest">任務難度</span>
                          <div className="flex flex-row items-center gap-1">
                             <div className="w-2.5 h-2.5 rounded-full bg-pwRed" />
                             <div className="w-2.5 h-2.5 rounded-full bg-pwRed" />
                             <div className="w-2.5 h-2.5 rounded-full bg-pwGray2" />
                          </div>
                       </div>
                       <div className="bg-pwGray1 p-6 rounded-[24px] space-y-2">
                          <span className="text-[10px] font-black text-pwGray3 uppercase tracking-widest">任務獎勵</span>
                          <span className="block font-black text-pwGray7 text-sm">{currentStage.itemReward || "未知神秘物"}</span>
                       </div>
                    </div>
                 </div>
               )}

               {panelMode === 'backpack' && (
                 <div className="py-10 space-y-12">
                    <div className="text-center space-y-2">
                       <h2 className="text-4xl font-black text-pwGray7 tracking-tighter italic">BACKPACK</h2>
                       <p className="text-pwGray3 font-bold text-[10px] uppercase tracking-[0.4em]">Inventory Management</p>
                    </div>
                    {inventory.length === 0 ? (
                      <div className="py-20 flex flex-col items-center text-pwGray2">
                         <div className="w-24 h-24 bg-pwGray1 rounded-full flex items-center justify-center mb-6"><Briefcase size={48}/></div>
                         <p className="font-black text-sm tracking-[0.3em] uppercase">背包中空無一物</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-6">
                        {inventory.map((item, i) => (
                          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }} key={i} className="bg-white border-2 border-pwGray1 p-8 rounded-[32px] flex flex-col items-center gap-6 text-center shadow-sm hover:shadow-xl hover:border-pwBlue/20 transition-all group">
                            <div className="w-16 h-16 bg-pwBlue/5 rounded-[20px] flex items-center justify-center text-pwBlue group-hover:bg-pwBlue group-hover:text-white transition-all duration-500"><BookOpen size={28}/></div>
                            <span className="font-black text-pwGray7 text-sm tracking-tight">{item}</span>
                          </motion.div>
                        ))}
                      </div>
                    )}
                 </div>
               )}

               {panelMode === 'admin' && (
                 <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 space-y-12">
                    <div className="relative">
                       <div className="w-32 h-32 bg-pwGray1 rounded-[48px] flex items-center justify-center text-pwGray2 border-4 border-white shadow-inner"><Settings size={56} /></div>
                       <div className="absolute -top-2 -right-2 w-8 h-8 bg-pwRed rounded-full border-4 border-white shadow-lg animate-pulse" />
                    </div>
                    <div className="text-center space-y-4">
                       <h2 className="text-4xl font-black text-pwGray7 tracking-tighter">RESTRICTED</h2>
                       <p className="text-pwGray3 text-sm font-bold max-w-[200px] mx-auto leading-relaxed uppercase tracking-widest">此區域受最高權限保護，請進行身分驗證。</p>
                    </div>
                    <button onClick={() => setIsAdmin(true)} className="w-full bg-pwGray7 text-white py-6 rounded-[30px] font-black tracking-[0.2em] text-lg shadow-2xl active:scale-95 transition-all">身份驗證</button>
                 </div>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- 管理員工作台 (Fullscreen) --- */}
      {isAdmin && (
        <div className="absolute inset-0 z-[1000] bg-white overflow-y-auto text-pwGray7 pb-20 font-sans">
           {!isLogged ? (
             <div className="h-screen bg-pwGray1 flex items-center justify-center p-8">
               <div className="bg-white p-12 rounded-[48px] shadow-2xl w-full max-w-sm border-2 border-white space-y-10 text-center">
                 <div className="space-y-2">
                    <h1 className="text-3xl font-black tracking-tighter italic">ADMIN LOG</h1>
                    <p className="text-pwGray3 text-[10px] font-black uppercase tracking-[0.5em]">Security Verification</p>
                 </div>
                 <input type="password" value={adminPass} onChange={e => setAdminPass(e.target.value)} placeholder="••••" className="w-full bg-pwGray1/50 border-2 border-transparent focus:border-pwBlue rounded-[24px] py-6 px-8 outline-none text-center font-black text-4xl tracking-[1em] transition-all" />
                 <button onClick={() => { if(adminPass === '8888') setIsLogged(true); else alert('身分證失敗'); }} className="w-full bg-pwGray7 text-white py-5 rounded-[24px] font-black tracking-widest shadow-xl">進入系統</button>
                 <button onClick={() => setIsAdmin(false)} className="text-pwGray3 font-black text-[10px] uppercase tracking-[0.5em] hover:text-pwRed transition-colors">Abort Access</button>
               </div>
             </div>
           ) : (
             <div className="max-w-4xl mx-auto p-10">
                {editingStage && (
                  <div className="fixed inset-0 bg-pwGray7/80 backdrop-blur-md z-[2000] flex items-center justify-center p-6 overflow-y-auto">
                    <div className="bg-white w-full max-w-2xl rounded-[48px] p-12 space-y-8 shadow-2xl border-2 border-white">
                       <div className="flex justify-between items-center">
                          <h3 className="text-3xl font-black tracking-tighter italic uppercase">Edit Node</h3>
                          <button onClick={() => setEditingStage(null)} className="w-12 h-12 flex items-center justify-center bg-pwGray1 rounded-2xl text-pwGray6 hover:bg-pwRed hover:text-white transition-all"><X size={24}/></button>
                       </div>
                       <div className="space-y-6">
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-pwGray3 uppercase tracking-widest ml-4">Node Visual Image</label>
                             <div onClick={() => fileInputRef.current?.click()} className="h-60 w-full rounded-[32px] border-4 border-dashed border-pwGray1 flex flex-col items-center justify-center cursor-pointer hover:bg-pwGray1 transition-all overflow-hidden relative group">
                                {editingStage.imageUrl ? (
                                  <>
                                    <img src={editingStage.imageUrl} className="w-full h-full object-cover" alt="Preview" />
                                    <div className="absolute inset-0 bg-pwGray7/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                       <p className="text-white font-black tracking-widest uppercase text-sm">Update Assets</p>
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-center text-pwGray2">
                                    {uploading ? <Loader2 className="animate-spin mx-auto mb-2 text-pwBlue" /> : <ImageIcon size={48} className="mx-auto mb-4"/>}
                                    <p className="font-black text-xs uppercase tracking-widest">Upload Resource</p>
                                  </div>
                                )}
                                {uploading && <div className="absolute inset-0 bg-white/90 flex items-center justify-center font-black text-pwBlue animate-pulse uppercase tracking-widest">Processing...</div>}
                             </div>
                             <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
                          </div>
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2"><label className="text-[10px] font-black text-pwGray3 ml-4">Node Title</label><input className="w-full bg-pwGray1/50 rounded-[20px] py-4 px-6 outline-none font-black" value={editingStage.title} onChange={e => setEditingStage({...editingStage, title: e.target.value})} /></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-pwGray3 ml-4">Speaker</label><input className="w-full bg-pwGray1/50 rounded-[20px] py-4 px-6 outline-none font-black" value={editingStage.speaker} onChange={e => setEditingStage({...editingStage, speaker: e.target.value})} /></div>
                          </div>
                          <div className="space-y-2"><label className="text-[10px] font-black text-pwGray3 ml-4">Story Narrative</label><textarea className="w-full bg-pwGray1/50 rounded-[20px] p-6 h-40 outline-none font-bold leading-relaxed" value={editingStage.storyContent} onChange={e => setEditingStage({...editingStage, storyContent: e.target.value})} /></div>
                          <div className="grid grid-cols-2 gap-6">
                             <div className="space-y-2"><label className="text-[10px] font-black text-pwGray3 ml-4">Mechanism</label><select className="w-full bg-pwGray1/50 rounded-[20px] py-4 px-6 outline-none font-black appearance-none" value={editingStage.unlockType} onChange={e => setEditingStage({...editingStage, unlockType: e.target.value as any})}><option value="PASSWORD">Password</option><option value="GPS">GPS Range</option><option value="QR_CODE">QR Scanner</option></select></div>
                             <div className="space-y-2"><label className="text-[10px] font-black text-pwGray3 ml-4">Unlock Key</label><input className="w-full bg-pwGray1/50 rounded-[20px] py-4 px-6 outline-none font-black" value={editingStage.unlockAnswer} onChange={e => setEditingStage({...editingStage, unlockAnswer: e.target.value})} /></div>
                          </div>
                          <button onClick={() => {
                            const newStages = editingStage.id === 'NEW' ? [...game.stages, {...editingStage, id: Date.now().toString()}] : game.stages.map(s => s.id === editingStage.id ? editingStage : s);
                            setGame({...game, stages: newStages}); setEditingStage(null);
                          }} className="w-full bg-pwBlue text-white py-6 rounded-[24px] font-black uppercase tracking-widest shadow-xl shadow-pwBlue/20 active:scale-95 transition-all">Confirm Update</button>
                       </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-16">
                   <div className="space-y-4">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 bg-pwGray7 rounded-[20px] flex items-center justify-center text-white"><Settings size={24}/></div>
                         <h1 className="text-5xl font-black tracking-tighter italic uppercase leading-none">Console</h1>
                      </div>
                      <p className="text-pwGray3 font-black text-[10px] uppercase tracking-[0.5em]">System Version: {VERSION}</p>
                   </div>
                   <div className="flex gap-4 w-full sm:w-auto">
                      <button onClick={async () => { await setDoc(doc(db, "games", "shinkang_v4"), game); alert("雲端同步成功！"); }} className="flex-1 sm:flex-none bg-pwGreen text-white px-8 py-5 rounded-[24px] font-black flex items-center justify-center gap-3 shadow-xl shadow-pwGreen/20 active:scale-95 transition-all"><Save size={20}/> Push To Cloud</button>
                      <button onClick={() => { setIsAdmin(false); setIsLogged(false); setAdminPass(''); }} className="flex-1 sm:flex-none bg-white border-2 border-pwGray1 px-8 py-5 rounded-[24px] font-black text-pwGray3 hover:text-pwRed transition-colors uppercase tracking-widest text-xs">Terminate</button>
                   </div>
                </div>

                <div className="space-y-10">
                   <div className="bg-white p-12 rounded-[56px] shadow-sm border-2 border-pwGray1 flex items-center justify-between group">
                      <div className="flex-1">
                         <label className="text-[10px] font-black text-pwGray3 uppercase tracking-[0.6em] block mb-3">Project Identifier</label>
                         <input className="text-4xl font-black w-full outline-none text-pwGray7 focus:text-pwBlue transition-colors uppercase tracking-tighter" value={game.title} onChange={e => setGame({...game, title: e.target.value})} />
                      </div>
                      <button onClick={() => setEditingStage({ id: 'NEW', order: game.stages.length+1, title: '新任務', speaker: '角色名稱', storyContent: '請在此輸入您的故事劇情與內容...', unlockType: 'PASSWORD', unlockAnswer: '1234', hints: ['這裡是提示內容'], successMessage: '任務達成訊息' })} className="bg-pwGray7 text-white w-20 h-20 rounded-[32px] shadow-2xl flex items-center justify-center hover:rotate-90 transition-all duration-700 active:scale-90"><PlusIcon size={40}/></button>
                   </div>

                   <div className="grid gap-6">
                      {game.stages.map((s, i) => (
                        <div key={s.id} className="bg-white p-10 rounded-[48px] border-2 border-pwGray1 flex items-center gap-10 hover:shadow-2xl hover:border-pwBlue/20 transition-all group relative overflow-hidden">
                           <div className="absolute top-0 left-0 w-2 h-full bg-pwBlue/10 group-hover:bg-pwBlue transition-colors" />
                           <div className="w-20 h-20 bg-pwGray1 rounded-[28px] flex items-center justify-center font-black text-pwGray3 text-3xl group-hover:bg-pwBlue/5 group-hover:text-pwBlue transition-all shadow-inner">{i+1}</div>
                           <div className="flex-1">
                              <h4 className="text-2xl font-black text-pwGray7 mb-2 tracking-tight uppercase">{s.title}</h4>
                              <div className="flex gap-6 text-[10px] font-black text-pwGray3 uppercase tracking-[0.2em]">
                                 <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-pwBlue"/> {s.unlockType}</span>
                                 <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-pwGreen"/> Key: {s.unlockAnswer}</span>
                              </div>
                           </div>
                           <div className="flex gap-4">
                              <button onClick={() => setEditingStage(s)} className="w-16 h-16 bg-pwGray1 text-pwGray3 hover:bg-pwBlue hover:text-white rounded-[24px] flex items-center justify-center transition-all active:scale-90 shadow-sm"><Edit2 size={24}/></button>
                              <button onClick={() => { if(confirm('確定要永久刪除此任務嗎？')) setGame({...game, stages: game.stages.filter(item => item.id !== s.id)}) }} className="w-16 h-16 bg-pwGray1 text-pwGray3 hover:bg-pwRed hover:text-white rounded-[24px] flex items-center justify-center transition-all active:scale-90 shadow-sm"><Trash2 size={24}/></button>
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
        <div className="absolute inset-0 bg-pwGray7 z-[2000] flex flex-col items-center justify-center p-10">
           <div className="w-full max-w-sm aspect-square bg-black rounded-[40px] overflow-hidden border-4 border-pwBlue shadow-[0_0_100px_rgba(44,166,224,0.3)] mb-16 relative">
              <div id="reader" className="w-full h-full scale-110"></div>
              <div className="absolute inset-x-0 top-1/2 h-0.5 bg-pwBlue shadow-[0_0_15px_rgba(44,166,224,1)] animate-scan" />
           </div>
           <button onClick={() => setIsScanning(false)} className="bg-white/10 text-white px-16 py-6 rounded-[30px] font-black tracking-widest text-lg hover:bg-pwRed transition-colors active:scale-95 border-2 border-white/20">ABORT SCAN</button>
        </div>
      )}

      {/* --- 開啟按鈕 (關閉狀態) --- */}
      {panelMode === 'closed' && !isAdmin && (
        <div className="absolute bottom-12 left-0 right-0 z-10 flex justify-center animate-bounce-slow">
           <button onClick={() => setPanelMode('story')} className="bg-pwGray7 text-white px-12 py-6 rounded-full font-black flex items-center gap-4 shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-2 border-white/10 active:scale-95 transition-all uppercase tracking-[0.2em] text-sm">
              Launch Panel <ChevronUp size={24} />
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
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);
