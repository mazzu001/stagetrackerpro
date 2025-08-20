import React, { Component, ReactNode } from 'react';
import { View, Text, Alert, Platform } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class AndroidCrashHandler extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('AndroidCrashHandler caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('AndroidCrashHandler componentDidCatch:', error, errorInfo);
    
    if (Platform.OS === 'android') {
      // Log Android-specific error details
      console.error('Android crash details:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        platform: Platform.OS,
        version: Platform.Version,
      });

      // Show user-friendly error message
      setTimeout(() => {
        Alert.alert(
          'App Error',
          'The app encountered an unexpected error. This has been logged for debugging. Please restart the app.',
          [{ text: 'OK' }]
        );
      }, 100);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 }}>
            Something went wrong
          </Text>
          <Text style={{ fontSize: 14, textAlign: 'center', color: '#666' }}>
            The app encountered an unexpected error. Please restart the app.
          </Text>
          {Platform.OS === 'android' && (
            <Text style={{ fontSize: 12, textAlign: 'center', color: '#999', marginTop: 10 }}>
              If this keeps happening, try clearing app storage in Android settings.
            </Text>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

export default AndroidCrashHandler;