import type { AgentItem } from './mainClient';

export const activityLabels = {
  waiting: 'Menunggu izin', running: 'Sedang berjalan', received: 'Hasil diterima',
  failed: 'Gagal', denied: 'Ditolak', cancelled: 'Dibatalkan sebelum dijalankan',
  unconfirmed: 'Hasil belum terkonfirmasi — periksa tujuan sebelum mencoba lagi',
} as const;
export type ToolActivity = { name: string; status: keyof typeof activityLabels; startedAt: number; endedAt?: number };

// No automatic replay: cancellation cannot prove a remote write was rolled back.
export function finishActivities(items: AgentItem[]) {
  for (const item of items) if (item.activity && ['waiting', 'running'].includes(item.activity.status)) {
    item.activity = { ...item.activity, status: item.activity.status === 'running' ? 'unconfirmed' : 'cancelled', endedAt: Date.now() };
  }
}
