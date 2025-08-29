import React from 'react';
import { View, Text, Alert } from 'react-native';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: any;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    console.error('=== ERROR BOUNDARY CAUGHT ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('=== END ERROR BOUNDARY ===');
    
    return {
      hasError: true,
      error: error
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('=== ERROR BOUNDARY COMPONENT DID CATCH ===');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Component Stack:', errorInfo.componentStack);
    console.error('=== END COMPONENT DID CATCH ===');
    
    this.setState({
      errorInfo: errorInfo
    });

    // Show alert to user
    Alert.alert(
      'App Error',
      `Something went wrong: ${error.message}`,
      [
        {
          text: 'Reset',
          onPress: () => this.resetError()
        }
      ]
    );
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }

      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }}>
            Something went wrong
          </Text>
          <Text style={{ fontSize: 14, marginBottom: 20, textAlign: 'center', color: '#666' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <Text 
            style={{ fontSize: 16, color: '#007AFF', textAlign: 'center' }}
            onPress={this.resetError}
          >
            Try Again
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

// Simple functional error boundary hook for specific operations
export const withErrorHandler = <T extends any[]>(
  fn: (...args: T) => Promise<any>,
  errorPrefix: string = 'Operation failed'
) => {
  return async (...args: T) => {
    try {
      console.log(`=== Starting ${errorPrefix} ===`);
      const result = await fn(...args);
      console.log(`=== Completed ${errorPrefix} successfully ===`);
      return result;
    } catch (error) {
      console.error(`=== ERROR in ${errorPrefix} ===`);
      console.error('Error type:', typeof error);
      console.error('Error instanceof Error:', error instanceof Error);
      console.error('Error message:', error instanceof Error ? error.message : 'No message');
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
      console.error('Full error object:', error);
      console.error(`=== END ERROR in ${errorPrefix} ===`);
      
      Alert.alert(
        'Error',
        `${errorPrefix}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  };
};