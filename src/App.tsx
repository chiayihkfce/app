import { useState, useEffect } from 'react';
import { BookOpen, Map as MapIcon, Briefcase, Settings, ChevronRight, MapPin, HelpCircle, CheckCircle2, Trash2, Edit2, ArrowLeft, X, QrCode, Save, LogIn, RefreshCw, MessageCircle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Html5QrcodeScanner } from "html5-qrcode";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";

// --- 介面優化：Leaflet 標記 ---
import 'leaflet/dist/leaflet.css';
const createCustomIcon = (color: string) => L.divIcon({
  html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
  className: 'custom-div-icon',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

// --- 類型定義 ---
export type UnlockType = 'PASSWORD' | 'GPS' | 'QR_CODE';
export interface Stage {
  id: string;
  order: number;
  title: string;
  speaker: string;
  storyContent: string;
  imageUrl?: string;
  unlockType: UnlockType;
  unlockAnswer: string;
  lat?: number;
  lng?: number;
  hints: string[];
  successMessage: string;
  itemReward?: string;
}
export interface Game {
  title: string;
  stages: Stage[];
}

const VERSION = "3.5.2"; // 版本標記，用於強制更新

export default function App() {
  const [game, setGame] = useState<Game>({ title: '載入中...', stages: [] });
  const [activeTab, setActiveTab] = useState<'story' | 'map' | 'backpack' | 'admin'>('story');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLogged, setIsLogged] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  
  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [inventory, setInventory] = useState<string[]>([]);
  const [userInput, setUserInput] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [solved, setSolved] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);

  // --- 自動檢查版本並清理快取 ---
  useEffect(() => {
    const savedVersion = localStorage.getItem('enigma_version');
    if (savedVersion !== VERSION) {
      localStorage.setItem('enigma_version', VERSION);
      // 如果是第一次升級到 v3.5，強制重整以抓取最新資源
      if (savedVersion) window.location.reload();
    }
  }, []);

  // --- Firestore 即時同步 ---
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "games", "shinkang_v3"), (snapshot) => {
      if (snapshot.exists()) {
        setGame(snapshot.data() as Game);
      }
      setLoading(false);
    }, (err) => {
      console.error("Firebase 連線失敗:", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const currentStage = game.stages[currentStageIdx] || (game.stages.length > 0 ? game.stages[0] : null);

  // --- QR 掃描器 ---
  useEffect(() => {
    if (isScanning && currentStage) {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
      scanner.render((text) => {
        if (text.toLowerCase() === currentStage.unlockAnswer.toLowerCase()) {
          scanner.clear(); setIsScanning(false); setSolved(true);
        } else alert("二維碼內容不符！");
      }, () => {});
      return () => { scanner.clear().catch(() => {}); };
    }
  }, [isScanning, currentStage]);

  if (loading) return <div className="h-screen bg-black flex flex-col items-center justify-center text-amber-500 font-black space-y-4">
    <RefreshCw className="animate-spin" size={48} />
    <p className="tracking-[0.5em] animate-pulse uppercase">Connecting Enigma Cloud</p>
  </div>;

  if (!currentStage && !isAdmin) return <div className="h-screen bg-slate-900 text-white flex items-center justify-center p-10 text-center">暫無遊戲資料，請進入系統後台建立。</div>;

  // --- 玩家內容渲染 ---
  const renderPlayerContent = () => {
    if (!currentStage) return null;
    switch (activeTab) {
      case 'story':
        return (
          <div className="flex flex-col h-full bg-black overflow-hidden animate-in fade-in duration-700">
            {/* 頂部場景大圖 */}
            <div className="relative h-[50vh] w-full">
               <img 
                 src={currentStage.imageUrl || 'https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=800'} 
                 className="w-full h-full object-cover grayscale-[30%] contrast-[1.1]" 
                 alt="Scene"
                 onError={(e) => { e.currentTarget.src = "https://images.unsplash.com/photo-1501503060445-73887c28bf13?q=80&w=800" }}
               />
               <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
               
               {/* 懸浮任務標章 */}
               <div className="absolute top-12 left-6 bg-amber-500/90 backdrop-blur-md px-4 py-1.5 rounded-full shadow-2xl flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                  <span className="text-black font-black text-[10px] uppercase tracking-widest">Stage {currentStageIdx + 1}</span>
               </div>
            </div>

            {/* RPG 對話框邏輯 */}
            <div className="flex-1 bg-black px-6 pt-2 pb-32 flex flex-col relative">
               <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]">
                     <MessageCircle size={20} />
                  </div>
                  <h3 className="text-amber-500 font-black tracking-widest">{currentStage.speaker}</h3>
               </div>

               <div className="bg-slate-900/50 border-l-4 border-amber-500 p-6 rounded-r-3xl shadow-inner">
                  <p className="text-slate-200 text-lg leading-loose font-medium italic">
                    「{currentStage.storyContent}」
                  </p>
               </div>

               {!solved ? (
                 <div className="mt-8 space-y-5">
                    {currentStage.unlockType === 'PASSWORD' ? (
                      <div className="relative group">
                        <input type="text" value={userInput} onChange={e => setUserInput(e.target.value)} placeholder="在此輸入線索..." className="w-full bg-slate-900 border-2 border-slate-800 rounded-2xl py-5 px-8 outline-none focus:border-amber-500 text-white font-bold transition-all shadow-2xl" />
                        <button onClick={() => { if(userInput.trim().toLowerCase() === currentStage.unlockAnswer.toLowerCase()) setSolved(true); else alert('密碼不正確！'); }} className="absolute right-3 top-3 bottom-3 bg-amber-500 text-black px-8 rounded-xl font-black active:scale-95 transition-all">解密</button>
                      </div>
                    ) : currentStage.unlockType === 'GPS' ? (
                      <button onClick={() => navigator.geolocation.getCurrentPosition(pos => {
                        const d = L.latLng(pos.coords.latitude, pos.coords.longitude).distanceTo(L.latLng(currentStage.lat!, currentStage.lng!));
                        if(d < 100) setSolved(true); else alert(`距離目標還差約 ${Math.round(d)} 公尺`);
                      })} className="w-full bg-amber-500 text-black py-5 rounded-2xl font-black flex items-center justify-center gap-3 shadow-[0_10px_20px_rgba(245,158,11,0.3)]">
                        <MapPin size={24} /> 抵達定位驗證
                      </button>
                    ) : (
                      <button onClick={() => setIsScanning(true)} className="w-full bg-amber-500 text-black py-5 rounded-2xl font-black flex items-center justify-center gap-3 shadow-[0_10px_20px_rgba(245,158,11,0.3)]">
                        <QrCode size={24} /> 開啟掃描器
                      </button>
                    )}
                    <button onClick={() => setShowHint(!showHint)} className="w-full py-2 text-slate-600 hover:text-amber-500/50 text-[10px] font-black uppercase tracking-[0.3em] transition-colors">Request Support Data</button>
                    {showHint && <div className="bg-amber-500/5 border border-amber-500/20 p-5 rounded-2xl text-amber-200/80 text-sm italic leading-relaxed animate-in slide-in-from-top-2">{currentStage.hints[0]}</div>}
                 </div>
               ) : (
                 <div className="mt-8 bg-green-500/10 border border-green-500/30 p-8 rounded-[40px] text-center animate-in zoom-in duration-500 shadow-2xl">
                    <CheckCircle2 size={56} className="mx-auto text-green-500 mb-4 drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                    <p className="text-green-400 font-black text-xl mb-6">任務達成！</p>
                    <p className="text-slate-400 text-sm mb-8 px-4 leading-relaxed">{currentStage.successMessage}</p>
                    <button onClick={() => { 
                      if(currentStage.itemReward) setInventory([...inventory, currentStage.itemReward]);
                      setSolved(false); setCurrentStageIdx(prev => (prev+1)%game.stages.length); setUserInput(''); setShowHint(false);
                    }} className="w-full bg-green-500 py-5 rounded-3xl text-black font-black flex items-center justify-center gap-2 shadow-xl">下一章節 <ChevronRight size={24}/></button>
                 </div>
               )}
            </div>
          </div>
        );
      case 'map':
        return (
          <div className="h-full relative animate-in fade-in duration-500">
            <MapContainer center={[currentStage.lat || 23.55, currentStage.lng || 120.35]} zoom={16} style={{ height: '100%' }}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
              {game.stages.map((s, idx) => (
                s.lat && s.lng && (
                  <Marker key={s.id} position={[s.lat, s.lng]} icon={createCustomIcon(idx === currentStageIdx ? '#f59e0b' : '#475569')}>
                    <Popup className="custom-popup">
                       <div className="p-3 text-center">
                          <h4 className="font-black text-slate-900 text-lg mb-1">{s.title}</h4>
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">Type: {s.unlockType}</p>
                          <button onClick={() => { setCurrentStageIdx(idx); setActiveTab('story'); }} className="w-full bg-slate-900 text-amber-500 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">Jump to Stage</button>
                       </div>
                    </Popup>
                  </Marker>
                )
              ))}
            </MapContainer>
            <div className="absolute top-10 left-6 right-6 z-[1000] pointer-events-none">
               <div className="bg-black/60 backdrop-blur-xl p-5 rounded-[32px] border border-white/5 shadow-2xl inline-block">
                  <h3 className="text-white font-black text-xs uppercase tracking-[0.2em] mb-1">Real-time Radar</h3>
                  <p className="text-slate-400 text-[9px] font-bold italic">點擊地標可切換探索點</p>
               </div>
            </div>
          </div>
        );
      case 'backpack':
        return (
          <div className="h-full bg-black p-10 pt-20 animate-in slide-in-from-bottom duration-500">
             <div className="flex items-center gap-4 mb-2">
                <Briefcase className="text-amber-500" size={40} />
                <h2 className="text-4xl font-black text-white">拾獲物</h2>
             </div>
             <p className="text-slate-600 text-xs font-black tracking-[0.4em] uppercase mb-12">Artifact Collection</p>
             
             {inventory.length === 0 ? (
               <div className="mt-20 flex flex-col items-center justify-center opacity-20">
                  <div className="w-32 h-32 border-4 border-dashed border-slate-800 rounded-full flex items-center justify-center mb-6">
                     <Briefcase size={48} />
                  </div>
                  <p className="font-black uppercase tracking-widest text-sm text-slate-500">背包空無一物</p>
               </div>
             ) : (
               <div className="grid grid-cols-2 gap-6">
                  {inventory.map((item, i) => (
                    <div key={i} className="bg-slate-900/50 border border-slate-800 p-8 rounded-[40px] flex flex-col items-center gap-4 shadow-2xl active:scale-95 transition-all">
                       <div className="w-20 h-20 bg-amber-500/10 rounded-[24px] flex items-center justify-center text-amber-500">
                          <BookOpen size={32} />
                       </div>
                       <span className="text-white font-black text-sm tracking-wide">{item}</span>
                    </div>
                  ))}
               </div>
             )}
          </div>
        );
      case 'admin':
        return (
          <div className="h-full bg-slate-950 flex flex-col items-center justify-center p-10 text-center">
             <div className="w-20 h-20 bg-slate-900 rounded-[32px] flex items-center justify-center text-slate-500 mb-8 border border-white/5 shadow-2xl">
                <Settings size={32} />
             </div>
             <h2 className="text-2xl font-black text-white mb-4">系統核心設定</h2>
             <p className="text-slate-500 text-sm mb-10 leading-relaxed">此區域僅供管理員進行時空檔案修改</p>
             <button onClick={() => setIsAdmin(true)} className="bg-white text-black px-10 py-4 rounded-2xl font-black shadow-[0_10px_30px_rgba(255,255,255,0.1)] active:scale-95 transition-all">身份驗證</button>
          </div>
        );
    }
  };

  // --- 管理端介面渲染 ---
  if (isAdmin) {
    if (!isLogged) return (
      <div className="h-screen bg-black flex items-center justify-center p-8">
        <div className="bg-slate-900 p-12 rounded-[50px] shadow-2xl w-full max-w-sm text-center space-y-8 border border-white/5">
           <h1 className="text-3xl font-black text-white tracking-widest">AUTHENTICATION</h1>
           <input type="password" value={adminPass} onChange={e => setAdminPass(e.target.value)} placeholder="PASSCODE" className="w-full bg-black border-2 border-slate-800 rounded-2xl py-5 px-6 outline-none focus:border-amber-500 text-center font-mono text-2xl tracking-[0.5em] text-amber-500" />
           <button onClick={() => { if(adminPass === '8888') setIsLogged(true); else alert('拒絕訪問'); }} className="w-full bg-amber-500 text-black py-5 rounded-3xl font-black shadow-xl shadow-amber-900/20 active:scale-95 transition-all uppercase">Enter Core</button>
           <button onClick={() => setIsAdmin(false)} className="text-slate-600 font-bold hover:text-slate-400 transition-colors uppercase text-xs tracking-widest">Return to Game</button>
        </div>
      </div>
    );

    return (
      <div className="min-h-screen bg-slate-50 p-8 font-sans text-slate-900 pb-32">
        {editingStage && (
          <div className="fixed inset-0 bg-black/95 z-[2000] flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-xl rounded-[50px] p-10 space-y-6 shadow-2xl">
               <div className="flex justify-between items-center"><h3 className="text-2xl font-black italic">STAGE EDITOR</h3><button onClick={() => setEditingStage(null)} className="p-2 hover:bg-slate-100 rounded-full"><X/></button></div>
               <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase">標題</label><input className="w-full border-b-2 py-2 outline-none font-bold text-lg" value={editingStage.title} onChange={e => setEditingStage({...editingStage, title: e.target.value})} /></div>
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase">說話者</label><input className="w-full border-b-2 py-2 outline-none font-bold text-lg" value={editingStage.speaker} onChange={e => setEditingStage({...editingStage, speaker: e.target.value})} /></div>
                  </div>
                  <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase">劇情故事</label><textarea className="w-full bg-slate-50 rounded-2xl p-5 h-32 outline-none text-sm leading-relaxed" value={editingStage.storyContent} onChange={e => setEditingStage({...editingStage, storyContent: e.target.value})} /></div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">大圖網址 (建議使用 Imgur 連結)</label>
                    <input className="w-full border-b-2 py-2 outline-none text-xs text-blue-600 font-mono" placeholder="https://i.imgur.com/..." value={editingStage.imageUrl} onChange={e => setEditingStage({...editingStage, imageUrl: e.target.value})} />
                    {editingStage.imageUrl && <div className="mt-2 h-20 w-full rounded-xl overflow-hidden border bg-slate-100"><img src={editingStage.imageUrl} className="w-full h-full object-cover" alt="Preview" onError={(e) => e.currentTarget.src="https://via.placeholder.com/100?text=Error"} /></div>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase">解鎖類型</label><select className="w-full border-b-2 py-2 bg-white" value={editingStage.unlockType} onChange={e => setEditingStage({...editingStage, unlockType: e.target.value as any})}><option value="PASSWORD">密碼鎖</option><option value="GPS">GPS定位</option><option value="QR_CODE">QR掃描</option></select></div>
                     <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase">正確答案</label><input className="w-full border-b-2 py-2 outline-none font-mono" value={editingStage.unlockAnswer} onChange={e => setEditingStage({...editingStage, unlockAnswer: e.target.value})} /></div>
                  </div>
                  <button onClick={() => {
                    const newStages = editingStage.id === 'NEW' ? [...game.stages, {...editingStage, id: Date.now().toString()}] : game.stages.map(s => s.id === editingStage.id ? editingStage : s);
                    setGame({...game, stages: newStages}); setEditingStage(null);
                  }} className="w-full bg-slate-900 text-white py-5 rounded-[24px] font-black text-lg shadow-xl active:scale-95 transition-all">更新檔案</button>
               </div>
            </div>
          </div>
        )}

        <div className="max-w-3xl mx-auto">
           <div className="flex justify-between items-center mb-16">
              <div><h1 className="text-4xl font-black text-slate-900">遊戲引擎後台</h1><p className="text-slate-400 text-xs font-bold uppercase tracking-[0.3em] mt-1 italic underline decoration-amber-500">Cloud Sync Active</p></div>
              <div className="flex gap-3">
                 <button onClick={async () => { await setDoc(doc(db, "games", "shinkang_v3"), game); alert("雲端同步成功！全玩家手機已更新。"); }} className="bg-green-600 text-white px-8 py-4 rounded-3xl font-black flex items-center gap-2 shadow-xl shadow-green-100 active:scale-95 transition-all"><Save size={20}/> 雲端發布</button>
                 <button onClick={() => { setIsAdmin(false); setIsLogged(false); }} className="bg-white border px-8 py-4 rounded-3xl font-bold flex items-center gap-2 shadow-sm active:scale-95 transition-all"><ArrowLeft size={20}/> 返回遊戲</button>
              </div>
           </div>
           
           <div className="space-y-6">
              <div className="bg-white p-10 rounded-[50px] shadow-sm border border-slate-100 flex items-center justify-between">
                 <div className="flex-1"><label className="text-[9px] font-black text-slate-300 uppercase tracking-widest block mb-2">Project Name</label><input className="text-4xl font-black w-full outline-none text-slate-900 focus:text-indigo-600 transition-colors" value={game.title} onChange={e => setGame({...game, title: e.target.value})} /></div>
                 <button onClick={() => setEditingStage({ id: 'NEW', order: game.stages.length+1, title: '新關卡', speaker: '白鸞卿', storyContent: '新的故事開始了...', unlockType: 'PASSWORD', unlockAnswer: '1234', hints: [''], successMessage: '任務成功！' })} className="bg-indigo-600 text-white p-5 rounded-full shadow-xl shadow-indigo-100 active:rotate-90 transition-all"><Plus size={32}/></button>
              </div>

              <div className="grid gap-4">
                 {game.stages.map((s, i) => (
                   <div key={s.id} className="bg-white p-8 rounded-[40px] border-2 border-transparent hover:border-indigo-100 flex items-center gap-8 transition-all group shadow-sm overflow-hidden relative">
                      <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center font-black text-slate-300 text-2xl group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">{i+1}</div>
                      <div className="flex-1">
                         <h4 className="text-xl font-black text-slate-800">{s.title}</h4>
                         <div className="flex gap-2 mt-2">
                            <span className="bg-slate-100 text-[9px] font-black text-slate-400 px-3 py-1 rounded-full uppercase tracking-tighter">{s.unlockType}</span>
                            <span className="bg-slate-100 text-[9px] font-black text-slate-400 px-3 py-1 rounded-full uppercase tracking-tighter">Ans: {s.unlockAnswer}</span>
                         </div>
                      </div>
                      <div className="flex gap-3 relative z-10">
                         <button onClick={() => setEditingStage(s)} className="p-5 bg-slate-50 text-slate-400 hover:bg-indigo-600 hover:text-white rounded-3xl transition-all shadow-sm"><Edit2 size={24}/></button>
                         <button onClick={() => { if(confirm('刪除？')) setGame({...game, stages: game.stages.filter(item => item.id !== s.id)}) }} className="p-5 bg-slate-50 text-slate-400 hover:bg-red-500 hover:text-white rounded-3xl transition-all shadow-sm"><Trash2 size={24}/></button>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    );
  }

  // --- 主 APP 骨架 ---
  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden selection:bg-amber-500 selection:text-black">
      <div className="flex-1 overflow-y-auto">
         {renderPlayerContent()}
      </div>

      {/* 底部導覽列 (v3.5 精緻版) */}
      <div className="fixed bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black via-black/95 to-transparent pointer-events-none z-[1000]"></div>
      <div className="fixed bottom-6 left-6 right-6 h-20 bg-slate-900/80 backdrop-blur-3xl rounded-[32px] border border-white/5 flex items-center justify-around px-4 z-[1001] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
         <button onClick={() => setActiveTab('story')} className={`flex flex-col items-center gap-1 transition-all pointer-events-auto ${activeTab === 'story' ? 'text-amber-500 scale-110' : 'text-slate-600 opacity-50'}`}>
            <BookOpen size={22} strokeWidth={activeTab === 'story' ? 3 : 2} /> <span className="text-[9px] font-black uppercase tracking-widest">Story</span>
         </button>
         <button onClick={() => setActiveTab('map')} className={`flex flex-col items-center gap-1 transition-all pointer-events-auto ${activeTab === 'map' ? 'text-amber-500 scale-110' : 'text-slate-600 opacity-50'}`}>
            <MapIcon size={22} strokeWidth={activeTab === 'map' ? 3 : 2} /> <span className="text-[9px] font-black uppercase tracking-widest">Radar</span>
         </button>
         <button onClick={() => setActiveTab('backpack')} className={`flex flex-col items-center gap-1 transition-all pointer-events-auto ${activeTab === 'backpack' ? 'text-amber-500 scale-110' : 'text-slate-600 opacity-50'}`}>
            <Briefcase size={22} strokeWidth={activeTab === 'backpack' ? 3 : 2} /> <span className="text-[9px] font-black uppercase tracking-widest">Items</span>
         </button>
         <button onClick={() => setActiveTab('admin')} className={`flex flex-col items-center gap-1 transition-all pointer-events-auto ${activeTab === 'admin' ? 'text-amber-500 scale-110' : 'text-slate-600 opacity-50'}`}>
            <Settings size={22} strokeWidth={activeTab === 'admin' ? 3 : 2} /> <span className="text-[9px] font-black uppercase tracking-widest">Engine</span>
         </button>
      </div>

      {/* QR 層面 */}
      {isScanning && (
        <div className="fixed inset-0 bg-black z-[2000] flex flex-col items-center justify-center p-8 animate-in zoom-in duration-300">
           <div className="w-full max-w-sm aspect-square bg-slate-900 rounded-[50px] overflow-hidden border-4 border-amber-500 shadow-[0_0_50px_rgba(245,158,11,0.3)] mb-12">
              <div id="reader" className="w-full h-full scale-110"></div>
           </div>
           <button onClick={() => setIsScanning(false)} className="bg-white/10 hover:bg-white/20 text-white px-12 py-5 rounded-3xl font-black uppercase tracking-[0.2em] transition-all">Abort Scanner</button>
        </div>
      )}
    </div>
  );
}

// 補上缺少的 Plus 圖示匯入
function Plus({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
}
