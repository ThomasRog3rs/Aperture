"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useCallback, useRef } from "react";

const SCROLL_STORAGE_KEY = "scroll-positions";

type ScrollPositions = Record<string, number>;

/**
 * Hook to manage navigation history and scroll position restoration.
 * 
 * - Saves scroll position to sessionStorage when navigating away
 * - Restores scroll position when returning to a page
 * - Supports both custom goBack() and browser's native back button
 * - Only restores scroll on main pages (Home/Library), not detail pages
 * 
 * Usage:
 * const { goBack, saveScroll } = useNavigationHistory();
 * 
 * Call saveScroll() before navigating away
 * Call goBack() to return to previous page with scroll restored
 */
export function useNavigationHistory() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  // Generate a key for the current page based on pathname + relevant query params
  const getPageKey = useCallback((): string => {
    const params = new URLSearchParams(searchParams.toString());
    
    // Keep only filter-related params for the key (not transient params)
    const relevantParams = ["type", "sort", "watched", "query", "genre", "person", "minRating"];
    const filtered = new URLSearchParams();
    
    for (const param of relevantParams) {
      const value = params.get(param);
      if (value) {
        filtered.set(param, value);
      }
    }
    
    const queryString = filtered.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  }, [pathname, searchParams]);

  // Get all saved scroll positions from sessionStorage
  const getScrollPositions = (): ScrollPositions => {
    try {
      const stored = sessionStorage.getItem(SCROLL_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  };

  // Save current scroll position to sessionStorage
  const saveScrollPosition = useCallback(() => {
    const pageKey = getPageKey();
    const scrollPositions = getScrollPositions();
    
    const element = scrollContainerRef.current || document.documentElement;
    const scrollTop = element.scrollTop || window.scrollY;
    
    scrollPositions[pageKey] = scrollTop;
    sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(scrollPositions));
  }, [getPageKey]);

  // Restore scroll position from sessionStorage
  const restoreScrollPosition = useCallback(() => {
    const pageKey = getPageKey();
    const scrollPositions = getScrollPositions();
    const savedScroll = scrollPositions[pageKey];

    if (typeof savedScroll === "number") {
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        const element = scrollContainerRef.current || window;
        if (element === window) {
          window.scrollTo(0, savedScroll);
        } else {
          (element as HTMLElement).scrollTop = savedScroll;
        }
      }, 0);
    }
  }, [getPageKey]);

  // Navigate back to previous page
  const goBack = useCallback(() => {
    // Save current scroll before going back
    saveScrollPosition();
    
    // Use browser's native back, which will trigger popstate
    window.history.back();
  }, [saveScrollPosition]);

  // Navigate to a specific URL
  const navigate = useCallback(
    (url: string) => {
      saveScrollPosition();
      router.push(url);
    },
    [router, saveScrollPosition]
  );

  // Register the scroll container (default to window if not specified)
  const setScrollContainer = useCallback((element: HTMLElement | null) => {
    scrollContainerRef.current = element;
  }, []);

  // On mount, restore scroll position if coming back to this page
  useEffect(() => {
    // Use requestIdleCallback if available for better performance
    if ("requestIdleCallback" in window) {
      requestIdleCallback(() => restoreScrollPosition(), { timeout: 1000 });
    } else {
      // Fallback to setTimeout for older browsers
      const timer = setTimeout(restoreScrollPosition, 100);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams, restoreScrollPosition]);

  return {
    goBack,
    navigate,
    saveScrollPosition,
    restoreScrollPosition,
    setScrollContainer,
    pageKey: getPageKey(),
  };
}
