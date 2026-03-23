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

const VERSION = "4.2.0";
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

  // 初始化與資料監聽
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "games", "shinkang_v4"), (snapshot) => {
      if (snapshot.exists()) setGame(snapshot.data() as Game);
      else setDoc(doc(db, "games", "shinkang_v4"), DEFAULT_GAME);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsubscribe();
  }, []);

  // 圖片上傳修復與強化
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingStage) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `missions/${editingStage.id}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      // 更新編輯中的狀態
      const updatedStage = { ...editingStage, imageUrl: url };
      setEditingStage(updatedStage);
      
      // 同時更新主遊戲狀態，確保上傳完能即時看到
      const updatedStages = game.stages.map(s => s.id === editingStage.id ? updatedStage : s);
      setGame({ ...game, stages: updatedStages });
      
      alert("圖片上傳成功！別忘了最後點擊「儲存變更」並在主畫面「同步更新」。");
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

      {/* --- 浮動按鈕 --- */}
      <div className="absolute top-6 left-6 right-6 z-10 flex justify-between items-center pointer-events-none">
         <div className="bg-white px-4 py-2 rounded-xl shadow-md text-pwGray5 font-bold border border-pwGray2 pointer-events-auto flex items-center gap-2">
            <MapPin size={16} className="text-pwBlue"/> {game.title}
         </div>
         <div className="flex gap-2 pointer-events-auto">
            <button onClick={() => setPanelMode('backpack')} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-pwGray5 shadow-md border border-pwGray2"><Briefcase size={18}/></button>
            <button onClick={() => setPanelMode('admin')} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-pwGray5 shadow-md border border-pwGray2"><Settings size={18}/></button>
         </div>
      </div>

      <AnimatePresence>
        {panelMode !== 'closed' && !isAdmin && (
          <motion.div initial={{ y: "100%" }} animate={{ y: "0%" }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 250 }} className="absolute bottom-0 left-0 right-0 z-[100] h-[92vh] bg-white rounded-t-[24px] shadow-[0_-15px_50px_rgba(0,0,0,0.1)] border-t border-pwGray2 flex flex-col overflow-hidden">
            {/* --- 頂部裝飾條 --- */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-pwGray1">
               <ArrowLeft size={24} className="text-pwGray3" onClick={() => setPanelMode('closed')}/>
               <div className="w-10 h-1.5 bg-pwGray2 rounded-full" onClick={() => setPanelMode('closed')}/>
               <MoreHorizontal size={24} className="text-pwGray3" />
            </div>

            <div className="flex-1 overflow-y-auto">
               {panelMode === 'story' && (
                 <div className="pb-20">
                    {/* --- 1:1 復刻截圖頂部區塊 --- */}
                    <div className="relative">
                       <div className="h-48 w-full bg-pwGray2 flex items-center justify-center">
                          {/* 這裡是截圖中的灰色漸層或底色 */}
                       </div>
                       {/* 懸浮 Icon */}
                       <div className="absolute left-1/2 -bottom-12 -translate-x-1/2">
                          <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center shadow-xl border-4 border-white overflow-hidden">
                             {/* 仿照截圖的拼圖黃色 Icon */}
                             <div className="w-full h-full bg-pwGray1 flex items-center justify-center p-4">
                                <svg viewBox="0 0 24 24" className="w-full h-full text-pwYellow" fill="currentColor">
                                   <path d="M20,12V10a2,2,0,0,0-2-2H18V6a2,2,0,0,0-2-2H14V4a2,2,0,0,0-4,0V4H8A2,2,0,0,0,6,6V8H6a2,2,0,0,0-2,2v2a2,2,0,0,1,0,4v2a2,2,0,0,0,2,2H8v2a2,2,0,0,0,2,2h2a2,2,0,0,0,2-2V20h2a2,2,0,0,0,2-2V18h2a2,2,0,0,0,2-2V14A2,2,0,0,1,20,12Z" />
                                </svg>
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="px-8 mt-16 space-y-6">
                       {/* 遊戲標題 */}
                       <div className="space-y-2">
                          <h2 className="text-2xl font-bold text-pwGray7">{game.title}</h2>
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 bg-pwGray2 rounded-full" />
                             <div className="h-4 w-32 bg-pwGray2 rounded" />
                          </div>
                          {/* 五星評分 */}
                          <div className="flex items-center gap-1 text-pwBlue">
                             <Star size={18} fill="currentColor" />
                             <Star size={18} fill="currentColor" />
                             <Star size={18} fill="currentColor" />
                             <Star size={18} fill="currentColor" />
                             <Star size={18} fill="currentColor" />
                          </div>
                       </div>

                       {/* 標籤列 */}
                       <div className="flex gap-2">
                          <div className="flex-1 h-10 bg-pwGray2 rounded-lg" />
                       </div>
                       <div className="grid grid-cols-3 gap-3">
                          <div className="h-10 bg-pwGray2 rounded-2xl" />
                          <div className="h-10 bg-pwGray2 rounded-2xl" />
                          <div className="h-10 bg-pwGray2 rounded-2xl" />
                       </div>

                       {/* 大藍色按鈕 (截圖樣式) */}
                       <button className="w-full bg-pwBlue text-white py-4 rounded-[30px] font-bold shadow-lg shadow-pwBlue/20 text-lg active:scale-[0.98] transition-all">
                          開始任務
                       </button>

                       <hr className="border-pwGray1" />

                       {/* 關於區塊 */}
                       <div className="space-y-4">
                          <h3 className="text-xl font-bold text-pwGray7">關於</h3>
                          <div className="space-y-4">
                             <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-pwBlue flex items-center justify-center text-white"><MapPin size={20}/></div>
                                <span className="text-pwGray4 font-bold">遊戲難度</span>
                                <div className="flex gap-1 ml-auto">
                                   <span className="w-5 h-5 bg-pwRed rounded-full" />
                                   <span className="w-5 h-5 bg-pwRed rounded-full" />
                                   <span className="w-5 h-5 bg-pwRed rounded-full" />
                                   <span className="w-5 h-5 bg-pwGray2 rounded-full" />
                                   <span className="w-5 h-5 bg-pwGray2 rounded-full" />
                                </div>
                                <span className="text-pwGray3 ml-2">( 普通 )</span>
                             </div>
                             <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-pwBlue flex items-center justify-center text-white"><Clock size={20}/></div>
                                <span className="text-pwGray4 font-bold">遊戲時間： 1小時</span>
                             </div>
                             <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-pwBlue flex items-center justify-center text-white"><MapIcon size={20}/></div>
                                <span className="text-pwGray4 font-bold">地圖導覽</span>
                             </div>
                          </div>
                       </div>

                       <hr className="border-pwGray1" />

                       {/* 介紹區塊 */}
                       <div className="space-y-3">
                          <h3 className="text-xl font-bold text-pwGray7">介紹</h3>
                          <div className="text-pwGray4 leading-relaxed font-medium">
                             <TypewriterText text={currentStage.storyContent} />
                          </div>
                       </div>

                       {/* 任務具體內容 (原本的解謎) */}
                       <div className="bg-pwGray1 p-6 rounded-[24px] border border-pwGray2 space-y-6">
                          <div className="relative aspect-video rounded-2xl overflow-hidden shadow-sm">
                             <img 
                                src={currentStage.imageUrl || heroImage} 
                                className="w-full h-full object-cover" 
                                alt="Mission" 
                                onError={(e) => { const t = e.target as HTMLImageElement; if (t.src !== heroImage) t.src = heroImage; }}
                             />
                          </div>
                          
                          {!solved ? (
                            <div className="space-y-4">
                               {currentStage.unlockType === 'PASSWORD' ? (
                                 <div className="flex flex-col gap-3">
                                   <input type="text" value={userInput} onChange={e => setUserInput(e.target.value)} placeholder="請輸入密碼解鎖..." className="w-full bg-white border border-pwGray2 rounded-2xl py-4 px-6 outline-none focus:border-pwBlue font-bold text-center" />
                                   <button onClick={() => { if(userInput.trim().toLowerCase() === currentStage.unlockAnswer.toLowerCase()) setSolved(true); else alert('無效的答案'); }} className="w-full bg-pwGray7 text-white py-4 rounded-2xl font-bold">驗證答案</button>
                                 </div>
                               ) : currentStage.unlockType === 'GPS' ? (
                                 <button onClick={() => navigator.geolocation.getCurrentPosition(pos => {
                                   const d = L.latLng(pos.coords.latitude, pos.coords.longitude).distanceTo(L.latLng(currentStage.lat!, currentStage.lng!));
                                   if(d < 100) setSolved(true); else alert(`還差約 ${Math.round(d)} 公尺`);
                                 })} className="w-full bg-pwGray7 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2"><MapPin size={20}/> 我已抵達指定地點</button>
                               ) : (
                                 <button onClick={() => setIsScanning(true)} className="w-full bg-pwGray7 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2"><QrCode size={20}/> 開啟 QR 掃描</button>
                               )}
                               <button onClick={() => setShowHint(!showHint)} className="w-full py-2 text-pwGray3 font-bold text-xs uppercase tracking-widest text-center">請求支援資料 (提示)</button>
                               {showHint && <div className="bg-pwBlue/10 border border-pwBlue/20 p-4 rounded-xl text-pwBlue text-sm italic">{currentStage.hints[0]}</div>}
                            </div>
                          ) : (
                            <div className="bg-pwGreen/10 border border-pwGreen/20 p-6 rounded-[24px] text-center space-y-4">
                               <div className="w-14 h-14 bg-pwGreen rounded-full flex items-center justify-center text-white mx-auto shadow-lg"><CheckCircle2 size={28} /></div>
                               <p className="text-pwGreen font-bold text-lg">任務達成！</p>
                               <button onClick={() => { if(currentStage.itemReward) setInventory([...inventory, currentStage.itemReward]); setSolved(false); setCurrentStageIdx(prev => (prev+1)%game.stages.length); setUserInput(''); setShowHint(false); }} className="w-full bg-pwGreen text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-[0.98]">前往下一站 <ChevronRight size={20}/></button>
                            </div>
                          )}
                       </div>

                       {/* 底部更多內容 */}
                       <button className="w-full py-10 text-pwBlue font-bold text-center">
                          更多內容
                       </button>
                    </div>
                 </div>
               )}

               {panelMode === 'backpack' && (
                 <div className="p-8 space-y-8">
                    <h2 className="text-3xl font-bold text-pwGray7 flex items-center gap-3"><Briefcase className="text-pwBlue" size={32}/> 我的背包</h2>
                    {inventory.length === 0 ? (
                      <div className="py-20 flex flex-col items-center text-pwGray3">
                         <Briefcase size={64} className="mb-4 opacity-20"/>
                         <p className="font-bold text-sm tracking-widest">目前沒有收集到任何物品</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        {inventory.map((item, i) => (
                          <div key={i} className="bg-white border border-pwGray2 p-6 rounded-[24px] flex flex-col items-center gap-4 text-center shadow-sm">
                            <div className="w-14 h-14 bg-pwBlue/10 rounded-2xl flex items-center justify-center text-pwBlue"><BookOpen size={24}/></div>
                            <span className="font-bold text-pwGray5 text-sm">{item}</span>
                          </div>
                        ))}
                      </div>
                    )}
                 </div>
               )}

               {panelMode === 'admin' && (
                 <div className="flex flex-col items-center justify-center h-full p-8 space-y-10">
                    <div className="w-24 h-24 bg-pwGray1 rounded-[40px] flex items-center justify-center text-pwGray3 border border-pwGray2 shadow-inner"><Settings size={40} /></div>
                    <div className="text-center space-y-3">
                       <h2 className="text-3xl font-bold text-pwGray7">管理員權限</h2>
                       <p className="text-pwGray3 text-sm max-w-xs mx-auto leading-relaxed">僅限開發者與管理員進入，請輸入存取密碼以進行遊戲內容修改。</p>
                    </div>
                    <button onClick={() => setIsAdmin(true)} className="w-full bg-pwGray7 text-white py-5 rounded-[24px] font-bold shadow-xl active:scale-95 transition-all text-lg">身分驗證</button>
                 </div>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- 管理員編輯介面 --- */}
      {isAdmin && (
        <div className="absolute inset-0 z-[1000] bg-white overflow-y-auto text-pwGray7 pb-20 font-sans">
           {!isLogged ? (
             <div className="h-screen bg-pwGray1 flex items-center justify-center p-8">
               <div className="bg-white p-10 rounded-[40px] shadow-2xl w-full max-w-sm border border-pwGray2 space-y-8 text-center">
                 <h1 className="text-2xl font-black">ADMIN ACCESS</h1>
                 <input type="password" value={adminPass} onChange={e => setAdminPass(e.target.value)} placeholder="••••" className="w-full bg-pwGray1 border border-pwGray2 rounded-2xl py-5 px-6 outline-none focus:ring-2 focus:ring-pwBlue text-center font-mono text-3xl tracking-widest" />
                 <button onClick={() => { if(adminPass === '8888') setIsLogged(true); else alert('密碼錯誤'); }} className="w-full bg-pwGray7 text-white py-5 rounded-2xl font-bold shadow-lg">進入核心系統</button>
                 <button onClick={() => setIsAdmin(false)} className="text-pwGray3 font-bold text-xs uppercase tracking-[0.3em]">退出登入</button>
               </div>
             </div>
           ) : (
             <div className="max-w-4xl mx-auto p-8">
                {editingStage && (
                  <div className="fixed inset-0 bg-pwGray7/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white w-full max-w-xl rounded-[40px] p-10 space-y-6 shadow-2xl">
                       <div className="flex justify-between items-center"><h3 className="text-2xl font-bold tracking-tight">編輯任務內容</h3><button onClick={() => setEditingStage(null)} className="p-2 hover:bg-pwGray1 rounded-full"><X/></button></div>
                       <div className="space-y-5">
                          <div className="space-y-2">
                             <label className="text-[10px] font-bold text-pwGray3 uppercase tracking-widest ml-2">任務背景照片</label>
                             <div onClick={() => fileInputRef.current?.click()} className="h-48 w-full rounded-[24px] border-2 border-dashed border-pwGray2 flex flex-col items-center justify-center cursor-pointer hover:bg-pwGray1 transition-all overflow-hidden relative group">
                                {editingStage.imageUrl ? (
                                  <>
                                    <img src={editingStage.imageUrl} className="w-full h-full object-cover" alt="Preview" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                       <p className="text-white font-bold">更換圖片</p>
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-center text-pwGray3">
                                    {uploading ? <Loader2 className="animate-spin mx-auto mb-2" /> : <ImageIcon size={40} className="mx-auto mb-2"/>}
                                    <p className="font-bold">點擊選擇圖片或拍照</p>
                                  </div>
                                )}
                                {uploading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center font-bold text-pwBlue animate-pulse">正在上傳並儲存...</div>}
                             </div>
                             <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1"><label className="text-[10px] font-bold text-pwGray3 ml-2">任務標題</label><input className="w-full bg-pwGray1 rounded-xl py-4 px-5 outline-none font-bold" value={editingStage.title} onChange={e => setEditingStage({...editingStage, title: e.target.value})} /></div>
                            <div className="space-y-1"><label className="text-[10px] font-bold text-pwGray3 ml-2">角色名稱</label><input className="w-full bg-pwGray1 rounded-xl py-4 px-5 outline-none font-bold" value={editingStage.speaker} onChange={e => setEditingStage({...editingStage, speaker: e.target.value})} /></div>
                          </div>
                          <div className="space-y-1"><label className="text-[10px] font-bold text-pwGray3 ml-2">劇情內容</label><textarea className="w-full bg-pwGray1 rounded-xl p-5 h-32 outline-none font-medium leading-relaxed" value={editingStage.storyContent} onChange={e => setEditingStage({...editingStage, storyContent: e.target.value})} /></div>
                          <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-1"><label className="text-[10px] font-bold text-pwGray3 ml-2">解鎖類型</label><select className="w-full bg-pwGray1 rounded-xl py-4 px-5 outline-none font-bold appearance-none" value={editingStage.unlockType} onChange={e => setEditingStage({...editingStage, unlockType: e.target.value as any})}><option value="PASSWORD">密碼</option><option value="GPS">GPS</option><option value="QR_CODE">QR碼</option></select></div>
                             <div className="space-y-1"><label className="text-[10px] font-bold text-pwGray3 ml-2">正確答案</label><input className="w-full bg-pwGray1 rounded-xl py-4 px-5 outline-none font-bold" value={editingStage.unlockAnswer} onChange={e => setEditingStage({...editingStage, unlockAnswer: e.target.value})} /></div>
                          </div>
                          <div className="h-48 rounded-[24px] overflow-hidden border border-pwGray2 shadow-inner">
                            <MapContainer center={[editingStage.lat || 23.55, editingStage.lng || 120.35]} zoom={15} style={{ height: '100%', width: '100%' }}>
                              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                              {editingStage.lat !== undefined && editingStage.lng !== undefined && <Marker position={[editingStage.lat, editingStage.lng]} />}
                              <MapPickerEvents onPick={(lat, lng) => setEditingStage({...editingStage, lat, lng})} />
                            </MapContainer>
                          </div>
                          <button onClick={() => {
                            const newStages = editingStage.id === 'NEW' ? [...game.stages, {...editingStage, id: Date.now().toString()}] : game.stages.map(s => s.id === editingStage.id ? editingStage : s);
                            setGame({...game, stages: newStages}); setEditingStage(null);
                          }} className="w-full bg-pwBlue text-white py-5 rounded-2xl font-bold shadow-xl shadow-pwBlue/20">儲存任務設定</button>
                       </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-end mb-12">
                   <div className="space-y-2"><h1 className="text-4xl font-extrabold tracking-tight text-pwGray7">核心工作台</h1><p className="text-pwGray3 font-bold">遊戲版本：{VERSION}</p></div>
                   <div className="flex gap-3">
                      <button onClick={async () => { await setDoc(doc(db, "games", "shinkang_v4"), game); alert("雲端同步成功！目前所有玩家都將看到更新。"); }} className="bg-pwGreen text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-pwGreen/20"><Save size={20}/> 雲端推送</button>
                      <button onClick={() => { setIsAdmin(false); setIsLogged(false); setAdminPass(''); }} className="bg-white border border-pwGray2 px-8 py-4 rounded-2xl font-bold text-pwGray3">退出控制台</button>
                   </div>
                </div>

                <div className="space-y-8">
                   <div className="bg-white p-10 rounded-[40px] shadow-sm border border-pwGray2 flex items-center justify-between group">
                      <div className="flex-1">
                         <label className="text-[10px] font-bold text-pwGray3 uppercase tracking-[0.4em] block mb-2">專案顯示名稱</label>
                         <input className="text-3xl font-black w-full outline-none text-pwGray6 focus:text-pwBlue transition-colors" value={game.title} onChange={e => setGame({...game, title: e.target.value})} />
                      </div>
                      <button onClick={() => setEditingStage({ id: 'NEW', order: game.stages.length+1, title: '新任務', speaker: '角色名稱', storyContent: '請在此輸入您的故事劇情與內容...', unlockType: 'PASSWORD', unlockAnswer: '1234', hints: ['這裡是提示內容'], successMessage: '任務達成訊息' })} className="bg-pwGray7 text-white w-16 h-16 rounded-[24px] shadow-2xl flex items-center justify-center hover:rotate-90 transition-all duration-500"><PlusIcon size={32}/></button>
                   </div>

                   <div className="grid gap-5">
                      {game.stages.map((s, i) => (
                        <div key={s.id} className="bg-white p-8 rounded-[32px] border border-pwGray2 flex items-center gap-8 hover:shadow-xl hover:border-pwBlue/20 transition-all group">
                           <div className="w-16 h-16 bg-pwGray1 rounded-[20px] flex items-center justify-center font-black text-pwGray3 text-2xl group-hover:bg-pwBlue/10 group-hover:text-pwBlue transition-all shadow-inner">{i+1}</div>
                           <div className="flex-1"><h4 className="text-xl font-bold text-pwGray6 mb-1">{s.title}</h4><div className="flex gap-3 text-[10px] font-bold text-pwGray3 uppercase tracking-widest"><span>類型：{s.unlockType}</span><span>Key：{s.unlockAnswer}</span></div></div>
                           <div className="flex gap-3"><button onClick={() => setEditingStage(s)} className="p-4 bg-pwGray1 text-pwGray3 hover:bg-pwBlue hover:text-white rounded-[20px] transition-all active:scale-90"><Edit2 size={24}/></button><button onClick={() => { if(confirm('確定要永久刪除此任務嗎？')) setGame({...game, stages: game.stages.filter(item => item.id !== s.id)}) }} className="p-4 bg-pwGray1 text-pwGray3 hover:bg-pwRed hover:text-white rounded-[20px] transition-all active:scale-90"><Trash2 size={24}/></button></div>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
           )}
        </div>
      )}

      {/* --- QR 掃描器 --- */}
      {isScanning && (
        <div className="absolute inset-0 bg-white z-[2000] flex flex-col items-center justify-center p-10">
           <div className="w-full max-w-sm aspect-square bg-pwGray1 rounded-[40px] overflow-hidden border-4 border-pwBlue shadow-2xl mb-12"><div id="reader" className="w-full h-full scale-110"></div></div>
           <button onClick={() => setIsScanning(false)} className="bg-pwGray2 text-pwGray5 px-12 py-5 rounded-[24px] font-bold text-lg">放棄掃描</button>
        </div>
      )}

      {/* --- 開啟按鈕 (關閉狀態) --- */}
      {panelMode === 'closed' && !isAdmin && (
        <div className="absolute bottom-12 left-0 right-0 z-10 flex justify-center animate-bounce"><button onClick={() => setPanelMode('story')} className="bg-pwBlue text-white px-10 py-5 rounded-full font-bold flex items-center gap-3 shadow-[0_10px_30px_rgba(44,166,224,0.3)]">開啟遊戲介面 <ChevronUp size={24} /></button></div>
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
