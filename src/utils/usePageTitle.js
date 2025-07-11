import { useEffect } from 'react';

export function usePageTitle(title) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const previousTitle = document.title;
      document.title = title;
      
      // Cleanup function to restore previous title when component unmounts
      return () => {
        document.title = previousTitle;
      };
    }
  }, [title]);
}

export default usePageTitle; 