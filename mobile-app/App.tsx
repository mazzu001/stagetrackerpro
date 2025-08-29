import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

// Ultra simple screens
import SimplePerformanceScreen from './src/screens/SimplePerformanceScreen';
import SimpleSongListScreen from './src/screens/SimpleSongListScreen';
import UltraSimpleTrackManager from './src/screens/UltraSimpleTrackManager';
import LoadingScreen from './src/screens/LoadingScreen';

// Simple providers
import SimpleAudioEngineProvider from './src/providers/SimpleAudioEngine';
import SimpleDatabaseProvider from './src/providers/SimpleDatabase';

const Stack = createStackNavigator();

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Fast startup - minimal delay
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  if (!isReady) {
    return <LoadingScreen />;
  }

  return (
    <SimpleDatabaseProvider>
      <SimpleAudioEngineProvider>
        <NavigationContainer>
          <View style={styles.container}>
            <StatusBar style="light" />
            <Stack.Navigator
              initialRouteName="SongList"
              screenOptions={{
                headerStyle: {
                  backgroundColor: '#1a1a1a',
                },
                headerTintColor: '#ffffff',
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}
            >
              <Stack.Screen 
                name="SongList" 
                component={SimpleSongListScreen}
                options={{ title: 'Songs' }}
              />
              <Stack.Screen 
                name="Performance" 
                component={SimplePerformanceScreen}
                options={{ title: 'Performance Mode' }}
              />
              <Stack.Screen 
                name="TrackManager" 
                component={UltraSimpleTrackManager}
                options={{ title: 'Track Manager' }}
              />
            </Stack.Navigator>
          </View>
        </NavigationContainer>
      </SimpleAudioEngineProvider>
    </SimpleDatabaseProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
});