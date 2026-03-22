export interface GameMetadata {
  id: string;
  title: string;
  description: string;
  coverImage?: string;
  author: string;
}

export type UnlockType = 'PASSWORD' | 'GPS' | 'QR_CODE' | 'BEACON' | 'IMAGE_AR';

export interface Stage {
  id: string;
  order: number;
  title: string;
  storyContent: string;
  imageUrl?: string;
  
  // 任務解鎖條件
  unlockType: UnlockType;
  unlockAnswer?: string; // 對應密碼、QR 碼字串或 GPS 座標
  
  // GPS 專用 (經緯度)
  location?: {
    lat: number;
    lng: number;
    radius: number; // 抵達半徑 (公尺)
  };
  
  // 提示系統
  hints: string[];
  
  // 成功後的過場文字
  successMessage: string;
}

export interface Game {
  metadata: GameMetadata;
  stages: Stage[];
}
