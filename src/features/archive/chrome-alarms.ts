export const THREAD_EXPAND_RESUME_ALARM = "thread-expand-resume";
export const THREAD_EXPAND_RESUME_ALARM_PERIOD_MINUTES = 1;

export type ChromeAlarm = {
  name: string;
};

export type ChromeAlarmsApi = {
  create(name: string, alarmInfo: { periodInMinutes?: number }): Promise<void> | void;
  clear(name: string): Promise<boolean> | boolean | void;
  onAlarm: {
    addListener(callback: (alarm: ChromeAlarm) => void): void;
  };
};

export function getChromeAlarmsApi(): ChromeAlarmsApi | null {
  const candidate = globalThis.chrome as typeof globalThis.chrome & {
    alarms?: ChromeAlarmsApi;
  };

  return candidate.alarms ?? null;
}
