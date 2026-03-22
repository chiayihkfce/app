import { useState, useEffect } from 'react';
import { ChevronRight, MapPin, HelpCircle, CheckCircle2, Settings, Plus, Trash2, Edit2, ArrowLeft, X, Navigation, QrCode } from 'lucide-react';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Html5QrcodeScanner } from "html5-qrcode";

// 修正 Leaflet 預設圖示問題
import 'leaflet/dist/leaflet.css';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// --- 類型定義 ---
export type UnlockType = 'PASSWORD' | 'GPS' | 'QR_CODE';

export interface Stage {
  id: string;
  order: number;
  title: string;
  storyContent: string;
  imageUrl?: string;
  unlockType: UnlockType;
  unlockAnswer: string;
  lat?: number;
  lng?: number;
  hints: string[];
  successMessage: string;
}

export interface Game {
  title: string;
  description: string;
  stages: Stage[];
}

const initialData: Game = {
  title: '新港八卦謎蹤',
  description: '穿越清朝與昭和時空，解開失落的卦象真相。',
  stages: [
    {
      id: 's1',
      order: 1,
      title: '第一關：時空交界',
      storyContent: '你睜開眼，發現自己站在昭和九年的新港。空氣中瀰漫著焚香與某種不安的氣息。\n\n白鸞卿正焦急地看著你。這裡曾經是繁華的渡口，如今卻變成了一座靜謐的小廟。',
      imageUrl: 'https://images.unsplash.com/photo-1590001158193-790130ae8ccb?auto=format&fit=crop&q=80&w=800',
      unlockType: 'PASSWORD',
      unlockAnswer: '1860',
      hints: ['找找看這塊土地公廟的建立年份', '就在石碑的右下角'],
      successMessage: '沒錯！1860 年正是這一切動盪的起點。',
    },
    {
      id: 's2',
      order: 2,
      title: '第二關：尋找座標',
      storyContent: '卦象中的「乾」位失蹤了。你需要抵達「新港文教基金會」，在那裡尋找羅盤的蹤跡。',
      imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=800',
      unlockType: 'GPS',
      unlockAnswer: 'ARRIVED',
      lat: 23.557404,
      lng: 120.347565,
      hints: ['跟著地圖指引前進', '抵達基金會大門口'],
      successMessage: '成功抵達！基金會的門柱上有著奇異的刻痕。',
    },
    {
        id: 's3',
        order: 3,
        title: '第三關：掃描封印',
        storyContent: '你在基金會的牆角發現了一個神祕的 QR 碼。這可能是前往下一個時空的門鑰。',
        imageUrl: 'https://images.unsplash.com/photo-1526628953301-3e589a6a8b74?auto=format&fit=crop&q=80&w=800',
        unlockType: 'QR_CODE',
        unlockAnswer: 'SHINKANG_POWER',
        hints: ['掃描現場隱藏的二維碼', '通常就在門牌附近'],
        successMessage: '封印解開，你聽到了光緒年間的呼喊！',
    }
  ]
};

function LocationPicker({ lat, lng, onPick }: { lat?: number, lng?: number, onPick: (lat: number, lng: number) => void }) {
  const MapEvents = () => {
    useMapEvents({
      click(e) {
        onPick(e.latlng.lat, e.latlng.lng);
      },
    });
    return null;
  };

  return (
    <div className="h-48 w-full rounded-xl overflow-hidden border-2 border-slate-100 mb-4">
      <MapContainer center={[lat || 23.55, lng || 120.35]} zoom={15} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {lat && lng && <Marker position={[lat, lng]} />}
        <MapEvents />
      </MapContainer>
    </div>
  );
}

export default function App() {
  const [game, setGame] = useState<Game>(() => {
    const saved = localStorage.getItem('enigma_v5_data');
    return saved ? JSON.parse(saved) : initialData;
  });

  const [isAdmin, setIsAdmin] = useState(false);
  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [solved, setSolved] = useState(false);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    localStorage.setItem('enigma_v5_data', JSON.stringify(game));
  }, [game]);

  const currentStage = game.stages[currentStageIdx] || game.stages[0];
  const totalStages = game.stages.length;

  const handleCheckAnswer = () => {
    if (currentStage.unlockType === 'PASSWORD') {
      if (userInput.trim().toLowerCase() === currentStage.unlockAnswer.toLowerCase()) {
        setSolved(true);
      } else {
        alert('密碼錯誤！');
      }
    } else if (currentStage.unlockType === 'GPS') {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const dist = L.latLng(pos.coords.latitude, pos.coords.longitude).distanceTo(L.latLng(currentStage.lat!, currentStage.lng!));
          if (dist < 100) {
            setSolved(true);
          } else {
            alert(`距離還不夠近喔！(目前距離約 ${Math.round(dist)} 公尺)`);
          }
        },
        () => alert('無法取得 GPS 權限')
      );
    }
  };

  const nextStage = () => {
    if (currentStageIdx < totalStages - 1) {
      setCurrentStageIdx(prev => prev + 1);
      setUserInput('');
      setSolved(false);
      setShowHint(false);
    } else {
      alert('恭喜你完成了所有關卡！');
      setCurrentStageIdx(0);
      setSolved(false);
    }
  };

  useEffect(() => {
    if (isScanning) {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
      scanner.render((decodedText) => {
        if (decodedText.toLowerCase() === currentStage.unlockAnswer.toLowerCase()) {
          scanner.clear();
          setIsScanning(false);
          setSolved(true);
        } else {
          alert("這不是正確的二維碼喔！");
        }
      }, (_err) => {
        // 忽略報錯
      });
      return () => {
        scanner.clear().catch(() => {});
      };
    }
  }, [isScanning, currentStage.unlockAnswer]);

  const EditModal = () => {
    if (!editingStage) return null;
    const [temp, setTemp] = useState<Stage>(editingStage);

    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[1000] flex items-center justify-center p-4 overflow-y-auto text-slate-900">
        <motion.div initial={{ y: 20 }} animate={{ y: 0 }} className="bg-white w-full max-w-lg rounded-3xl overflow-hidden flex flex-col my-auto shadow-2xl">
          <div className="p-6 border-b flex justify-between items-center bg-slate-50">
            <h3 className="font-black text-xl">關卡詳細設定</h3>
            <button onClick={() => setEditingStage(null)}><X /></button>
          </div>
          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">關卡標題</label>
              <input className="w-full border-b-2 border-slate-100 py-2 outline-none font-bold" value={temp.title} onChange={e => setTemp({...temp, title: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">故事腳本</label>
              <textarea className="w-full bg-slate-50 rounded-xl p-4 h-32 outline-none text-sm" value={temp.storyContent} onChange={e => setTemp({...temp, storyContent: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">圖片網址</label>
              <input className="w-full border-b-2 border-slate-100 py-2 outline-none" value={temp.imageUrl} onChange={e => setTemp({...temp, imageUrl: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">解鎖方式</label>
                <select className="w-full py-2 bg-white border-b-2" value={temp.unlockType} onChange={e => setTemp({...temp, unlockType: e.target.value as any})}>
                  <option value="PASSWORD">密碼</option>
                  <option value="GPS">GPS 定位</option>
                  <option value="QR_CODE">QR 掃碼</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">正確答案</label>
                <input className="w-full border-b-2 py-2 outline-none font-mono" value={temp.unlockAnswer} onChange={e => setTemp({...temp, unlockAnswer: e.target.value})} />
              </div>
            </div>
            {temp.unlockType === 'GPS' && (
              <LocationPicker lat={temp.lat} lng={temp.lng} onPick={(lat, lng) => setTemp({...temp, lat, lng})} />
            )}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">提示</label>
              <input className="w-full border-b-2 py-2 outline-none" value={temp.hints[0]} onChange={e => setTemp({...temp, hints: [e.target.value]})} />
            </div>
          </div>
          <div className="p-6 bg-slate-50 border-t flex gap-3">
             <button onClick={() => {
                const newStages = editingStage.id === 'NEW' ? [...game.stages, {...temp, id: Date.now().toString()}] : game.stages.map(s => s.id === temp.id ? temp : s);
                setGame({...game, stages: newStages});
                setEditingStage(null);
             }} className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg">儲存變更</button>
          </div>
        </motion.div>
      </div>
    );
  };

  if (!isAdmin) {
    if (!currentStage) return null;
    return (
      <div className="flex flex-col min-h-screen bg-slate-950 text-white font-sans">
        {isScanning && (
          <div className="fixed inset-0 bg-black z-[2000] flex flex-col items-center justify-center p-6">
             <div id="reader" className="w-full max-w-sm rounded-3xl overflow-hidden mb-8 border-4 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.5)]"></div>
             <button onClick={() => setIsScanning(false)} className="bg-white/10 text-white px-8 py-4 rounded-2xl font-black">取消掃描</button>
          </div>
        )}

        <div className="p-6 pt-10 pb-4">
           <div className="flex justify-between items-center mb-3 text-slate-100">
              <span className="text-[10px] font-black tracking-[0.3em] text-amber-500 uppercase">ENIGMA PHASE {currentStageIdx+1}</span>
              <span className="text-xs font-mono text-slate-500">{currentStageIdx+1} / {totalStages}</span>
           </div>
           <div className="h-1 bg-slate-900 rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${((currentStageIdx + 1) / totalStages) * 100}%` }} className="h-full bg-amber-500" />
           </div>
        </div>

        <div className="flex-1 px-6 pb-6 flex flex-col">
           <div className="bg-slate-900 rounded-[32px] overflow-hidden flex flex-col flex-1 shadow-2xl border border-slate-800">
              {currentStage.imageUrl && (
                <div className="h-48 overflow-hidden relative">
                   <img src={currentStage.imageUrl} className="w-full h-full object-cover" />
                   <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
                </div>
              )}
              
              <div className="p-8 flex flex-col flex-1">
                 <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
                    <div className="w-2 h-8 bg-amber-500 rounded-full" />
                    {currentStage.title}
                 </h2>
                 <p className="flex-1 text-slate-400 leading-relaxed whitespace-pre-wrap">{currentStage.storyContent}</p>

                 {!solved ? (
                   <div className="mt-8 space-y-4">
                      {currentStage.unlockType === 'PASSWORD' ? (
                        <div className="relative">
                          <input type="text" value={userInput} onChange={e => setUserInput(e.target.value)} placeholder="DECRYPTION KEY" className="w-full bg-black/50 border-2 border-slate-800 rounded-2xl py-5 px-6 outline-none focus:border-amber-500 transition-all font-mono uppercase tracking-widest" />
                          <button onClick={handleCheckAnswer} className="absolute right-3 top-3 bottom-3 bg-amber-500 text-black px-6 rounded-xl font-black shadow-lg shadow-amber-900/40">OK</button>
                        </div>
                      ) : currentStage.unlockType === 'GPS' ? (
                        <div className="space-y-3">
                           <button onClick={handleCheckAnswer} className="w-full bg-amber-500 text-black py-5 rounded-2xl font-black flex items-center justify-center gap-2">
                              <MapPin size={20} /> 抵達定位驗證
                           </button>
                           {currentStage.lat && (
                             <a href={`https://www.google.com/maps/dir/?api=1&destination=${currentStage.lat},${currentStage.lng}`} target="_blank" className="w-full border-2 border-slate-800 py-4 rounded-2xl flex items-center justify-center gap-2 text-slate-500 font-bold text-sm">
                                <Navigation size={16} /> 開啟導航
                             </a>
                           )}
                        </div>
                      ) : (
                        <button onClick={() => setIsScanning(true)} className="w-full bg-amber-500 text-black py-5 rounded-2xl font-black flex items-center justify-center gap-2">
                            <QrCode size={20} /> 掃描二維碼
                        </button>
                      )}
                      <button onClick={() => setShowHint(!showHint)} className="w-full py-2 text-slate-600 hover:text-slate-400 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2">
                        <HelpCircle size={14} /> Request Hint
                      </button>
                      {showHint && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-amber-200 text-xs italic">{currentStage.hints[0]}</motion.div>}
                   </div>
                 ) : (
                   <div className="mt-8 bg-green-500/10 border border-green-500/30 p-8 rounded-[24px] text-center">
                      <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4" />
                      <p className="text-green-500 font-bold mb-6 italic">{currentStage.successMessage}</p>
                      <button onClick={nextStage} className="w-full bg-green-500 py-5 rounded-2xl text-black font-black flex items-center justify-center gap-2">NEXT MISSION <ChevronRight size={20} /></button>
                   </div>
                 )}
              </div>
           </div>
        </div>
        <div className="p-6 pt-0 flex justify-between items-center opacity-30">
            <button onClick={() => setIsAdmin(true)} className="text-[10px] font-black uppercase text-slate-400">Admin Access</button>
            <span className="text-[10px] font-mono text-slate-500">ENIGMA ENGINE v2.5</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8 font-sans">
      <EditModal />
      <div className="max-w-xl mx-auto">
         <div className="flex justify-between items-center mb-10">
            <h1 className="text-3xl font-black flex items-center gap-3">
               <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-200"><Settings /></div>
               Engine Center
            </h1>
            <button onClick={() => setIsAdmin(false)} className="bg-white px-6 py-3 rounded-2xl shadow-sm border font-bold text-sm flex items-center gap-2 transition-all active:scale-95"><ArrowLeft size={16} /> Player View</button>
         </div>

         <div className="space-y-6">
            <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
               <label className="text-[10px] font-black uppercase text-slate-300 tracking-widest mb-2 block font-bold">Project Name</label>
               <input className="text-3xl font-black w-full outline-none focus:text-indigo-600 transition-colors" value={game.title} onChange={e => setGame({...game, title: e.target.value})} />
            </div>

            <div className="flex justify-between items-center px-4">
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Campaign Stages</h3>
               <button onClick={() => setEditingStage({ id: 'NEW', order: game.stages.length+1, title: '新任務', storyContent: '', unlockType: 'PASSWORD', unlockAnswer: '1234', hints: [''], successMessage: '任務達成！' })} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-xl shadow-indigo-100 active:scale-95 transition-all"><Plus size={16}/> New Stage</button>
            </div>

            <div className="space-y-3">
               {game.stages.map((s, i) => (
                 <div key={s.id} className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 flex items-center gap-4 hover:border-indigo-200 transition-all">
                    <div className="w-12 h-12 bg-slate-50 flex items-center justify-center rounded-2xl font-black text-slate-300">{i+1}</div>
                    <div className="flex-1">
                       <h4 className="font-bold text-slate-800">{s.title}</h4>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{s.unlockType} · {s.unlockAnswer}</p>
                    </div>
                    <div className="flex gap-2 text-slate-400">
                       <button onClick={() => setEditingStage(s)} className="p-3 bg-slate-50 hover:bg-indigo-600 hover:text-white rounded-xl transition-all"><Edit2 size={16}/></button>
                       <button onClick={() => { if(confirm('Delete?')) setGame({...game, stages: game.stages.filter(item => item.id !== s.id)}) }} className="p-3 bg-slate-50 hover:bg-red-500 hover:text-white rounded-xl transition-all"><Trash2 size={16}/></button>
                    </div>
                 </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
}
