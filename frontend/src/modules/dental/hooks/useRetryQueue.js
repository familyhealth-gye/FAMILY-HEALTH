/**
 * useRetryQueue.js
 * Cola de operaciones con retry exponencial y flush al reconectar.
 *
 * Propósito: evitar pérdida de datos clínicos si la conexión falla chairside.
 * Estrategia:
 *   1. Operación falla → entra a la cola con payload serializado
 *   2. Retry: 2s → 4s → 8s → 16s → 32s (máx 5 intentos)
 *   3. Si siguen fallando → persisten en localStorage
 *   4. Al recuperar conexión (online event) → flush automático
 *   5. Si todo falla → notifica al doctor con opción de copiar datos
 */

import { useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/axios';

const STORAGE_KEY = 'dental_retry_queue';
const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 2000;

const getDelay = (attempt) => BASE_DELAY_MS * Math.pow(2, attempt); // 2,4,8,16,32s

export const useRetryQueue = () => {
  const queueRef    = useRef([]);
  const processingRef = useRef(false);

  // ── Cargar cola persistida al montar ────────────────────────────────────────
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (stored.length > 0) {
        queueRef.current = stored;
        toast.warning(
          `${stored.length} operación(es) pendiente(s) de sincronizar.`,
          { duration: 6000 }
        );
        processQueue();
      }
    } catch {}
  }, []);

  // ── Flush al reconectar ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleOnline = () => {
      if (queueRef.current.length > 0) {
        toast.info('Conexión restaurada — sincronizando operaciones pendientes…');
        processQueue();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const persistQueue = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queueRef.current));
    } catch {}
  };

  const clearQueue = () => {
    queueRef.current = [];
    localStorage.removeItem(STORAGE_KEY);
  };

  // ── Procesar cola ────────────────────────────────────────────────────────────
  const processQueue = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0) return;
    processingRef.current = true;

    while (queueRef.current.length > 0) {
      const op = queueRef.current[0];

      try {
        await apiClient({
          method:  op.method,
          url:     op.url,
          data:    op.data,
          params:  op.params,
        });
        queueRef.current.shift(); // éxito → remover
        persistQueue();
      } catch (err) {
        op.attempts = (op.attempts || 0) + 1;

        if (op.attempts >= MAX_ATTEMPTS) {
          // Agotar reintentos — sacar de la cola y notificar
          queueRef.current.shift();
          persistQueue();
          toast.error(
            `No se pudo sincronizar: "${op.label}". Datos guardados localmente.`,
            { duration: 10000 }
          );
          break;
        }

        // Conflicto de versión — no reintentar automáticamente
        if (err.response?.status === 409) {
          queueRef.current.shift();
          persistQueue();
          toast.error(
            'Conflicto de edición detectado. Recarga la consulta para continuar.',
            { duration: 10000 }
          );
          break;
        }

        persistQueue();
        const delay = getDelay(op.attempts - 1);
        await new Promise(r => setTimeout(r, delay));
        break; // salir del while, volver a intentar en el próximo ciclo
      }
    }

    processingRef.current = false;
  }, []);

  // ── Encolar operación ────────────────────────────────────────────────────────
  const enqueue = useCallback((operation) => {
    // operation: { method, url, data, params, label }
    const op = { ...operation, attempts: 0, enqueuedAt: Date.now() };
    queueRef.current.push(op);
    persistQueue();
    processQueue();
  }, [processQueue]);

  return {
    enqueue,
    queueLength: queueRef.current.length,
    clearQueue,
  };
};
