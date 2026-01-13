import React, { useState, useEffect } from 'react';
import { LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler'; // <--- MUST BE HERE
import { supabase } from './src/supabaseClient';

import LoginScreen from './src/screens/LoginScreen';
import MainStack from './src/navigation/MainStack';

LogBox.ignoreLogs(['props.pointerEvents', 'SafeAreaView']);

export default function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  return (
    // This View MUST wrap the whole app for Swipe to work
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        {session && session.user ? <MainStack /> : <LoginScreen />}
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}