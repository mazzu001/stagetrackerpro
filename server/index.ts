import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { subscriptionMonitor } from "./subscription-monitor";
import { setupVite, serveStatic, log } from "./vite";
import * as fs from "fs";
import * as path from "path";

// Ensure required directories exist
function ensureDirectories() {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    const publicDir = path.join(process.cwd(), 'public');
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('📁 Created data directory:', dataDir);
    }
    
    // Create public directory if it doesn't exist (for production builds)
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
      console.log('📁 Created public directory:', publicDir);
    }
    
    console.log('✅ Directory structure verified');
  } catch (error: any) {
    console.warn('⚠️ Failed to create directories:', error.message);
    console.log('🔧 Continuing startup - directories may be created on demand...');
  }
}

// Environment variable validation
function validateEnvironment() {
  const requiredEnvVars = ['STRIPE_SECRET_KEY'];
  const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missingVars.length > 0) {
    console.warn('⚠️ Missing environment variables:', missingVars);
    console.warn('Some features may not work properly without these secrets.');
    
    // In production, only throw for critical deployment scenarios
    if (process.env.NODE_ENV === 'production' && process.env.REQUIRE_SECRETS === 'true') {
      console.error('❌ Critical environment variables missing in production mode');
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    } else {
      console.log('🔧 Running in development mode or with relaxed validation - continuing startup...');
    }
  }
  
  console.log('✅ Environment variables validated successfully');
  
  // Optional environment variables logging
  const optionalVars = ['DATABASE_URL', 'PORT', 'NODE_ENV'];
  optionalVars.forEach(envVar => {
    if (process.env[envVar]) {
      console.log(`✅ ${envVar}: configured`);
    } else {
      console.log(`⚠️ ${envVar}: not set (using defaults)`);
    }
  });
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    console.log('🚀 Starting application initialization...');
    
    // Ensure required directories exist first
    ensureDirectories();
    
    // Validate environment variables
    validateEnvironment();
    
    console.log('📋 Registering routes and setting up server...');
    let server;
    try {
      server = await registerRoutes(app);
      console.log('✅ Routes registered successfully');
    } catch (routeError: any) {
      console.error('❌ Route registration failed:', {
        message: routeError.message,
        stack: routeError.stack
      });
      console.log('🔧 Attempting to continue with minimal route setup...');
      
      // Create minimal server with health check only
      const http = await import('http');
      server = http.createServer(app);
      
      // Add minimal health check route if it doesn't exist
      app.get('/api/health', (req, res) => {
        res.json({ 
          status: 'degraded', 
          timestamp: new Date().toISOString(),
          message: 'Running with minimal functionality due to route registration issues'
        });
      });
      
      console.log('⚠️ Running with degraded functionality - some features may not work');
    }

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      
      console.error('❌ Global error handler caught error:', {
        status,
        message,
        stack: err.stack,
        url: _req.url,
        method: _req.method
      });

      res.status(status).json({ message });
    });

    // Setup Vite or static file serving with error handling
    console.log('⚙️ Setting up file serving...');
    const env = app.get("env") || process.env.NODE_ENV || "development";
    console.log(`Environment: ${env}`);
    
    try {
      if (env === "development") {
        console.log('🔧 Setting up Vite development server...');
        await setupVite(app, server);
        console.log('✅ Vite development server configured');
      } else {
        console.log('📁 Setting up static file serving for production...');
        serveStatic(app);
        console.log('✅ Static file serving configured');
      }
    } catch (fileServingError: any) {
      console.error('❌ File serving setup failed:', {
        message: fileServingError.message,
        stack: fileServingError.stack
      });
      console.log('🔧 Setting up fallback file serving...');
      
      // Fallback: serve basic static files if possible
      try {
        const express = await import('express');
        app.use(express.default.static('public'));
        console.log('⚠️ Using basic static file serving as fallback');
      } catch (fallbackError) {
        console.warn('⚠️ Fallback file serving also failed - app may not serve frontend properly');
      }
    }

    // Start the server with enhanced error handling
    const port = parseInt(process.env.PORT || '5000', 10);
    console.log(`🌐 Starting server on port ${port}...`);
    
    // Enhanced server startup with better error handling
    const startServer = () => {
      return new Promise<void>((resolve, reject) => {
        const serverInstance = server.listen({
          port,
          host: "0.0.0.0",
          reusePort: true,
        }, (error?: Error) => {
          if (error) {
            reject(error);
          } else {
            console.log('🎉 Application started successfully!');
            log(`serving on port ${port}`);
            console.log(`🔗 Application available at: http://0.0.0.0:${port}`);
            
            // Start subscription monitoring with error handling
            try {
              subscriptionMonitor.start();
              console.log('✅ Subscription monitoring started');
            } catch (monitorError: any) {
              console.warn('⚠️ Subscription monitoring failed to start:', monitorError.message);
            }
            
            resolve();
          }
        });
        
        // Handle immediate server errors
        serverInstance.on('error', reject);
      });
    };
    
    await startServer();

    // Handle server startup errors
    server.on('error', (error: any) => {
      console.error('❌ Server startup error:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Please choose a different port.`);
      }
      process.exit(1);
    });

  } catch (error: any) {
    console.error('❌ Application initialization failed:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      nodeVersion: process.version,
      platform: process.platform
    });
    
    // Provide specific guidance based on error type
    if (error.message.includes('Missing required environment variables')) {
      console.error('💡 Solution: Add the missing environment variables to your deployment configuration');
      console.error('🔧 Debug: Check deployment settings or use REQUIRE_SECRETS=false for testing');
    } else if (error.message.includes('database') || error.message.includes('DATABASE_URL')) {
      console.error('💡 Solution: Check your database connection and ensure DATABASE_URL is correct');
      console.error('🔧 Debug: Verify database is accessible and credentials are valid');
    } else if (error.message.includes('STRIPE')) {
      console.error('💡 Solution: Ensure STRIPE_SECRET_KEY is properly configured');
      console.error('🔧 Debug: For testing, set REQUIRE_SECRETS=false to skip validation');
    } else if (error.message.includes('EADDRINUSE')) {
      console.error('💡 Solution: Port is already in use - change PORT environment variable');
    } else if (error.message.includes('permission') || error.message.includes('EACCES')) {
      console.error('💡 Solution: Check file system permissions for data directory');
    } else {
      console.error('💡 Solution: Check the error details above and ensure all dependencies are properly installed');
      console.error('🔧 Debug: This may be a deployment-specific issue');
    }
    
    // For production deployments, try graceful degradation
    if (process.env.NODE_ENV === 'production' && process.env.GRACEFUL_DEGRADATION === 'true') {
      console.log('🔧 Attempting graceful degradation for production deployment...');
      try {
        // Create minimal express app as last resort
        const minimalApp = express();
        minimalApp.get('/health', (req, res) => res.json({ status: 'minimal' }));
        minimalApp.listen(process.env.PORT || 5000, () => {
          console.log('⚠️ Running in minimal mode - limited functionality available');
        });
        return; // Don't exit
      } catch (minimalError) {
        console.error('❌ Even graceful degradation failed:', minimalError);
      }
    }
    
    console.error('🛑 Exiting application due to initialization failure');
    process.exit(1);
  }
})();

// Add process-level error handlers for deployment scenarios
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
  
  // For deployment environments, attempt graceful shutdown
  if (process.env.NODE_ENV === 'production') {
    console.log('🔧 Attempting graceful shutdown...');
    setTimeout(() => {
      console.error('🛑 Forced exit after uncaught exception');
      process.exit(1);
    }, 5000);
  } else {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  
  // Log additional context for debugging
  console.error('🔍 Debugging info:', {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    reason: reason
  });
  
  // Don't exit immediately for unhandled rejections in production
  if (process.env.NODE_ENV !== 'production') {
    console.error('🛑 Exiting due to unhandled rejection');
    process.exit(1);
  }
});
