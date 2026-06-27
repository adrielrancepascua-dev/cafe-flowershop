import { FlowerAuthProvider } from './lib/auth/FlowerAuthContext';
import AppRouter from './app/router/AppRouter';

function App() {
  return (
    <FlowerAuthProvider>
      <AppRouter />
    </FlowerAuthProvider>
  );
}

export default App;
