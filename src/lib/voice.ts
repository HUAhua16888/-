export type VoiceScene = "child" | "teacher";

export const defaultPremiumVoiceLabel = "温柔幼儿园老师声";
export const defaultPremiumVoiceType = "zh_female_xiaohe_uranus_bigtts";

export type BrowserVoiceSettings = {
  rate: number;
  pitch: number;
  volume: number;
};

export type PremiumVoiceTuning = {
  speechRate: number;
  loudnessRate: number;
  speedRatio: number;
};

export const browserVoiceSettingsByScene: Record<VoiceScene, BrowserVoiceSettings> = {
  child: {
    rate: 0.86,
    pitch: 1.08,
    volume: 0.88,
  },
  teacher: {
    rate: 0.9,
    pitch: 1.03,
    volume: 0.9,
  },
};

export const premiumVoiceTuningByScene: Record<VoiceScene, PremiumVoiceTuning> = {
  child: {
    speechRate: -6,
    loudnessRate: -3,
    speedRatio: 0.92,
  },
  teacher: {
    speechRate: -2,
    loudnessRate: -1,
    speedRatio: 0.96,
  },
};
