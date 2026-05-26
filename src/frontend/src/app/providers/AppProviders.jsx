import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { UnreadProvider } from '@/contexts/UnreadContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { WalletProvider } from '@/contexts/WalletContext';

export function AppProviders({ children }) {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <LanguageProvider>
          <WalletProvider>
            <UnreadProvider>{children}</UnreadProvider>
          </WalletProvider>
        </LanguageProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
