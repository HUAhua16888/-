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
    rate: 0.84,
    pitch: 1.1,
    volume: 0.88,
  },
  teacher: {
    rate: 0.84,
    pitch: 1.1,
    volume: 0.88,
  },
};

export const premiumVoiceTuningByScene: Record<VoiceScene, PremiumVoiceTuning> = {
  child: {
    speechRate: -8,
    loudnessRate: -4,
    speedRatio: 0.9,
  },
  teacher: {
    speechRate: -8,
    loudnessRate: -4,
    speedRatio: 0.9,
  },
};
