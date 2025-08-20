import { Platform, Alert } from 'react-native';

// Emergency crash handler - prevents any unhandled errors from crashing the app
export class EmergencyCrashHandler {
  private static instance: EmergencyCrashHandler;
  private crashLog: Array<{ timestamp: number; error: string; context: string }> = [];

  static getInstance(): EmergencyCrashHandler {
    if (!EmergencyCrashHandler.instance) {
      EmergencyCrashHandler.instance = new EmergencyCrashHandler();
    }
    return EmergencyCrashHandler.instance;
  }

  init() {
    // Global error handler for unhandled promise rejections
    if (typeof global !== 'undefined') {
      const originalHandler = global.ErrorUtils?.setGlobalHandler;
      if (originalHandler) {
        originalHandler((error: any, isFatal: boolean) => {
          this.logCrash(error, 'Global Error Handler', isFatal);
          return false; // Don't crash the app
        });
      }
    }

    // Handle unhandled promise rejections
    if (typeof global !== 'undefined' && global.HermesInternal) {
      process.on?.('unhandledRejection', (reason, promise) => {
        this.logCrash(reason, 'Unhandled Promise Rejection', false);
      });
    }

    console.log('[EMERGENCY HANDLER] Crash protection initialized');
  }

  logCrash(error: any, context: string, isFatal: boolean = false) {
    const crashEntry = {
      timestamp: Date.now(),
      error: error?.message || error?.toString() || 'Unknown error',
      context,
      isFatal,
      platform: Platform.OS,
      stack: error?.stack || 'No stack trace'
    };

    this.crashLog.push(crashEntry);
    console.error('[EMERGENCY HANDLER] Crash prevented:', crashEntry);

    // Show user-friendly message for fatal errors
    if (isFatal && Platform.OS === 'android') {
      setTimeout(() => {
        Alert.alert(
          'Error Prevented',
          'A critical error was prevented from crashing the app. The app remains stable.',
          [{ text: 'OK' }]
        );
      }, 100);
    }
  }

  getCrashLog() {
    return this.crashLog;
  }

  clearCrashLog() {
    this.crashLog = [];
  }
}

// Export singleton instance
export const emergencyCrashHandler = EmergencyCrashHandler.getInstance();

// Safe execution wrapper
export const executeWithEmergencyProtection = async <T>(
  operation: () => Promise<T>,
  context: string
): Promise<T | null> => {
  try {
    return await operation();
  } catch (error) {
    emergencyCrashHandler.logCrash(error, context);
    return null;
  }
};

// Initialize on import
emergencyCrashHandler.init();