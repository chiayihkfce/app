import { useState, useEffect, useRef } from 'react';
import { BookOpen, Map as MapIcon, Briefcase, Settings, ChevronRight, CheckCircle2, Trash2, Edit2, X, QrCode, Save, ChevronUp, Image as ImageIcon, Loader2, Clock, MapPin, Star } from 'lucide-react';
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
  html: `<div style="background-color: ${color}; width: ${isCurrent ? '40px' : '30px'}; height: ${isCurrent ? '40px' : '30px'}; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 0 15px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center;"><div style="transform: rotate(45deg); color: white;">${isCurrent ? '★' : ''}</div></div>`,
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

  if (loading) return <div className="h-screen bg-white flex items-center justify-center text-blue-500 font-bold animate-pulse flex-col gap-4"><span>載入中...</span></div>;

  return (
    <div className="h-screen w-full bg-slate-50 overflow-hidden relative font-sans text-slate-800">
      <div className="absolute inset-0 z-0 opacity-40">
        <MapContainer center={[currentStage.lat || 23.55, currentStage.lng || 120.35]} zoom={17} zoomControl={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {game.stages.map((s, idx) => ( s.lat && s.lng && (
              <Marker key={s.id} position={[s.lat, s.lng]} icon={createCustomIcon(idx === currentStageIdx ? '#3b82f6' : idx < currentStageIdx ? '#10b981' : '#cbd5e1', idx === currentStageIdx)} eventHandlers={{ click: () => { setCurrentStageIdx(idx); setPanelMode('story'); setSolved(false); } }} />
          )))}
        </MapContainer>
      </div>

      <div className="absolute top-6 left-6 right-6 z-10 flex justify-between items-center">
         <div className="bg-white/80 backdrop-blur-md px-5 py-2 rounded-2xl border border-slate-200 shadow-sm text-slate-800 font-bold flex items-center gap-2">
            <MapPin size={18} className="text-blue-500"/> {game.title}
         </div>
         <div className="flex gap-2">
            <button onClick={() => setPanelMode('backpack')} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-600 shadow-sm border border-slate-200"><Briefcase size={18}/></button>
            <button onClick={() => setPanelMode('admin')} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-600 shadow-sm border border-slate-200"><Settings size={18}/></button>
         </div>
      </div>

      <AnimatePresence>
        {panelMode !== 'closed' && !isAdmin && (
          <motion.div initial={{ y: "100%" }} animate={{ y: "0%" }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="absolute bottom-0 left-0 right-0 z-[100] max-h-[90vh] bg-white rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.08)] border-t border-slate-100 flex flex-col">
            <div className="w-full flex justify-center py-4" onClick={() => setPanelMode('closed')}><div className="w-12 h-1 bg-slate-200 rounded-full" /></div>
            
            <div className="flex-1 overflow-y-auto px-6 pb-10">
               {panelMode === 'story' && (
                 <div className="space-y-6">
                    {/* --- 頂部圖片區塊 --- */}
                    <div className="relative w-full aspect-[4/3] rounded-[24px] overflow-hidden bg-slate-100 shadow-inner">
                       <img 
                          src={currentStage.imageUrl || heroImage} 
                          className="w-full h-full object-cover" 
                          alt="Scene" 
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            if (target.src !== heroImage) target.src = heroImage;
                          }}
                       />
                       <div className="absolute top-4 left-4">
                          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-md border-4 border-white">
                             <img src="/favicon.svg" className="w-8 h-8" alt="Logo" />
                          </div>
                       </div>
                       <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-tighter shadow-sm border border-white/50">
                          STAGE {currentStageIdx + 1}
                       </div>
                    </div>

                    {/* --- 標題與評分 --- */}
                    <div className="space-y-1">
                       <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{currentStage.title}</h2>
                       <div className="flex items-center gap-1 text-blue-500">
                          <Star size={14} fill="currentColor" />
                          <Star size={14} fill="currentColor" />
                          <Star size={14} fill="currentColor" />
                          <Star size={14} fill="currentColor" />
                          <Star size={14} fill="currentColor" />
                       </div>
                    </div>

                    {/* --- 分隔標籤 --- */}
                    <div className="flex gap-2 overflow-x-auto py-1 no-scrollbar">
                       <span className="bg-slate-100 px-4 py-1.5 rounded-full text-xs font-bold text-slate-500 whitespace-nowrap">探索任務</span>
                       <span className="bg-slate-100 px-4 py-1.5 rounded-full text-xs font-bold text-slate-500 whitespace-nowrap">文化導覽</span>
                       <span className="bg-slate-100 px-4 py-1.5 rounded-full text-xs font-bold text-slate-500 whitespace-nowrap">實境解謎</span>
                    </div>

                    <hr className="border-slate-100" />

                    {/* --- 關於區塊 --- */}
                    <div className="space-y-4">
                       <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">關於</h3>
                       <div className="space-y-3">
                          <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
                             <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500"><MapPin size={16}/></div>
                             遊戲難度：
                             <div className="flex gap-0.5 ml-auto">
                                <span className="w-5 h-5 bg-red-500 rounded-full border-2 border-white shadow-sm" />
                                <span className="w-5 h-5 bg-red-500 rounded-full border-2 border-white shadow-sm" />
                                <span className="w-5 h-5 bg-red-500 rounded-full border-2 border-white shadow-sm" />
                                <span className="w-5 h-5 bg-slate-200 rounded-full border-2 border-white shadow-sm" />
                                <span className="w-5 h-5 bg-slate-200 rounded-full border-2 border-white shadow-sm" />
                             </div>
                             <span className="text-slate-400 font-normal ml-2">( 普通 )</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
                             <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500"><Clock size={16}/></div>
                             遊戲時間： 1小時
                          </div>
                          <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
                             <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500"><MapIcon size={16}/></div>
                             地圖導覽
                          </div>
                       </div>
                    </div>

                    {/* --- 介紹區塊 --- */}
                    <div className="space-y-3">
                       <h3 className="text-lg font-bold text-slate-800">介紹</h3>
                       <div className="text-slate-500 leading-relaxed text-sm font-medium">
                          <TypewriterText text={currentStage.storyContent} />
                       </div>
                    </div>

                    {/* --- 解鎖區域 --- */}
                    {!solved ? (
                      <div className="pt-4">
                         {currentStage.unlockType === 'PASSWORD' ? (
                           <div className="flex gap-2">
                             <input type="text" value={userInput} onChange={e => setUserInput(e.target.value)} placeholder="請輸入答案..." className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold transition-all" />
                             <button onClick={() => { if(userInput.trim().toLowerCase() === currentStage.unlockAnswer.toLowerCase()) setSolved(true); else alert('無效'); }} className="bg-blue-500 text-white px-8 rounded-2xl font-bold active:scale-95 transition-all shadow-lg shadow-blue-500/20">OK</button>
                           </div>
                         ) : currentStage.unlockType === 'GPS' ? (
                           <button onClick={() => navigator.geolocation.getCurrentPosition(pos => {
                             const d = L.latLng(pos.coords.latitude, pos.coords.longitude).distanceTo(L.latLng(currentStage.lat!, currentStage.lng!));
                             if(d < 100) setSolved(true); else alert(`還差約 ${Math.round(d)} 公尺`);
                           })} className="w-full bg-blue-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"><MapIcon size={20}/> 抵達定位驗證</button>
                         ) : (
                           <button onClick={() => setIsScanning(true)} className="w-full bg-blue-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"><QrCode size={20}/> 開啟掃描器</button>
                         )}
                         <button onClick={() => setShowHint(!showHint)} className="w-full py-4 text-blue-500 font-bold text-sm tracking-wide text-center">更多內容 (提示)</button>
                         {showHint && <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl text-blue-800 text-sm italic">{currentStage.hints[0]}</div>}
                      </div>
                    ) : (
                      <div className="bg-green-50 border border-green-100 p-6 rounded-[24px] text-center shadow-sm animate-in zoom-in">
                         <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white mx-auto mb-3 shadow-lg"><CheckCircle2 size={24} /></div>
                         <p className="text-green-700 font-bold text-lg mb-4">任務達成！</p>
                         <button onClick={() => { if(currentStage.itemReward) setInventory([...inventory, currentStage.itemReward]); setSolved(false); setCurrentStageIdx(prev => (prev+1)%game.stages.length); setUserInput(''); setShowHint(false); }} className="w-full bg-green-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">繼續探索 <ChevronRight size={20}/></button>
                      </div>
                    )}
                 </div>
               )}

               {panelMode === 'backpack' && (
                 <div className="space-y-8">
                    <h2 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3"><Briefcase className="text-blue-500" size={32}/> 拾獲物</h2>
                    {inventory.length === 0 ? (
                      <div className="py-20 flex flex-col items-center text-slate-300">
                         <Briefcase size={64} className="mb-4 opacity-20"/>
                         <p className="font-bold text-sm uppercase tracking-widest opacity-50">背包目前是空的</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        {inventory.map((item, i) => (
                          <div key={i} className="bg-white border border-slate-100 p-6 rounded-[24px] flex flex-col items-center gap-4 text-center shadow-sm">
                            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500"><BookOpen size={24}/></div>
                            <span className="font-bold text-slate-700 text-sm">{item}</span>
                          </div>
                        ))}
                      </div>
                    )}
                 </div>
               )}

               {panelMode === 'admin' && (
                 <div className="flex flex-col items-center justify-center py-10 space-y-6">
                    <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center text-slate-400 border border-slate-100"><Settings size={32} /></div>
                    <div className="text-center space-y-2">
                       <h2 className="text-2xl font-extrabold text-slate-900 uppercase tracking-tight">管理員入口</h2>
                       <p className="text-slate-400 text-sm max-w-xs mx-auto">僅限管理員進入以修改遊戲內容與時空檔案。</p>
                    </div>
                    <button onClick={() => setIsAdmin(true)} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold shadow-xl active:scale-95 transition-all">進入系統</button>
                 </div>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- 管理員介面 --- */}
      {isAdmin && (
        <div className="absolute inset-0 z-[1000] bg-white overflow-y-auto text-slate-900 pb-20 font-sans">
           {!isLogged ? (
             <div className="h-screen bg-slate-50 flex items-center justify-center p-8">
               <div className="bg-white p-10 rounded-[40px] shadow-2xl w-full max-w-sm border border-slate-100 space-y-8 text-center">
                 <h1 className="text-2xl font-black tracking-tight">ADMIN</h1>
                 <input type="password" value={adminPass} onChange={e => setAdminPass(e.target.value)} placeholder="請輸入密碼" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 outline-none focus:ring-2 focus:ring-blue-500 text-center font-mono text-xl" />
                 <button onClick={() => { if(adminPass === '8888') setIsLogged(true); else alert('密碼錯誤'); }} className="w-full bg-blue-500 text-white py-4 rounded-2xl font-bold shadow-lg">驗證身分</button>
                 <button onClick={() => setIsAdmin(false)} className="text-slate-400 font-bold text-xs uppercase tracking-widest">返回</button>
               </div>
             </div>
           ) : (
             <div className="max-w-4xl mx-auto p-8">
                {editingStage && (
                  <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[2000] flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white w-full max-w-xl rounded-[40px] p-10 space-y-6 shadow-2xl">
                       <div className="flex justify-between items-center"><h3 className="text-xl font-bold">任務編輯</h3><button onClick={() => setEditingStage(null)} className="p-2 hover:bg-slate-100 rounded-full"><X/></button></div>
                       <div className="space-y-4">
                          <div className="space-y-1">
                             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">任務圖片</label>
                             <div onClick={() => fileInputRef.current?.click()} className="h-40 w-full rounded-[24px] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all overflow-hidden relative">
                                {editingStage.imageUrl ? (<img src={editingStage.imageUrl} className="w-full h-full object-cover" alt="Preview" />) : (<div className="text-center text-slate-300">{uploading ? <Loader2 className="animate-spin mx-auto mb-2" /> : <ImageIcon size={32} className="mx-auto mb-2"/>}<p className="font-bold text-xs">點擊上傳照片</p></div>)}
                                {uploading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center font-bold text-blue-500">上傳中...</div>}
                             </div>
                             <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 ml-2">標題</label><input className="w-full bg-slate-50 rounded-xl py-3 px-4 outline-none font-bold text-sm" value={editingStage.title} onChange={e => setEditingStage({...editingStage, title: e.target.value})} /></div>
                            <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 ml-2">角色</label><input className="w-full bg-slate-50 rounded-xl py-3 px-4 outline-none font-bold text-sm" value={editingStage.speaker} onChange={e => setEditingStage({...editingStage, speaker: e.target.value})} /></div>
                          </div>
                          <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 ml-2">內容</label><textarea className="w-full bg-slate-50 rounded-xl p-4 h-32 outline-none text-sm font-medium leading-relaxed" value={editingStage.storyContent} onChange={e => setEditingStage({...editingStage, storyContent: e.target.value})} /></div>
                          <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 ml-2">方式</label><select className="w-full bg-slate-50 rounded-xl py-3 px-4 outline-none font-bold text-sm" value={editingStage.unlockType} onChange={e => setEditingStage({...editingStage, unlockType: e.target.value as any})}><option value="PASSWORD">密碼</option><option value="GPS">GPS</option><option value="QR_CODE">QR</option></select></div>
                             <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 ml-2">答案</label><input className="w-full bg-slate-50 rounded-xl py-3 px-4 outline-none font-bold text-sm" value={editingStage.unlockAnswer} onChange={e => setEditingStage({...editingStage, unlockAnswer: e.target.value})} /></div>
                          </div>
                          <div className="h-40 rounded-[24px] overflow-hidden border border-slate-100">
                            <MapContainer center={[editingStage.lat || 23.55, editingStage.lng || 120.35]} zoom={15} style={{ height: '100%', width: '100%' }}>
                              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                              {editingStage.lat !== undefined && editingStage.lng !== undefined && <Marker position={[editingStage.lat, editingStage.lng]} />}
                              <MapPickerEvents onPick={(lat, lng) => setEditingStage({...editingStage, lat, lng})} />
                            </MapContainer>
                          </div>
                          <button onClick={() => {
                            const newStages = editingStage.id === 'NEW' ? [...game.stages, {...editingStage, id: Date.now().toString()}] : game.stages.map(s => s.id === editingStage.id ? editingStage : s);
                            setGame({...game, stages: newStages}); setEditingStage(null);
                          }} className="w-full bg-blue-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-500/20">儲存變更</button>
                       </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-end mb-12">
                   <div><h1 className="text-4xl font-extrabold tracking-tight text-slate-900">遊戲設定</h1><div className="h-1.5 w-12 bg-blue-500 mt-2" /></div>
                   <div className="flex gap-2">
                      <button onClick={async () => { await setDoc(doc(db, "games", "shinkang_v4"), game); alert("同步完成！"); }} className="bg-blue-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20"><Save size={18}/> 儲存並推送</button>
                      <button onClick={() => { setIsAdmin(false); setIsLogged(false); setAdminPass(''); }} className="bg-white border border-slate-200 px-6 py-3 rounded-xl font-bold text-slate-400">關閉</button>
                   </div>
                </div>

                <div className="space-y-6">
                   <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 flex items-center justify-between">
                      <div className="flex-1">
                         <label className="text-[10px] font-bold text-slate-300 uppercase tracking-widest block mb-1">專案名稱</label>
                         <input className="text-2xl font-black w-full outline-none text-slate-800" value={game.title} onChange={e => setGame({...game, title: e.target.value})} />
                      </div>
                      <button onClick={() => setEditingStage({ id: 'NEW', order: game.stages.length+1, title: '新任務', speaker: '角色名稱', storyContent: '請輸入內容...', unlockType: 'PASSWORD', unlockAnswer: '1234', hints: [''], successMessage: 'Success' })} className="bg-slate-900 text-white w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center"><PlusIcon size={24}/></button>
                   </div>

                   <div className="grid gap-4">
                      {game.stages.map((s, i) => (
                        <div key={s.id} className="bg-white p-6 rounded-[24px] border border-slate-100 flex items-center gap-6 hover:shadow-md transition-all group">
                           <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center font-black text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">{i+1}</div>
                           <div className="flex-1"><h4 className="font-bold text-slate-800">{s.title}</h4><div className="flex gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-tighter"><span>{s.unlockType}</span><span>Key: {s.unlockAnswer}</span></div></div>
                           <div className="flex gap-2"><button onClick={() => setEditingStage(s)} className="p-3 bg-slate-50 text-slate-400 hover:bg-blue-500 hover:text-white rounded-xl transition-all"><Edit2 size={18}/></button><button onClick={() => { if(confirm('確定移除任務？')) setGame({...game, stages: game.stages.filter(item => item.id !== s.id)}) }} className="p-3 bg-slate-50 text-slate-400 hover:bg-red-500 hover:text-white rounded-xl transition-all"><Trash2 size={18}/></button></div>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
           )}
        </div>
      )}

      {isScanning && (
        <div className="absolute inset-0 bg-white z-[2000] flex flex-col items-center justify-center p-8">
           <div className="w-full max-w-sm aspect-square bg-slate-50 rounded-[40px] overflow-hidden border-4 border-blue-500 shadow-2xl mb-8"><div id="reader" className="w-full h-full scale-110"></div></div>
           <button onClick={() => setIsScanning(false)} className="bg-slate-100 text-slate-500 px-10 py-4 rounded-2xl font-bold uppercase tracking-widest">取消掃描</button>
        </div>
      )}

      {panelMode === 'closed' && !isAdmin && (
        <div className="absolute bottom-10 left-0 right-0 z-10 flex justify-center animate-bounce"><button onClick={() => setPanelMode('story')} className="bg-blue-500 text-white px-8 py-4 rounded-full font-bold flex items-center gap-2 shadow-xl shadow-blue-500/40">開啟任務資訊 <ChevronUp size={20} /></button></div>
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
