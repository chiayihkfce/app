import { useState, useEffect } from 'react';
import { BookOpen, Map as MapIcon, Briefcase, Settings, ChevronRight, CheckCircle2, Trash2, Edit2, ArrowLeft, X, QrCode, Save, RefreshCw, MessageCircle } from 'lucide-react';
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

const VERSION = "3.5.7";
const DEFAULT_GAME: Game = {
  title: '新專案：新港解謎',
  stages: [{
    id: 's1', order: 1, title: '起點', speaker: '系統', storyContent: '歡迎使用。請在後台修改內容。', unlockType: 'PASSWORD', unlockAnswer: '1234', hints: ['初始密碼 1234'], successMessage: '完成初始化！'
  }]
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
    if (savedV !== VERSION) { localStorage.setItem('enigma_version', VERSION); if (savedV) window.location.reload(); }
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "games", "shinkang_v3"), (snapshot) => {
      if (snapshot.exists()) setGame(snapshot.data() as Game);
      else setDoc(doc(db, "games", "shinkang_v3"), DEFAULT_GAME);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsubscribe();
  }, []);

  const currentStage = game.stages[currentStageIdx] || game.stages[0] || null;

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

  if (loading) return <div className="h-screen bg-black flex items-center justify-center text-amber-500 font-black animate-pulse uppercase tracking-[0.5em]">Syncing...</div>;

  const renderPlayerContent = () => {
    if (!currentStage) return <div className="p-10 text-white text-center">Loading Data...</div>;

    switch (activeTab) {
      case 'story':
        return (
          <div className="flex flex-col h-full bg-black">
            <div className="relative h-[45vh] w-full">
               <img src={currentStage.imageUrl || 'https://images.unsplash.com/photo-1501503060445-73887c28bf13?q=80&w=800'} className="w-full h-full object-cover" alt="Scene" onError={(e) => e.currentTarget.src="https://via.placeholder.com/800x600?text=Wait..."} />
               <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent" />
               <div className="absolute bottom-6 left-6"><h2 className="text-3xl font-black text-white">{currentStage.title}</h2></div>
            </div>
            <div className="flex-1 bg-black px-6 pt-4 pb-32 flex flex-col">
               <div className="flex items-center gap-3 mb-4 text-amber-500 font-black tracking-widest"><MessageCircle size={20} />{currentStage.speaker}</div>
               <div className="bg-slate-900/50 border-l-4 border-amber-500 p-6 rounded-r-3xl italic text-slate-200 leading-loose">「{currentStage.storyContent}」</div>
               {!solved ? (
                 <div className="mt-8 space-y-4">
                    {currentStage.unlockType === 'PASSWORD' ? (
                      <div className="relative"><input type="text" value={userInput} onChange={e => setUserInput(e.target.value)} placeholder="在此解密..." className="w-full bg-slate-900 border-2 border-slate-800 rounded-2xl py-5 px-8 outline-none focus:border-amber-500" /><button onClick={() => { if(userInput.trim().toLowerCase() === currentStage.unlockAnswer.toLowerCase()) setSolved(true); else alert('錯誤'); }} className="absolute right-3 top-3 bottom-3 bg-amber-500 text-black px-6 rounded-xl font-black">OK</button></div>
                    ) : currentStage.unlockType === 'GPS' ? (
                      <button onClick={() => navigator.geolocation.getCurrentPosition(pos => {
                        const d = L.latLng(pos.coords.latitude, pos.coords.longitude).distanceTo(L.latLng(currentStage.lat!, currentStage.lng!));
                        if(d < 100) setSolved(true); else alert(`還差 ${Math.round(d)} 公尺`);
                      })} className="w-full bg-amber-500 text-black py-5 rounded-2xl font-black flex items-center justify-center gap-2">抵達定位驗證</button>
                    ) : (<button onClick={() => setIsScanning(true)} className="w-full bg-amber-500 text-black py-5 rounded-2xl font-black flex items-center justify-center gap-2"><QrCode size={20}/> 掃描二維碼</button>)}
                    <button onClick={() => setShowHint(!showHint)} className="w-full py-2 text-slate-600 font-black uppercase text-[10px] tracking-widest text-center">Need Support?</button>
                    {showHint && <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl text-amber-200 text-xs italic">{currentStage.hints[0]}</div>}
                 </div>
               ) : (
                 <div className="mt-8 bg-green-500/10 border border-green-500/30 p-8 rounded-[40px] text-center shadow-2xl">
                    <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4" />
                    <p className="text-green-400 font-black mb-6">{currentStage.successMessage}</p>
                    <button onClick={() => { if(currentStage.itemReward) setInventory([...inventory, currentStage.itemReward]); setSolved(false); setCurrentStageIdx(prev => (prev+1)%game.stages.length); setUserInput(''); setShowHint(false); }} className="w-full bg-green-500 py-5 rounded-3xl text-black font-black flex items-center justify-center gap-2 shadow-xl">NEXT MISSION <ChevronRight size={24}/></button>
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
                    <Popup className="custom-popup"><div className="p-3 text-center text-slate-900"><h4 className="font-black mb-1">{s.title}</h4><button onClick={() => { setCurrentStageIdx(idx); setActiveTab('story'); }} className="w-full bg-slate-900 text-amber-500 py-2 rounded-xl text-[10px] font-black">進入關卡</button></div></Popup>
                  </Marker>
              )))}
            </MapContainer>
          </div>
        );
      case 'backpack':
        return (
          <div className="h-full bg-black p-10 pt-20">
             <h2 className="text-4xl font-black mb-12 flex items-center gap-4"><Briefcase className="text-amber-500" size={40}/> 道具包</h2>
             {inventory.length === 0 ? (<div className="mt-20 flex flex-col items-center opacity-20 text-white"><Briefcase size={64} className="mb-4"/><p className="font-black uppercase tracking-widest text-xs">空無一物</p></div>) : (
               <div className="grid grid-cols-2 gap-6">{inventory.map((item, i) => (<div key={i} className="bg-slate-900 border border-slate-800 p-8 rounded-[40px] flex flex-col items-center gap-4 text-white text-sm font-black text-center"><BookOpen size={32} className="text-amber-500"/>{item}</div>))}</div>
             )}
          </div>
        );
      case 'admin':
        return (
          <div className="h-full bg-slate-950 flex flex-col items-center justify-center p-10 text-center">
             <Settings size={48} className="text-slate-700 mb-8" />
             <h2 className="text-2xl font-black mb-10 text-white uppercase tracking-widest">Engine Control</h2>
             <button onClick={() => setIsAdmin(true)} className="bg-white text-black px-12 py-5 rounded-3xl font-black shadow-2xl active:scale-95 transition-all">進入系統</button>
          </div>
        );
    }
  };

  if (isAdmin) {
    if (!isLogged) return (
      <div className="h-screen bg-black flex items-center justify-center p-8">
        <div className="bg-slate-900 p-12 rounded-[50px] shadow-2xl w-full max-w-sm text-center border border-white/5 space-y-8">
           <h1 className="text-2xl font-black tracking-widest text-white">ACCESS CODE</h1>
           <input type="password" value={adminPass} onChange={e => setAdminPass(e.target.value)} placeholder="8888" className="w-full bg-black border-2 border-slate-800 rounded-2xl py-5 px-6 outline-none focus:border-amber-500 text-center font-mono text-2xl text-amber-500" />
           <button onClick={() => { if(adminPass === '8888') setIsLogged(true); else alert('Denied'); }} className="w-full bg-amber-500 text-black py-5 rounded-3xl font-black">LOGIN</button>
           <button onClick={() => setIsAdmin(false)} className="text-slate-600 font-bold uppercase text-[10px] tracking-widest">Return</button>
        </div>
      </div>
    );

    return (
      <div className="min-h-screen bg-slate-50 p-8 text-slate-900 pb-32">
        {editingStage && (
          <div className="fixed inset-0 bg-black/95 z-[2000] flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-xl rounded-[50px] p-10 space-y-6 shadow-2xl text-slate-900 text-center">
               <div className="flex justify-between items-center"><h3 className="text-2xl font-black italic">EDITOR</h3><button onClick={() => setEditingStage(null)}><X/></button></div>
               <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4"><input className="w-full border-b-2 py-3 outline-none font-bold" placeholder="標題" value={editingStage.title} onChange={e => setEditingStage({...editingStage, title: e.target.value})} /><input className="w-full border-b-2 py-3 outline-none font-bold" placeholder="說話者" value={editingStage.speaker} onChange={e => setEditingStage({...editingStage, speaker: e.target.value})} /></div>
                  <textarea className="w-full bg-slate-100 rounded-2xl p-4 h-32 outline-none" placeholder="故事內容" value={editingStage.storyContent} onChange={e => setEditingStage({...editingStage, storyContent: e.target.value})} />
                  <input className="w-full border-b-2 py-3 outline-none" placeholder="圖片連結" value={editingStage.imageUrl} onChange={e => setEditingStage({...editingStage, imageUrl: e.target.value})} />
                  <div className="grid grid-cols-2 gap-4 text-left">
                     <select className="border-b-2 py-3 bg-white" value={editingStage.unlockType} onChange={e => setEditingStage({...editingStage, unlockType: e.target.value as any})}><option value="PASSWORD">密碼</option><option value="GPS">GPS</option><option value="QR_CODE">QR</option></select>
                     <input className="border-b-2 py-3 outline-none font-mono" placeholder="正確答案" value={editingStage.unlockAnswer} onChange={e => setEditingStage({...editingStage, unlockAnswer: e.target.value})} />
                  </div>
                  {editingStage.unlockType === 'GPS' && (
                    <div className="h-48 rounded-2xl overflow-hidden border-2"><MapContainer center={[editingStage.lat || 23.55, editingStage.lng || 120.35]} zoom={15} style={{ height: '100%' }}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><Marker position={[editingStage.lat || 23.55, editingStage.lng || 120.35]} /><LocationPickerHelper onPick={(lat, lng) => setEditingStage({...editingStage, lat, lng})} /></MapContainer></div>
                  )}
                  <input className="w-full border-b-2 py-3 outline-none" placeholder="過關道具" value={editingStage.itemReward} onChange={e => setEditingStage({...editingStage, itemReward: e.target.value})} />
               </div>
               <button onClick={() => {
                  const newStages = editingStage.id === 'NEW' ? [...game.stages, {...editingStage, id: Date.now().toString()}] : game.stages.map(s => s.id === editingStage.id ? editingStage : s);
                  setGame({...game, stages: newStages}); setEditingStage(null);
               }} className="w-full bg-slate-900 text-white py-5 rounded-[24px] font-black">更新檔案</button>
            </div>
          </div>
        )}

        <div className="max-w-3xl mx-auto">
           <div className="flex justify-between items-center mb-16 text-slate-900">
              <h1 className="text-4xl font-black italic">ENIGMA CORE</h1>
              <div className="flex gap-3">
                 <button onClick={async () => { await setDoc(doc(db, "games", "shinkang_v3"), game); alert("雲端發布成功！"); }} className="bg-green-600 text-white px-8 py-4 rounded-3xl font-black flex items-center gap-2 shadow-xl active:scale-95 transition-all"><Save size={20}/> 雲端發布</button>
                 <button onClick={() => { setIsAdmin(false); setIsLogged(false); }} className="bg-white border px-8 py-4 rounded-3xl font-bold flex items-center gap-2 active:scale-95 transition-all"><ArrowLeft size={20}/> 返回</button>
              </div>
           </div>
           <div className="bg-white p-10 rounded-[50px] shadow-sm border mb-10 text-slate-900">
              <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest block mb-2">Project Name</label>
              <input className="text-4xl font-black w-full outline-none text-slate-900 focus:text-indigo-600" value={game.title} onChange={e => setGame({...game, title: e.target.value})} />
           </div>
           <div className="space-y-4">
              <div className="flex justify-between items-center px-4 mb-4 text-slate-900 font-black"><h3 className="uppercase text-xs tracking-[0.2em]">Mission Flow</h3><button onClick={() => setEditingStage({ id: 'NEW', order: game.stages.length+1, title: '新關卡', speaker: '旁白', storyContent: '...', unlockType: 'PASSWORD', unlockAnswer: '1234', hints: [''], successMessage: 'Mission Clear' })} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> New Stage</button></div>
              {game.stages.map((s, i) => (
                <div key={s.id} className="bg-white p-8 rounded-[40px] border-2 border-transparent hover:border-indigo-100 flex items-center gap-8 transition-all group shadow-sm text-slate-900">
                   <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center font-black text-slate-300 text-2xl group-hover:text-indigo-600">{i+1}</div>
                   <div className="flex-1">
                      <h4 className="text-xl font-black">{s.title}</h4>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{s.unlockType} · {s.unlockAnswer}</p>
                   </div>
                   <div className="flex gap-2">
                      <button onClick={() => setEditingStage(s)} className="p-5 bg-slate-50 text-slate-400 hover:bg-indigo-600 hover:text-white rounded-3xl transition-all shadow-sm"><Edit2 size={24}/></button>
                      <button onClick={() => { if(confirm('刪除？')) setGame({...game, stages: game.stages.filter(item => item.id !== s.id)}) }} className="p-5 bg-slate-50 text-slate-400 hover:bg-red-500 hover:text-white rounded-3xl transition-all shadow-sm"><Trash2 size={24}/></button>
                   </div>
                </div>
              ))}
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden">
      <div className="flex-1 overflow-y-auto">{renderPlayerContent()}</div>
      <div className="fixed bottom-6 left-6 right-6 h-20 bg-slate-900/80 backdrop-blur-3xl rounded-[32px] border border-white/5 flex items-center justify-around px-4 z-[1001] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
         <button onClick={() => setActiveTab('story')} className={`flex flex-col items-center gap-1 ${activeTab === 'story' ? 'text-amber-500' : 'text-slate-600 opacity-50'}`}><BookOpen size={22} /><span className="text-[9px] font-black uppercase tracking-widest">Story</span></button>
         <button onClick={() => setActiveTab('map')} className={`flex flex-col items-center gap-1 ${activeTab === 'map' ? 'text-amber-500' : 'text-slate-600 opacity-50'}`}><MapIcon size={22} /><span className="text-[9px] font-black uppercase tracking-widest">Radar</span></button>
         <button onClick={() => setActiveTab('backpack')} className={`flex flex-col items-center gap-1 ${activeTab === 'backpack' ? 'text-amber-500' : 'text-slate-600 opacity-50'}`}><Briefcase size={22} /><span className="text-[9px] font-black uppercase tracking-widest">Items</span></button>
         <button onClick={() => setActiveTab('admin')} className={`flex flex-col items-center gap-1 ${activeTab === 'admin' ? 'text-amber-500' : 'text-slate-600 opacity-50'}`}><Settings size={22} /><span className="text-[9px] font-black uppercase tracking-widest">Engine</span></button>
      </div>
      {isScanning && (
        <div className="fixed inset-0 bg-black z-[2000] flex flex-col items-center justify-center p-8"><div className="w-full max-w-sm aspect-square bg-slate-900 rounded-[50px] overflow-hidden border-4 border-amber-500 shadow-2xl mb-10"><div id="reader" className="w-full h-full scale-110"></div></div><button onClick={() => setIsScanning(false)} className="bg-white/10 text-white px-12 py-5 rounded-3xl font-black uppercase tracking-[0.2em]">Abort</button></div>
      )}
    </div>
  );
}

function LocationPickerHelper({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e: L.LeafletMouseEvent) { onPick(e.latlng.lat, e.latlng.lng); } });
  return null;
}
