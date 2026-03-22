import { useState, useEffect } from 'react';
import { BookOpen, Map as MapIcon, Briefcase, Settings, ChevronRight, CheckCircle2, Trash2, Edit2, X, QrCode, Save, RefreshCw, MessageCircle, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Html5QrcodeScanner } from "html5-qrcode";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";

import 'leaflet/dist/leaflet.css';
const createCustomIcon = (color: string) => L.divIcon({
  html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
  className: 'custom-div-icon', iconSize: [30, 30], iconAnchor: [15, 30],
});

export type UnlockType = 'PASSWORD' | 'GPS' | 'QR_CODE';
export interface Stage {
  id: string; order: number; title: string; speaker: string; storyContent: string; imageUrl?: string; unlockType: UnlockType; unlockAnswer: string; lat?: number; lng?: number; hints: string[]; successMessage: string; itemReward?: string;
}
export interface Game { title: string; stages: Stage[]; }

const VERSION = "3.6.1";
const DEFAULT_GAME: Game = {
  title: '新港八卦謎蹤 v3.6.1',
  stages: [
    {
      id: 's1', order: 1, title: '時空的裂縫', speaker: '白鸞卿', 
      storyContent: '你...能看見我？太好了。我是清朝縣丞白鸞卿。這新港的卦象全亂了，我被困在這昭和九年的時空裡。請幫我找到土地公廟的建立年份，那是修復時空的關鍵。', 
      imageUrl: 'https://images.unsplash.com/photo-1590001158193-790130ae8ccb?q=80&w=1000',
      unlockType: 'PASSWORD', unlockAnswer: '1860', hints: ['石碑右下角有四個數字'], successMessage: '沒錯！1860年，這股力量開始波動。'
    },
    {
      id: 's2', order: 2, title: '遺失的方位', speaker: '神祕老人', 
      storyContent: '後生，這羅盤指的方向不對。你得親自去「新港文教基金會」看看，那裡的龍柱上刻著失傳的咒文。', 
      imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1000',
      unlockType: 'GPS', unlockAnswer: 'ARRIVED', lat: 23.557404, lng: 120.347565, hints: ['請打開地圖導航前往基金會'], successMessage: '你感受到了嗎？這裡的空氣正在變冷。', itemReward: '青龍玉珮'
    }
  ]
};

export default function App() {
  const [game, setGame] = useState<Game>(DEFAULT_GAME);
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

  useEffect(() => {
    const savedV = localStorage.getItem('enigma_version');
    if (savedV !== VERSION) { 
      localStorage.setItem('enigma_version', VERSION); 
      if (savedV) window.location.reload(); 
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "games", "shinkang_v3"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Game;
        if (data.stages && data.stages.length > 0) setGame(data);
      } else {
        setDoc(doc(db, "games", "shinkang_v3"), DEFAULT_GAME);
      }
      setLoading(false);
    }, () => setLoading(false));
    return () => unsubscribe();
  }, []);

  const currentStage = game.stages[currentStageIdx] || game.stages[0];

  useEffect(() => {
    if (isScanning && currentStage) {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
      scanner.render((text) => {
        if (text.toLowerCase() === currentStage.unlockAnswer.toLowerCase()) {
          scanner.clear(); setIsScanning(false); setSolved(true);
        } else alert("無效的代碼");
      }, () => {});
      return () => { scanner.clear().catch(() => {}); };
    }
  }, [isScanning, currentStage]);

  if (loading) return <div className="h-screen bg-black flex flex-col items-center justify-center text-amber-500 font-black">
    <RefreshCw className="animate-spin mb-4" size={40} />
    <div className="tracking-[0.3em]">RECONNECTING...</div>
  </div>;

  const renderPlayerContent = () => {
    switch (activeTab) {
      case 'story':
        return (
          <div className="flex flex-col h-full bg-black">
            <div className="relative h-[48vh] w-full">
               <img src={currentStage.imageUrl} className="w-full h-full object-cover grayscale-[20%]" alt="Scene" onError={(e) => e.currentTarget.src="https://images.unsplash.com/photo-1501503060445-73887c28bf13?q=80&w=1000"} />
               <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
               <div className="absolute bottom-10 left-8 right-8 text-white">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="bg-amber-500 text-black text-[9px] font-black px-2 py-0.5 rounded tracking-tighter uppercase">Mission {currentStageIdx + 1}</div>
                    <div className="h-[1px] flex-1 bg-white/20" />
                  </div>
                  <h2 className="text-4xl font-black tracking-tight drop-shadow-2xl">{currentStage.title}</h2>
               </div>
            </div>
            <div className="flex-1 bg-black px-8 pt-2 pb-32 flex flex-col">
               <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                    <MessageCircle size={20} />
                  </div>
                  <span className="text-amber-500 font-black tracking-[0.2em] uppercase text-sm">{currentStage.speaker}</span>
               </div>
               <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-7 rounded-[32px] shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
                  <p className="text-slate-200 text-lg leading-relaxed font-medium">「{currentStage.storyContent}」</p>
               </div>
               {!solved ? (
                 <div className="mt-8 space-y-5">
                    {currentStage.unlockType === 'PASSWORD' ? (
                      <div className="relative group text-white">
                        <input type="text" value={userInput} onChange={e => setUserInput(e.target.value)} placeholder="INPUT DECRYPTION KEY" className="w-full bg-slate-900/80 border-2 border-slate-800 rounded-[24px] py-5 px-8 outline-none focus:border-amber-500 font-mono tracking-widest transition-all" />
                        <button onClick={() => { if(userInput.trim().toLowerCase() === currentStage.unlockAnswer.toLowerCase()) setSolved(true); else alert('ERROR: 無法解析該代碼'); }} className="absolute right-3 top-3 bottom-3 bg-amber-500 text-black px-8 rounded-2xl font-black shadow-lg shadow-amber-900/40 active:scale-95 transition-all">OK</button>
                      </div>
                    ) : currentStage.unlockType === 'GPS' ? (
                      <button onClick={() => navigator.geolocation.getCurrentPosition(pos => {
                        const d = L.latLng(pos.coords.latitude, pos.coords.longitude).distanceTo(L.latLng(currentStage.lat!, currentStage.lng!));
                        if(d < 100) setSolved(true); else alert(`目標距離尚遠：約 ${Math.round(d)} 公尺`);
                      })} className="w-full bg-amber-500 text-black py-5 rounded-[24px] font-black flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"><MapPin size={24}/> 抵達定位驗證</button>
                    ) : (
                      <button onClick={() => setIsScanning(true)} className="w-full bg-amber-500 text-black py-5 rounded-[24px] font-black flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"><QrCode size={24}/> 開啟掃描器</button>
                    )}
                    <button onClick={() => setShowHint(!showHint)} className="w-full py-2 text-slate-600 hover:text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] transition-colors">Request Support Data</button>
                    {showHint && <div className="bg-amber-500/5 border border-amber-500/20 p-5 rounded-2xl text-amber-200/80 text-xs italic leading-relaxed animate-in slide-in-from-top-2">{currentStage.hints[0]}</div>}
                 </div>
               ) : (
                 <div className="mt-8 bg-green-500/10 border border-green-500/30 p-8 rounded-[40px] text-center shadow-2xl animate-in zoom-in duration-500">
                    <CheckCircle2 size={56} className="mx-auto text-green-500 mb-4" />
                    <p className="text-green-400 font-black text-xl mb-6 tracking-widest uppercase">Mission Clear</p>
                    <button onClick={() => { if(currentStage.itemReward) setInventory([...inventory, currentStage.itemReward]); setSolved(false); setCurrentStageIdx(prev => (prev+1)%game.stages.length); setUserInput(''); setShowHint(false); }} className="w-full bg-green-500 py-5 rounded-[24px] text-black font-black flex items-center justify-center gap-2 shadow-xl shadow-green-900/20 active:scale-95 transition-all">NEXT CHAPTER <ChevronRight size={24}/></button>
                 </div>
               )}
            </div>
          </div>
        );
      case 'map':
        return (
          <div className="h-full relative">
            <MapContainer center={[currentStage.lat || 23.55, currentStage.lng || 120.35]} zoom={16} style={{ height: '100%' }}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
              {game.stages.map((s, idx) => ( s.lat && s.lng && (
                  <Marker key={s.id} position={[s.lat, s.lng]} icon={createCustomIcon(idx === currentStageIdx ? '#f59e0b' : '#475569')}>
                    <Popup className="custom-popup"><div className="p-3 text-center text-slate-900 font-sans"><h4 className="font-black text-lg mb-2">{s.title}</h4><button onClick={() => { setCurrentStageIdx(idx); setActiveTab('story'); }} className="w-full bg-slate-900 text-amber-500 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl">Start This Mission</button></div></Popup>
                  </Marker>
              )))}
            </MapContainer>
            <div className="absolute top-12 left-6 z-[1000] bg-black/60 backdrop-blur-xl p-5 rounded-[28px] border border-white/5 shadow-2xl text-white">
               <h3 className="font-black text-xs uppercase tracking-widest mb-1">Reality Radar</h3>
               <p className="text-slate-500 text-[9px] font-bold italic">點擊標記點切換任務</p>
            </div>
          </div>
        );
      case 'backpack':
        return (
          <div className="h-full bg-black p-10 pt-24 animate-in slide-in-from-bottom duration-500">
             <h2 className="text-5xl font-black text-white mb-2 flex items-center gap-4"><Briefcase className="text-amber-500" size={48}/> 背包</h2>
             <p className="text-slate-600 text-xs font-black tracking-[0.5em] uppercase mb-16 italic">Collection of Artifacts</p>
             {inventory.length === 0 ? (<div className="mt-20 flex flex-col items-center opacity-10 text-white"><Briefcase size={80} className="mb-6"/><p className="font-black uppercase tracking-[0.3em] text-sm">Empty Inventory</p></div>) : (
               <div className="grid grid-cols-2 gap-6">{inventory.map((item, i) => (<div key={i} className="bg-slate-900/50 border border-slate-800 p-10 rounded-[48px] flex flex-col items-center gap-5 text-white text-sm font-black shadow-2xl transition-all active:scale-95 text-center"><div className="w-20 h-20 bg-amber-500/10 rounded-[28px] flex items-center justify-center text-amber-500 shadow-inner"><BookOpen size={36}/></div><span className="tracking-wide">{item}</span></div>))}</div>
             )}
          </div>
        );
      case 'admin':
        return (
          <div className="h-full bg-slate-950 flex flex-col items-center justify-center p-10 text-center text-white">
             <div className="w-24 h-24 bg-slate-900 rounded-[40px] flex items-center justify-center text-slate-700 mb-10 border border-white/5 shadow-2xl"><Settings size={40} /></div>
             <h2 className="text-3xl font-black mb-4 tracking-tight">ENIGMA CORE</h2>
             <p className="text-slate-500 text-sm mb-12 font-medium leading-relaxed max-w-xs mx-auto">Only high-level administrators can modify the timeline archives.</p>
             <button onClick={() => setIsAdmin(true)} className="bg-white text-black px-14 py-5 rounded-[24px] font-black shadow-2xl active:scale-95 transition-all tracking-widest">AUTHENTICATE</button>
          </div>
        );
    }
  };

  if (isAdmin) {
    if (!isLogged) return (
      <div className="h-screen bg-black flex items-center justify-center p-8 text-white">
        <div className="bg-slate-900 p-12 rounded-[60px] shadow-2xl w-full max-w-sm text-center border border-white/5 space-y-10">
           <h1 className="text-3xl font-black tracking-[0.3em]">LOGIN</h1>
           <input type="password" value={adminPass} onChange={e => setAdminPass(e.target.value)} placeholder="••••" className="w-full bg-black border-2 border-slate-800 rounded-3xl py-6 px-6 outline-none focus:border-amber-500 text-center font-mono text-3xl text-amber-500 tracking-[0.5em]" />
           <button onClick={() => { if(adminPass === '8888') setIsLogged(true); else alert('拒絕存取'); }} className="w-full bg-amber-500 text-black py-5 rounded-[30px] font-black shadow-xl active:scale-95 transition-all">ENTER SYSTEM</button>
           <button onClick={() => setIsAdmin(false)} className="text-slate-600 font-bold uppercase text-[10px] tracking-widest hover:text-slate-400">Cancel</button>
        </div>
      </div>
    );

    return (
      <div className="min-h-screen bg-slate-50 p-8 text-slate-900 pb-40 font-sans">
        {editingStage && (
          <div className="fixed inset-0 bg-black/95 z-[2000] flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-xl rounded-[60px] p-12 space-y-8 shadow-2xl text-slate-900">
               <div className="flex justify-between items-center"><h3 className="text-3xl font-black italic tracking-tighter">MISSION EDITOR</h3><button onClick={() => setEditingStage(null)} className="p-3 hover:bg-slate-100 rounded-full transition-colors"><X/></button></div>
               <div className="space-y-6 text-slate-900">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">任務標題</label><input className="w-full border-b-2 py-3 outline-none font-bold text-xl text-slate-900" value={editingStage.title} onChange={e => setEditingStage({...editingStage, title: e.target.value})} /></div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">發話者</label><input className="w-full border-b-2 py-3 outline-none font-bold text-xl text-slate-900" value={editingStage.speaker} onChange={e => setEditingStage({...editingStage, speaker: e.target.value})} /></div>
                  </div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">故事內容</label><textarea className="w-full bg-slate-50 rounded-[32px] p-6 h-40 outline-none text-base leading-relaxed text-slate-900 shadow-inner" value={editingStage.storyContent} onChange={e => setEditingStage({...editingStage, storyContent: e.target.value})} /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">場景圖片 URL</label><input className="w-full border-b-2 py-3 outline-none text-sm text-blue-600 font-mono" placeholder="https://..." value={editingStage.imageUrl} onChange={e => setEditingStage({...editingStage, imageUrl: e.target.value})} /></div>
                  <div className="grid grid-cols-2 gap-6">
                     <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">解鎖方式</label><select className="w-full border-b-2 py-3 bg-white text-slate-900 font-bold" value={editingStage.unlockType} onChange={e => setEditingStage({...editingStage, unlockType: e.target.value as any})}><option value="PASSWORD">密碼</option><option value="GPS">GPS定位</option><option value="QR_CODE">QR掃描</option></select></div>
                     <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">正確答案</label><input className="w-full border-b-2 py-3 outline-none font-mono text-xl text-slate-900 font-bold" value={editingStage.unlockAnswer} onChange={e => setEditingStage({...editingStage, unlockAnswer: e.target.value})} /></div>
                  </div>
                  {editingStage.unlockType === 'GPS' && (
                    <div className="h-56 rounded-[32px] overflow-hidden border-2 shadow-lg"><MapContainer center={[editingStage.lat || 23.55, editingStage.lng || 120.35]} zoom={15} style={{ height: '100%' }}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><Marker position={[editingStage.lat || 23.55, editingStage.lng || 120.35]} /><LocationPickerHelper onPick={(lat, lng) => setEditingStage({...editingStage, lat, lng})} /></MapContainer></div>
                  )}
                  <input className="w-full border-b-2 py-3 outline-none font-bold placeholder:text-slate-300" placeholder="獎勵道具名稱 (選填)" value={editingStage.itemReward} onChange={e => setEditingStage({...editingStage, itemReward: e.target.value})} />
                  <button onClick={() => {
                    const newStages = editingStage.id === 'NEW' ? [...game.stages, {...editingStage, id: Date.now().toString()}] : game.stages.map(s => s.id === editingStage.id ? editingStage : s);
                    setGame({...game, stages: newStages}); setEditingStage(null);
                  }} className="w-full bg-slate-900 text-white py-6 rounded-[32px] font-black text-xl shadow-2xl active:scale-95 transition-all text-center">更新時空檔案</button>
               </div>
            </div>
          </div>
        )}

        <div className="max-w-4xl mx-auto text-slate-900">
           <div className="flex justify-between items-end mb-20">
              <div><h1 className="text-5xl font-black tracking-tighter">CLOUD ENGINE</h1><div className="h-1.5 w-20 bg-amber-500 mt-4" /></div>
              <div className="flex gap-4">
                 <button onClick={async () => { await setDoc(doc(db, "games", "shinkang_v3"), game); alert("全球同步已完成！"); }} className="bg-green-600 text-white px-10 py-5 rounded-[30px] font-black flex items-center gap-3 shadow-2xl active:scale-95 transition-all italic tracking-tighter"><Save size={24}/> PUSH UPDATE</button>
                 <button onClick={() => { setIsAdmin(false); setIsLogged(false); }} className="bg-white border-2 px-10 py-5 rounded-[30px] font-black flex items-center gap-3 shadow-lg active:scale-95 transition-all uppercase text-xs tracking-widest text-slate-900">Exit</button>
              </div>
           </div>
           
           <div className="space-y-8">
              <div className="bg-white p-12 rounded-[60px] shadow-sm border border-slate-100 flex items-center justify-between group hover:border-indigo-200 transition-all text-slate-900">
                 <div className="flex-1 text-slate-900"><label className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] block mb-3">Project Universe</label><input className="text-5xl font-black w-full outline-none text-slate-900 focus:text-indigo-600 transition-colors bg-transparent" value={game.title} onChange={e => setGame({...game, title: e.target.value})} /></div>
                 <button onClick={() => setEditingStage({ id: 'NEW', order: game.stages.length+1, title: '未命名任務', speaker: '旁白', storyContent: '請在此輸入新的故事起點...', unlockType: 'PASSWORD', unlockAnswer: '1234', hints: [''], successMessage: 'Mission Complete' })} className="bg-indigo-600 text-white p-7 rounded-[35px] shadow-2xl hover:rotate-90 transition-all active:scale-90 flex items-center justify-center"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
              </div>

              <div className="grid gap-6">
                 {game.stages.map((s, i) => (
                   <div key={s.id} className="bg-white p-10 rounded-[60px] border-2 border-transparent hover:border-indigo-100 flex items-center gap-10 transition-all group shadow-sm text-slate-900">
                      <div className="w-20 h-20 bg-slate-50 rounded-[35px] flex items-center justify-center font-black text-slate-300 text-3xl group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-all shadow-inner">{i+1}</div>
                      <div className="flex-1 text-slate-900">
                         <h4 className="text-2xl font-black text-slate-800 tracking-tight">{s.title}</h4>
                         <div className="flex gap-3 mt-3 text-slate-400">
                            <span className="bg-slate-100 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">{s.unlockType}</span>
                            <span className="bg-slate-100 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">Key: {s.unlockAnswer}</span>
                         </div>
                      </div>
                      <div className="flex gap-4">
                         <button onClick={() => setEditingStage(s)} className="p-6 bg-slate-50 text-slate-400 hover:bg-indigo-600 hover:text-white rounded-[30px] transition-all shadow-sm active:scale-90"><Edit2 size={28}/></button>
                         <button onClick={() => { if(confirm('永久移除此章節？')) setGame({...game, stages: game.stages.filter(item => item.id !== s.id)}) }} className="p-6 bg-slate-50 text-slate-400 hover:bg-red-500 hover:text-white rounded-[30px] transition-all shadow-sm active:scale-90"><Trash2 size={28}/></button>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden selection:bg-amber-500 selection:text-black">
      <div className="flex-1 overflow-y-auto">{renderPlayerContent()}</div>
      <div className="fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black via-black/95 to-transparent pointer-events-none z-[1000]"></div>
      <div className="fixed bottom-8 left-8 right-8 h-22 bg-slate-900/80 backdrop-blur-3xl rounded-[40px] border border-white/5 flex items-center justify-around px-6 z-[1001] shadow-[0_25px_60px_rgba(0,0,0,0.8)]">
         <button onClick={() => setActiveTab('story')} className={`flex flex-col items-center gap-1.5 transition-all pointer-events-auto ${activeTab === 'story' ? 'text-amber-500 scale-110' : 'text-slate-600 opacity-40'}`}>
            <BookOpen size={26} strokeWidth={activeTab === 'story' ? 3 : 2} /> <span className="text-[9px] font-black uppercase tracking-[0.2em]">Story</span>
         </button>
         <button onClick={() => setActiveTab('map')} className={`flex flex-col items-center gap-1.5 transition-all pointer-events-auto ${activeTab === 'map' ? 'text-amber-500 scale-110' : 'text-slate-600 opacity-40'}`}>
            <MapIcon size={26} strokeWidth={activeTab === 'map' ? 3 : 2} /> <span className="text-[9px] font-black uppercase tracking-[0.2em]">Radar</span>
         </button>
         <button onClick={() => setActiveTab('backpack')} className={`flex flex-col items-center gap-1.5 transition-all pointer-events-auto ${activeTab === 'backpack' ? 'text-amber-500 scale-110' : 'text-slate-600 opacity-40'}`}>
            <Briefcase size={26} strokeWidth={activeTab === 'backpack' ? 3 : 2} /> <span className="text-[9px] font-black uppercase tracking-[0.2em]">Items</span>
         </button>
         <button onClick={() => setActiveTab('admin')} className={`flex flex-col items-center gap-1.5 transition-all pointer-events-auto ${activeTab === 'admin' ? 'text-amber-500 scale-110' : 'text-slate-600 opacity-40'}`}>
            <Settings size={26} strokeWidth={activeTab === 'admin' ? 3 : 2} /> <span className="text-[9px] font-black uppercase tracking-[0.2em]">Engine</span>
         </button>
      </div>
      {isScanning && (
        <div className="fixed inset-0 bg-black z-[2000] flex flex-col items-center justify-center p-10 animate-in zoom-in duration-300">
           <div className="w-full max-w-sm aspect-square bg-slate-900 rounded-[60px] overflow-hidden border-4 border-amber-500 shadow-[0_0_60px_rgba(245,158,11,0.4)] mb-14">
              <div id="reader" className="w-full h-full scale-110"></div>
           </div>
           <button onClick={() => setIsScanning(false)} className="bg-white/10 hover:bg-white/20 text-white px-14 py-6 rounded-[30px] font-black uppercase tracking-[0.3em] transition-all">Abort Scanner</button>
        </div>
      )}
    </div>
  );
}

function LocationPickerHelper({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e: L.LeafletMouseEvent) { onPick(e.latlng.lat, e.latlng.lng); } });
  return null;
}
