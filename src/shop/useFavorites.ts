import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'bc.favs';

const read = (): string[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    // Corrupt or unavailable storage (private mode, quota) — start empty.
    return [];
  }
};

/* Favourites are a browsing aid, not an account feature: they live in this
   browser's localStorage only. `toggle` reports whether the model was added so
   the caller can pick the matching toast. */
export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(read);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      // Nothing to do — the list still works for this session.
    }
  }, [favorites]);

  const toggle = useCallback((modelId: string) => {
    const adding = !favorites.includes(modelId);
    setFavorites(adding ? [...favorites, modelId] : favorites.filter(id => id !== modelId));
    return adding;
  }, [favorites]);

  const isFavorite = useCallback((modelId: string) => favorites.includes(modelId), [favorites]);

  return { favorites, toggle, isFavorite };
}
