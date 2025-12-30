import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';

export type LiveTransaction = {
  TrName: string | null;
  TrController: string | null;
  Transaction: string | null;
  CardNo: string | null;
  TrDate: string | null;
  TrTime: string | null;
  TxnTime: string;
};

type LiveTransactionsResponse = { ok: boolean; error?: string; transactions?: LiveTransaction[] } | null;

export function useCardTransactions() {
  const lastSeenRef = useRef<string | null>(null);
  return useQuery({
    queryKey: ['card-transactions'],
    queryFn: async (): Promise<LiveTransaction[]> => {
      const tryFetch = async (url: string): Promise<LiveTransactionsResponse> => {
        const r = await fetch(url);
        const j = (await r.json()) as LiveTransactionsResponse;
        if (r.status >= 500) throw new Error(j?.error || 'Server error');
        return j;
      };

      let json: LiveTransactionsResponse = null;
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (lastSeenRef.current) params.set('since', lastSeenRef.current);
      try {
        json = await tryFetch(`/api/gym-live-transactions?${params.toString()}`);
      } catch (_) {
        json = await tryFetch(`/gym-live-transactions?${params.toString()}`);
      }

      if (!json || !json.ok) throw new Error(json?.error || 'Failed to load live transactions');
      const rows = Array.isArray(json.transactions) ? json.transactions : [];
      if (rows.length > 0) {
        lastSeenRef.current = rows[0]?.TxnTime ?? lastSeenRef.current;
      }
      return rows;
    },
    refetchInterval: 2000,
  });
}
