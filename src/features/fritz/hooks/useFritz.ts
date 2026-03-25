import { useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../lib/firebase';
import { useFritzStore } from '../stores/fritzStore';
import type { SalePreview } from '../types';

interface FritzChatRequest {
  message: string;
  conversationId?: string;
  context?: {
    currentPage: string;
    selectedLote?: string;
  };
}

interface FritzChatResponse {
  response: string;
  action?: {
    type: 'sale_preview' | 'confirmation' | 'info_card' | 'none';
    data: unknown;
  };
  conversationId: string;
}

const fritzChatFn = httpsCallable<FritzChatRequest, FritzChatResponse>(functions, 'fritzChat');

export function useFritz() {
  const {
    addMessage,
    updateMessage,
    setLoading,
    setSalePreview,
    setConversationId,
    conversationId,
    salePreview,
  } = useFritzStore();

  const sendMessage = useCallback(
    async (text: string, context?: FritzChatRequest['context']) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      // Add user message (optimistic)
      const userMsgId = `user-${Date.now()}`;
      addMessage({
        id: userMsgId,
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      });

      // Add loading placeholder for Fritz
      const fritzMsgId = `fritz-${Date.now()}`;
      addMessage({
        id: fritzMsgId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isLoading: true,
      });

      setLoading(true);

      try {
        const result = await fritzChatFn({
          message: trimmed,
          conversationId: conversationId || undefined,
          context,
        });

        const { response, action, conversationId: newConvId } = result.data;

        // Replace loading placeholder with real response
        updateMessage(fritzMsgId, {
          content: response,
          isLoading: false,
          action:
            action?.type !== 'none'
              ? (action as { type: 'sale_preview' | 'confirmation' | 'info_card'; data: unknown })
              : undefined,
        });

        if (newConvId) setConversationId(newConvId);

        // If sale preview, open the modal
        if (action?.type === 'sale_preview') {
          setSalePreview(action.data as SalePreview);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Algo salió mal. Intentá de nuevo.';
        updateMessage(fritzMsgId, {
          content: `Perdón, ${errorMsg}`,
          isLoading: false,
        });
      } finally {
        setLoading(false);
      }
    },
    [addMessage, updateMessage, setLoading, setSalePreview, setConversationId, conversationId]
  );

  const addToSale = useCallback(
    async (text: string) => {
      if (!salePreview) return;
      await sendMessage(text, {
        currentPage: 'fritz-sale-modal',
        selectedLote: salePreview.lote,
      });
    },
    [sendMessage, salePreview]
  );

  return { sendMessage, addToSale };
}
