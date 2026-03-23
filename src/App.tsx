import { useState, useEffect, useRef } from 'react';
import { BookOpen, Map as MapIcon, Briefcase, Settings, ChevronRight, CheckCircle2, Trash2, Edit2, X, QrCode, Save, ChevronUp, User, Image as ImageIcon, Loader2 } from 'lucide-react';
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
  html: `<div style="background-color: ${color}; width: ${isCurrent ? '40px' : '30px'}; height: ${isCurrent ? '40px' : '30px'}; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 0 15px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;"><div style="transform: rotate(45deg); color: white;">${isCurrent ? '★' : ''}</div></div>`,
  className: 'custom-div-icon', iconSize: [40, 40], iconAnchor: [20, 40],
});

export type UnlockType = 'PASSWORD' | 'GPS' | 'QR_CODE';
export interface Stage {
  id: string; order: number; title: string; speaker: string; storyContent: string; imageUrl?: string; unlockType: UnlockType; unlockAnswer: string; lat?: number; lng?: number; hints: string[]; successMessage: string; itemReward?: string;
}
export interface Game { title: string; stages: Stage[]; }

const VERSION = "4.1.3";
const DEFAULT_GAME: Game = {
  title: '新港八卦謎蹤 - 繁體中文版',
  stages: [{
    id: 's1', order: 1, title: '時空的起點', speaker: '白鸞卿', storyContent: '歡迎使用。請在後台修改內容。', imageUrl: '', unlockType: 'PASSWORD', unlockAnswer: '1234', hints: ['初始密碼 1234'], successMessage: '完成初始化！'
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
    const savedV = localStorage.getItem('enigma_version');
    if (savedV !== VERSION) { localStorage.setItem('enigma_version', VERSION); if (savedV) window.location.reload(); }
  }, []);

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
      setEditingStage({ ...editingStage, imageUrl: url });
    } catch (err) { alert("上傳失敗"); } finally { setUploading(false); }
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

  if (loading) return <div className="h-screen bg-slate-950 flex items-center justify-center text-amber-500 font-black animate-pulse uppercase tracking-[0.5em] flex-col gap-4"><span>時空連線中...</span></div>;

  return (
    <div className="h-screen w-full bg-black overflow-hidden relative">
      <div className="absolute inset-0 z-0">
        <MapContainer center={[currentStage.lat || 23.55, currentStage.lng || 120.35]} zoom={17} zoomControl={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          {game.stages.map((s, idx) => ( s.lat && s.lng && (
              <Marker key={s.id} position={[s.lat, s.lng]} icon={createCustomIcon(idx === currentStageIdx ? '#f59e0b' : idx < currentStageIdx ? '#10b981' : '#475569', idx === currentStageIdx)} eventHandlers={{ click: () => { setCurrentStageIdx(idx); setPanelMode('story'); setSolved(false); } }} />
          )))}
        </MapContainer>
      </div>

      <div className="absolute top-10 left-6 right-6 z-10 flex justify-between items-center pointer-events-none">
         <div className="bg-black/60 backdrop-blur-xl px-6 py-3 rounded-full border border-white/10 shadow-2xl pointer-events-auto text-white font-black">{game.title}</div>
         <div className="flex gap-2 pointer-events-auto">
            <button onClick={() => setPanelMode('backpack')} className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center text-black shadow-lg"><Briefcase size={20}/></button>
            <button onClick={() => setPanelMode('admin')} className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/10"><Settings size={20}/></button>
         </div>
      </div>

      <AnimatePresence>
        {panelMode !== 'closed' && !isAdmin && (
          <motion.div initial={{ y: "100%" }} animate={{ y: "0%" }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="absolute bottom-0 left-0 right-0 z-[100] max-h-[85vh] bg-slate-900/95 backdrop-blur-2xl rounded-t-[40px] border-t border-white/10 shadow-2xl flex flex-col">
            <div className="w-full flex justify-center py-4" onClick={() => setPanelMode('closed')}><div className="w-12 h-1.5 bg-white/20 rounded-full" /></div>
            <div className="flex-1 overflow-y-auto px-8 pb-12 text-center">
               {panelMode === 'story' && (
                 <div className="space-y-6 text-center">
                    <div className="relative h-48 w-full rounded-[32px] overflow-hidden shadow-2xl mb-8">
                       <img 
  src={currentStage.imageUrl || heroImage} 
  className="w-full h-full object-cover" 
  alt="Scene" 
  onError={(e) => {
    const target = e.target as HTMLImageElement;
    if (target.src !== heroImage) {
      target.src = heroImage;
    }
  }}
/>
                       <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent text-white font-black" />
                       <div className="absolute bottom-4 left-6 right-6 flex justify-between items-end text-white font-black"><h2 className="text-2xl">{currentStage.title}</h2><span className="text-[10px] font-mono text-amber-500 bg-black/50 px-2 py-1 rounded">STAGE {currentStageIdx + 1}</span></div>
                    </div>
                    <div className="flex items-center justify-center gap-3 mb-2 text-amber-500 font-black tracking-widest text-center"><div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-black shadow-lg"><User size={16}/></div>{currentStage.speaker}</div>
                    <div className="text-slate-200 text-lg leading-relaxed font-medium italic border-l-2 border-amber-500/30 pl-4 mb-10 text-left"><TypewriterText text={currentStage.storyContent} /></div>
                    {!solved ? (
                      <div className="space-y-5 text-center">
                         {currentStage.unlockType === 'PASSWORD' ? (
                           <div className="relative group text-white"><input type="text" value={userInput} onChange={e => setUserInput(e.target.value)} placeholder="在此解密..." className="w-full bg-black/40 border-2 border-white/5 rounded-[24px] py-5 px-8 outline-none focus:border-amber-500 text-center" /><button onClick={() => { if(userInput.trim().toLowerCase() === currentStage.unlockAnswer.toLowerCase()) setSolved(true); else alert('無效'); }} className="absolute right-2 top-2 bottom-2 bg-amber-500 text-black px-8 rounded-2xl font-black active:scale-95 transition-all">OK</button></div>
                         ) : currentStage.unlockType === 'GPS' ? (
                           <button onClick={() => navigator.geolocation.getCurrentPosition(pos => {
                             const d = L.latLng(pos.coords.latitude, pos.coords.longitude).distanceTo(L.latLng(currentStage.lat!, currentStage.lng!));
                             if(d < 100) setSolved(true); else alert(`還差約 ${Math.round(d)} 公尺`);
                           })} className="w-full bg-amber-500 text-black py-5 rounded-[24px] font-black flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all text-center"><MapIcon size={24}/> 抵達定位驗證</button>
                         ) : (
                           <button onClick={() => setIsScanning(true)} className="w-full bg-amber-500 text-black py-5 rounded-[24px] font-black flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all text-center"><QrCode size={24}/> 開啟掃描器</button>
                         )}
                         <button onClick={() => setShowHint(!showHint)} className="w-full py-2 text-slate-600 font-black uppercase tracking-[0.4em] text-center text-[10px]">請求支援數據 (提示)</button>
                         {showHint && <div className="bg-amber-500/5 border border-amber-500/20 p-5 rounded-2xl text-amber-200/80 text-sm italic text-center">{currentStage.hints[0]}</div>}
                      </div>
                    ) : (
                      <div className="bg-green-500/10 border border-green-500/30 p-8 rounded-[40px] text-center shadow-2xl animate-in zoom-in text-green-400 font-black"><CheckCircle2 size={56} className="mx-auto mb-4" /><p className="text-xl mb-4 text-center">任務達成！</p><button onClick={() => { if(currentStage.itemReward) setInventory([...inventory, currentStage.itemReward]); setSolved(false); setCurrentStageIdx(prev => (prev+1)%game.stages.length); setUserInput(''); setShowHint(false); }} className="w-full bg-green-500 py-5 rounded-[24px] text-black flex items-center justify-center gap-2">繼續探索 <ChevronRight size={24}/></button></div>
                    )}
                 </div>
               )}
               {panelMode === 'backpack' && (
                 <div className="flex flex-col text-white text-center"><h2 className="text-4xl font-black mb-2 flex items-center justify-center gap-4 text-center"><Briefcase className="text-amber-500" size={40}/> 拾獲物</h2><p className="text-slate-600 text-[10px] font-black tracking-[0.5em] uppercase mb-12 text-center">Artifact Collection</p>{inventory.length === 0 ? (<div className="py-20 flex flex-col items-center opacity-10 text-center"><Briefcase size={80} className="mb-6"/><p className="font-black uppercase tracking-[0.3em] text-sm text-center">背包目前是空的</p></div>) : (<div className="grid grid-cols-2 gap-6 text-center">{inventory.map((item, i) => (<div key={i} className="bg-slate-800/50 border border-white/5 p-10 rounded-[48px] flex flex-col items-center gap-5 text-center shadow-2xl text-white"><div className="w-20 h-20 bg-amber-500/10 rounded-[28px] flex items-center justify-center text-amber-500 shadow-inner"><BookOpen size={36}/></div><span className="font-black text-center">{item}</span></div>))}</div>)}</div>
               )}
               {panelMode === 'admin' && (
                 <div className="flex flex-col items-center justify-center py-10 text-center text-white"><div className="w-24 h-24 bg-white/5 rounded-[40px] flex items-center justify-center text-slate-700 mb-10 border border-white/5 shadow-2xl text-center"><Settings size={40} /></div><h2 className="text-3xl font-black mb-4 tracking-tight uppercase tracking-[0.2em] text-center text-white">管理員入口</h2><p className="text-slate-500 text-sm mb-12 max-w-xs mx-auto text-center">僅限管理員進入以修改時空檔案。</p><button onClick={() => setIsAdmin(true)} className="bg-white text-black px-14 py-5 rounded-[24px] font-black shadow-2xl tracking-widest uppercase text-center">進入系統</button></div>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- 管理員介面 --- */}
      {isAdmin && (
        <div className="absolute inset-0 z-[1000] bg-slate-50 overflow-y-auto text-slate-900 pb-20 font-sans text-center">
           {!isLogged ? (
             <div className="h-screen bg-black flex items-center justify-center p-8 text-white text-center"><div className="bg-slate-900 p-12 rounded-[60px] shadow-2xl w-full max-w-sm border border-white/5 space-y-10 text-center"><h1 className="text-3xl font-black tracking-[0.3em] text-center text-white">ADMIN</h1><input type="password" value={adminPass} onChange={e => setAdminPass(e.target.value)} placeholder="••••" className="w-full bg-black border-2 border-slate-800 rounded-3xl py-6 px-6 outline-none focus:border-amber-500 text-center font-mono text-3xl text-amber-500 tracking-[0.5em]" /><button onClick={() => { if(adminPass === '8888') setIsLogged(true); else alert('密碼錯誤'); }} className="w-full bg-amber-500 text-black py-5 rounded-[30px] font-black shadow-xl text-center">AUTHENTICATE</button><button onClick={() => setIsAdmin(false)} className="text-slate-600 font-bold uppercase text-[10px] tracking-widest text-center">Return</button></div></div>
           ) : (
             <div className="max-w-4xl mx-auto p-10 text-center">
                {editingStage && (
                  <div className="fixed inset-0 bg-black/95 z-[2000] flex items-center justify-center p-4 overflow-y-auto text-slate-900 text-center">
                    <div className="bg-white w-full max-w-xl rounded-[60px] p-12 space-y-8 shadow-2xl text-center text-slate-900">
                       <div className="flex justify-between items-center text-center"><h3 className="text-2xl font-black italic text-slate-900 text-center uppercase tracking-tighter">Mission Editor</h3><button onClick={() => setEditingStage(null)} className="p-3 hover:bg-slate-100 rounded-full text-slate-900"><X/></button></div>
                       <div className="space-y-6 text-left text-slate-900">
                          <div className="space-y-2 text-left">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-slate-900 text-left">任務背景照片 (點擊上傳)</label>
                             <div onClick={() => fileInputRef.current?.click()} className="h-48 w-full rounded-[32px] border-4 border-dashed border-slate-100 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all overflow-hidden relative">
                                {editingStage.imageUrl ? (<img src={editingStage.imageUrl} className="w-full h-full object-cover" alt="Preview" />) : (<div className="text-center text-slate-300">{uploading ? <Loader2 className="animate-spin mx-auto mb-2" /> : <ImageIcon size={48} className="mx-auto mb-2 text-center"/>}<p className="font-black text-sm text-center">點擊上傳或拍照</p></div>)}
                                {uploading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center font-black text-indigo-600 animate-pulse text-center">檔案傳輸中...</div>}
                             </div>
                             <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
                          </div>
                          <div className="grid grid-cols-2 gap-6 text-left text-slate-900">
                            <div className="space-y-2 text-left text-slate-900"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-slate-900 text-left">任務標題</label><input className="w-full border-b-2 py-3 outline-none font-bold text-xl text-slate-900 text-left" value={editingStage.title} onChange={e => setEditingStage({...editingStage, title: e.target.value})} /></div>
                            <div className="space-y-2 text-left text-slate-900"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-slate-900 text-left">角色名稱</label><input className="w-full border-b-2 py-3 outline-none font-bold text-xl text-slate-900 text-left" value={editingStage.speaker} onChange={e => setEditingStage({...editingStage, speaker: e.target.value})} /></div>
                          </div>
                          <div className="space-y-2 text-left text-slate-900"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-slate-900 text-left">對話內容</label><textarea className="w-full bg-slate-50 rounded-[32px] p-6 h-40 outline-none text-base leading-relaxed text-slate-900 shadow-inner text-left" value={editingStage.storyContent} onChange={e => setEditingStage({...editingStage, storyContent: e.target.value})} /></div>
                          <div className="grid grid-cols-2 gap-6 text-left text-slate-900">
                             <div className="space-y-2 text-left text-slate-900"><label className="text-[10px] font-black text-slate-400 uppercase text-left text-slate-900 font-black">解鎖方式</label><select className="w-full border-b-2 py-3 bg-white text-slate-900 font-bold text-left" value={editingStage.unlockType} onChange={e => setEditingStage({...editingStage, unlockType: e.target.value as any})}><option value="PASSWORD">密碼</option><option value="GPS">GPS</option><option value="QR_CODE">QR</option></select></div>
                             <div className="space-y-2 text-left text-slate-900"><label className="text-[10px] font-black text-slate-400 uppercase text-left text-slate-900 font-black">正確答案</label><input className="w-full border-b-2 py-3 outline-none font-mono text-xl text-slate-900 font-bold text-left" value={editingStage.unlockAnswer} onChange={e => setEditingStage({...editingStage, unlockAnswer: e.target.value})} /></div>
                          </div>
                          <div className="h-48 rounded-[32px] overflow-hidden border-2 shadow-inner text-slate-900">
                            <MapContainer center={[editingStage.lat || 23.55, editingStage.lng || 120.35]} zoom={15} style={{ height: '100%', width: '100%' }}>
                              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                              {editingStage.lat !== undefined && editingStage.lng !== undefined && <Marker position={[editingStage.lat, editingStage.lng]} />}
                              <MapPickerEvents onPick={(lat, lng) => setEditingStage({...editingStage, lat, lng})} />
                            </MapContainer>
                          </div>
                          <button onClick={() => {
                            const newStages = editingStage.id === 'NEW' ? [...game.stages, {...editingStage, id: Date.now().toString()}] : game.stages.map(s => s.id === editingStage.id ? editingStage : s);
                            setGame({...game, stages: newStages}); setEditingStage(null);
                          }} className="w-full bg-slate-900 text-white py-6 rounded-[32px] font-black text-xl active:scale-95 transition-all text-center">儲存變更</button>
                       </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-end mb-20 text-slate-900 text-left">
                   <div className="text-left text-slate-900"><h1 className="text-5xl font-black tracking-tighter uppercase italic text-slate-900 text-left">Engine Core</h1><div className="h-1.5 w-20 bg-amber-500 mt-4 text-left" /></div>
                   <div className="flex gap-4">
                      <button onClick={async () => { await setDoc(doc(db, "games", "shinkang_v4"), game); alert("同步完成！"); }} className="bg-green-600 text-white px-10 py-5 rounded-[30px] font-black flex items-center gap-3 shadow-2xl active:scale-95 transition-all italic tracking-tighter text-center"><Save size={24}/> PUSH UPDATE</button>
                      <button onClick={() => { setIsAdmin(false); setIsLogged(false); setAdminPass(''); }} className="bg-white border-2 px-10 py-5 rounded-[30px] font-black flex items-center gap-3 shadow-lg active:scale-95 transition-all uppercase text-xs tracking-widest text-slate-900 text-center">Close</button>
                   </div>
                </div>
                <div className="space-y-10 text-left text-slate-900">
                   <div className="bg-white p-12 rounded-[60px] shadow-sm border border-slate-100 flex items-center justify-between group hover:border-indigo-200 transition-all text-left text-slate-900">
                      <div className="flex-1 text-slate-900 text-left"><label className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] block mb-3 text-left text-slate-900">Project Name</label><input className="text-5xl font-black w-full outline-none text-slate-900 focus:text-indigo-600 transition-colors bg-transparent text-left" value={game.title} onChange={e => setGame({...game, title: e.target.value})} /></div>
                      <button onClick={() => setEditingStage({ id: 'NEW', order: game.stages.length+1, title: '新任務', speaker: '白鸞卿', storyContent: '請輸入故事...', unlockType: 'PASSWORD', unlockAnswer: '1234', hints: [''], successMessage: 'Success' })} className="bg-indigo-600 text-white p-7 rounded-[35px] shadow-2xl hover:rotate-90 active:scale-90 flex items-center justify-center text-center"><PlusIcon size={40}/></button>
                   </div>
                   <div className="grid gap-6 text-left">
                      {game.stages.map((s, i) => (
                        <div key={s.id} className="bg-white p-10 rounded-[60px] border-2 border-transparent hover:border-indigo-100 flex items-center gap-10 transition-all group shadow-sm text-slate-900 text-left">
                           <div className="w-20 h-20 bg-slate-50 rounded-[35px] flex items-center justify-center font-black text-slate-300 text-3xl group-hover:text-indigo-600 group-hover:bg-indigo-50 shadow-inner text-center">{i+1}</div>
                           <div className="flex-1 text-left text-slate-900"><h4 className="text-2xl font-black text-slate-800 tracking-tight text-left text-slate-900">{s.title}</h4><div className="flex gap-3 mt-3 text-slate-400 text-[10px] font-black uppercase tracking-widest text-left"><span>{s.unlockType}</span><span>Key: {s.unlockAnswer}</span></div></div>
                           <div className="flex gap-4 text-center"><button onClick={() => setEditingStage(s)} className="p-6 bg-slate-50 text-slate-400 hover:bg-indigo-600 hover:text-white rounded-[30px] transition-all active:scale-90 text-center"><Edit2 size={28}/></button><button onClick={() => { if(confirm('確定移除任務？')) setGame({...game, stages: game.stages.filter(item => item.id !== s.id)}) }} className="p-6 bg-slate-50 text-slate-400 hover:bg-red-500 hover:text-white rounded-[30px] transition-all active:scale-90 text-center"><Trash2 size={28}/></button></div>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
           )}
        </div>
      )}

      {isScanning && (
        <div className="absolute inset-0 bg-black z-[2000] flex flex-col items-center justify-center p-10 animate-in zoom-in text-center">
           <div className="w-full max-w-sm aspect-square bg-slate-900 rounded-[60px] overflow-hidden border-4 border-amber-500 shadow-2xl mb-14 text-center"><div id="reader" className="w-full h-full scale-110"></div></div>
           <button onClick={() => setIsScanning(false)} className="bg-white/10 text-white px-14 py-6 rounded-[30px] font-black uppercase tracking-[0.3em] text-center">Abort Scanner</button>
        </div>
      )}

      {panelMode === 'closed' && !isAdmin && (
        <div className="absolute bottom-12 left-0 right-0 z-10 flex justify-center animate-bounce text-center"><button onClick={() => setPanelMode('story')} className="bg-amber-500 text-black px-10 py-4 rounded-full font-black flex items-center gap-3 shadow-2xl shadow-amber-900/50 text-center">開啟任務面板 <ChevronUp size={24} /></button></div>
      )}
    </div>
  );
}

function MapPickerEvents({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e: L.LeafletMouseEvent) { onPick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

const PlusIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);
