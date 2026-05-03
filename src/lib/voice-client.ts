import { browserVoiceSettingsByScene, type VoiceScene } from "@/lib/voice";

type TextToSpeechErrorResponse = {
  error?: string;
};

type ManagedVoiceWindow = Window & {
  __tongquActiveVoice?: {
    audio?: HTMLAudioElement;
    objectUrl?: string;
    stop?: () => void;
  };
};

type BrowserSpeechCallbacks = {
  onstart?: () => void;
  onend?: () => void;
  onerror?: () => void;
};

function getManagedWindow() {
  return typeof window === "undefined" ? null : (window as ManagedVoiceWindow);
}

function pickMandarinVoice() {
  const voiceWindow = getManagedWindow();

  if (!voiceWindow || !("speechSynthesis" in voiceWindow)) {
    return null;
  }

  const voices = voiceWindow.speechSynthesis.getVoices();
  const childFriendlyVoice =
    voices.find((voice) => /xiaoyi|xiaohe|晓|小|女/i.test(voice.name) && voice.lang.toLowerCase().startsWith("zh")) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("zh-cn")) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("zh")) ??
    null;

  return childFriendlyVoice;
}

export function stopAllVoicePlayback() {
  const voiceWindow = getManagedWindow();

  if (!voiceWindow) {
    return;
  }

  const activeVoice = voiceWindow.__tongquActiveVoice;

  try {
    activeVoice?.stop?.();
  } catch {
    // Best-effort cleanup only; voice playback should never block the UI.
  }

  if (activeVoice?.audio) {
    activeVoice.audio.pause();
    activeVoice.audio.src = "";
  }

  if (activeVoice?.objectUrl) {
    URL.revokeObjectURL(activeVoice.objectUrl);
  }

  voiceWindow.__tongquActiveVoice = undefined;

  if ("speechSynthesis" in voiceWindow) {
    voiceWindow.speechSynthesis.cancel();
  }
}

export function registerVoiceAudio(audio: HTMLAudioElement, objectUrl?: string) {
  const voiceWindow = getManagedWindow();

  if (!voiceWindow) {
    return () => undefined;
  }

  stopAllVoicePlayback();
  voiceWindow.__tongquActiveVoice = {
    audio,
    objectUrl,
    stop: () => {
      audio.pause();
      audio.src = "";
    },
  };

  return () => {
    if (voiceWindow.__tongquActiveVoice?.audio === audio) {
      audio.pause();
      audio.src = "";
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      voiceWindow.__tongquActiveVoice = undefined;
    }
  };
}

export function speakWithBrowserVoice(
  text: string,
  scene: VoiceScene,
  callbacks: BrowserSpeechCallbacks = {},
) {
  const voiceWindow = getManagedWindow();

  if (!voiceWindow || !("speechSynthesis" in voiceWindow)) {
    return false;
  }

  stopAllVoicePlayback();

  const utterance = new SpeechSynthesisUtterance(text);
  const settings = browserVoiceSettingsByScene[scene];
  const voice = pickMandarinVoice();

  utterance.lang = "zh-CN";
  utterance.rate = settings.rate;
  utterance.pitch = settings.pitch;
  utterance.volume = settings.volume;

  if (voice) {
    utterance.voice = voice;
  }

  const clearActiveVoice = () => {
    if (voiceWindow.__tongquActiveVoice?.stop === stopBrowserSpeech) {
      voiceWindow.__tongquActiveVoice = undefined;
    }
  };
  const stopBrowserSpeech = () => voiceWindow.speechSynthesis.cancel();

  utterance.onstart = () => callbacks.onstart?.();
  utterance.onend = () => {
    clearActiveVoice();
    callbacks.onend?.();
  };
  utterance.onerror = () => {
    clearActiveVoice();
    callbacks.onerror?.();
  };

  voiceWindow.__tongquActiveVoice = {
    stop: stopBrowserSpeech,
  };
  voiceWindow.speechSynthesis.speak(utterance);

  return true;
}

export async function fetchPremiumSpeechAudio(
  text: string,
  scene: VoiceScene,
  signal?: AbortSignal,
) {
  const response = await fetch("/api/text-to-speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, scene }),
    signal,
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as TextToSpeechErrorResponse;
    throw new Error(data.error || "高质量播报暂时不可用");
  }

  return response.blob();
}
