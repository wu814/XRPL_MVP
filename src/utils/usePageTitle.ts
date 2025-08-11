import { useEffect } from 'react';

export function usePageTitle(title: string): void {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const previousTitle = document.title;
      document.title = title;
      
      return () => {
        document.title = previousTitle;
      };
    }
  }, [title]);
}

export default usePageTitle;
