import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './state/contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppRoutes } from './routes/routes';
import { GoogleAnalytics } from './components/analytics/GoogleAnalytics';
import { CookieConsent } from './components/CookieConsent';
import { DynamicTitle } from './components/DynamicTitle';
import './index.css';

function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <DynamicTitle />
            <GoogleAnalytics />
            <CookieConsent />
            <AppRoutes />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </HelmetProvider>
  );
}

export default App;
