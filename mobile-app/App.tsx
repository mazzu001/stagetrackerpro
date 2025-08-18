import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

// Screens
import PerformanceScreen from './src/screens/PerformanceScreen';
import SongListScreen from './src/screens/SongListScreen';
import TrackManagerScreen from './src/screens/TrackManagerScreen';

// Audio Engine Setup
import AudioEngineProvider from './src/providers/AudioEngineProvider';
import DatabaseProvider from './src/providers/DatabaseProvider';

const Stack = createStackNavigator();

export default function App() {
  return (
    <DatabaseProvider>
      <AudioEngineProvider>
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
                component={SongListScreen}
                options={{ title: 'Songs' }}
              />
              <Stack.Screen 
                name="Performance" 
                component={PerformanceScreen}
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
      </AudioEngineProvider>
    </DatabaseProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
});