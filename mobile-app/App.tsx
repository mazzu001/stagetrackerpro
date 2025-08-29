import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

// Simple screens
import SimplePerformanceScreen from './src/screens/SimplePerformanceScreen';
import SimpleSongListScreen from './src/screens/SimpleSongListScreen';
import TrackManagerScreen from './src/screens/TrackManagerScreen';

// Simple providers
import SimpleAudioEngineProvider from './src/providers/SimpleAudioEngine';
import SimpleDatabaseProvider from './src/providers/SimpleDatabase';

const Stack = createStackNavigator();

export default function App() {
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
                component={TrackManagerScreen}
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