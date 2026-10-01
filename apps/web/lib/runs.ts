// How a crawler or extraction run was started (CHECK trigger IN
// ('schedule','manual','local') in both migrations), in plain words.
const triggers: Record<string, string> = { schedule: "Theo lịch", manual: "Chạy tay", local: "Chạy trên máy" };
export function triggerLabel(trigger: string) {
  return triggers[trigger] ?? trigger;
}
