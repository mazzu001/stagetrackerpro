import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase-config';

export function useDevMessage() {
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if db is available
    if (!db) {
      console.warn('Firestore not initialized - dev message unavailable');
      setLoading(false);
      return;
    }

    try {
      // Real-time listener - updates automatically when message changes in Firestore
      const unsubscribe = onSnapshot(
        doc(db, 'app_settings', 'dev_message'),
        (doc) => {
          if (doc.exists()) {
            setMessage(doc.data().value || '');
          } else {
            setMessage(''); // No message in Firestore
          }
          setLoading(false);
        },
        (error) => {
          console.error('Error fetching dev message:', error);
          setMessage(''); // Fail silently
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (error) {
      console.error('Failed to set up dev message listener:', error);
      setLoading(false);
      return;
    }
  }, []);

  return { message, loading };
}
