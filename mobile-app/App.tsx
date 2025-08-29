import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

// Instant performance screens
import SimplePerformanceScreen from './src/screens/SimplePerformanceScreen';
import SimpleSongListScreen from './src/screens/SimpleSongListScreen';
import InstantTrackManager from './src/screens/InstantTrackManager';
import LoadingScreen from './src/screens/LoadingScreen';

// Streaming providers for zero load times
import StreamingAudioProvider from './src/providers/StreamingAudio';
import MinimalStorageProvider from './src/providers/MinimalStorage';

const Stack = createStackNavigator();

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Immediate startup - no delay
    setIsReady(true);
  }, []);

  if (!isReady) {
    return <LoadingScreen />;
  }

  return (
    <MinimalStorageProvider>
      <StreamingAudioProvider>
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
                component={InstantTrackManager}
                options={{ title: 'Instant Track Manager' }}
              />
            </Stack.Navigator>
          </View>
        </NavigationContainer>
      </StreamingAudioProvider>
    </MinimalStorageProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
});