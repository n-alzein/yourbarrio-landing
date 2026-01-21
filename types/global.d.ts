export {};

declare global {
  interface Window {
    __ybWebVitals?: (payload: {
      id: string;
      name: string;
      value: number;
      rating?: string;
      delta?: number;
      navigationType?: string;
    }) => void;
  }
}

