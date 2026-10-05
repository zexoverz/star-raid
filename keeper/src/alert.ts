export type Alerter = (text: string) => Promise<void>;

export function telegramAlerter(cfg?: { token: string; chatId: string }): Alerter {
  return async (text) => {
    console.error(`[alert] ${text}`);
    if (!cfg) return;
    await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: cfg.chatId, text: `Star Raid keeper: ${text}` }),
    }).catch((e) => console.error(`[alert] telegram failed: ${(e as Error).message}`));
  };
}
