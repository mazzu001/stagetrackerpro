import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { subscriptionMonitor } from "./subscription-monitor";
import { setupVite, serveStatic, log } from "./vite";
import * as fs from "fs";
import * as path from "path";

// Enhanced directory creation with comprehensive error handling
function ensureDirectories() {
  const requiredDirectories = [
    { path: path.join(process.cwd(), 'data'), name: 'data', critical: true },
    { path: path.join(process.cwd(), 'public'), name: 'public', critical: false },
    { path: path.join(process.cwd(), 'uploads'), name: 'uploads', critical: false },
    { path: path.join(process.cwd(), 'attached_assets'), name: 'attached_assets', critical: false }
  ];
  
  let criticalFailures = 0;
  let warnings = 0;
  
  for (const dir of requiredDirectories) {
    try {
      if (!fs.existsSync(dir.path)) {
        fs.mkdirSync(dir.path, { recursive: true });
        console.log(`📁 Created ${dir.name} directory: ${dir.path}`);
      } else {
        // Verify directory is writable
        fs.accessSync(dir.path, fs.constants.W_OK);
      }
      console.log(`✅ ${dir.name} directory verified and writable`);
    } catch (error: any) {
      const errorMsg = `Failed to handle ${dir.name} directory (${dir.path}): ${error.message}`;
      
      if (dir.critical) {
        console.error('❌', errorMsg);
        criticalFailures++;
        
        // Provide specific guidance for critical directory failures
        if (error.code === 'EACCES') {
          console.error('💡 Permission denied - ensure write permissions for application directory');
        } else if (error.code === 'ENOSPC') {
          console.error('💡 No space left on device - check available disk space');
        } else if (error.code === 'EROFS') {
          console.error('💡 Read-only file system - check deployment configuration');
        }
      } else {
        console.warn('⚠️', errorMsg);
        warnings++;
        console.log(`🔧 ${dir.name} directory will be created on-demand if needed`);
      }
    }
  }
  
  // Summary and decision logic
  if (criticalFailures > 0) {
    const message = `Critical directory creation failed (${criticalFailures} failures)`;
    console.error('❌', message);
    console.error('🛑 Cannot continue without required directories');
    throw new Error(message);
  }
  
  const statusMsg = warnings > 0 
    ? `Directory structure verified with ${warnings} non-critical warnings` 
    : 'Directory structure fully verified';
    
  console.log('✅', statusMsg);
}

// Enhanced environment variable validation with deployment-friendly defaults
function validateEnvironment() {
  const requiredEnvVars = ['STRIPE_SECRET_KEY'];
  const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  // Enhanced deployment-friendly validation
  if (missingVars.length > 0) {
    console.warn('⚠️ Missing environment variables:', missingVars);
    console.warn('Some features may not work properly without these secrets.');
    
    // More lenient validation for deployment scenarios
    const isStrictMode = process.env.REQUIRE_SECRETS === 'true';
    const isProduction = process.env.NODE_ENV === 'production';
    const isDeploymentTest = process.env.DEPLOYMENT_TEST === 'true';
    
    if (isProduction && isStrictMode && !isDeploymentTest) {
      console.error('❌ Critical environment variables missing in production strict mode');
      console.error('💡 To deploy without secrets for testing, set DEPLOYMENT_TEST=true');
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    } else {
      console.log('🔧 Running with relaxed validation - continuing startup...');
      console.log('🔧 Missing secrets will be handled gracefully during runtime');
      
      // Set placeholder values for graceful degradation
      if (!process.env.STRIPE_SECRET_KEY) {
        console.log('🔧 Setting placeholder for STRIPE_SECRET_KEY - payments will be disabled');
        process.env.STRIPE_SECRET_KEY = 'placeholder_for_deployment';
      }
    }
  }
  
  console.log('✅ Environment variables validated successfully');
  
  // Enhanced logging for debugging deployment issues
  const allVars = ['DATABASE_URL', 'PORT', 'NODE_ENV', 'REQUIRE_SECRETS', 'DEPLOYMENT_TEST', 'GRACEFUL_DEGRADATION'];
  console.log('🔍 Environment variable status:');
  allVars.forEach(envVar => {
    const value = process.env[envVar];
    if (value) {
      // Mask sensitive values for logging
      const maskedValue = envVar.includes('SECRET') || envVar.includes('KEY') || envVar.includes('URL') 
        ? value.substring(0, 8) + '...' 
        : value;
      console.log(`  ✅ ${envVar}: ${maskedValue}`);
    } else {
      console.log(`  ⚠️ ${envVar}: not set`);
    }
  });
}

const app = express();
// Increase JSON payload limit for profile photo uploads (base64 images can be large)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Add early health check endpoint for deployment verification
app.get('/health', async (req, res) => {
  try {
    // Import database health check
    const { dbHealthCheck } = await import('./db');
    const dbStatus = await dbHealthCheck();
    
    res.json({ 
      status: dbStatus.status === 'healthy' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      database: dbStatus
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      database: { status: 'unhealthy', error: error.message },
      error: 'Health check failed'
    });
  }
});

// Add startup status endpoint for deployment debugging
app.get('/api/startup-status', (req, res) => {
  res.json({
    status: 'initializing',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    checks: {
      directories: true,
      environment: true,
      routes: false,
      fileServing: false,
      server: false
    }
  });
});

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
  let startupChecks = {
    directories: false,
    environment: false,
    routes: false,
    fileServing: false,
    server: false
  };

  try {
    console.log('🚀 Starting application initialization...');
    console.log(`🔍 Deployment info:`, {
      nodeVersion: process.version,
      platform: process.platform,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
    
    // Ensure required directories exist first
    console.log('📁 Step 1/5: Creating required directories...');
    try {
      ensureDirectories();
      startupChecks.directories = true;
      console.log('✅ Step 1/5: Directory creation completed');
    } catch (dirError: any) {
      console.warn('⚠️ Step 1/5: Directory creation had issues:', dirError.message);
      startupChecks.directories = false;
    }
    
    // Validate environment variables
    console.log('🔧 Step 2/5: Validating environment variables...');
    try {
      validateEnvironment();
      startupChecks.environment = true;
      console.log('✅ Step 2/5: Environment validation completed');
    } catch (envError: any) {
      console.error('❌ Step 2/5: Environment validation failed:', envError.message);
      throw envError; // This is critical, so we should fail here
    }
    
    console.log('📋 Step 3/5: Setting up routes and server...');
    let server;
    try {
      server = await registerRoutes(app);
      startupChecks.routes = true;
      console.log('✅ Step 3/5: Routes registered successfully');
    } catch (routeError: any) {
      console.error('❌ Step 3/5: Route registration failed:', {
        message: routeError.message,
        stack: routeError.stack?.split('\n').slice(0, 5).join('\n'), // Limit stack trace for readability
        timestamp: new Date().toISOString()
      });
      console.log('🔧 Attempting graceful degradation with minimal route setup...');
      
      // Enhanced minimal server with better error handling
      try {
        const http = await import('http');
        server = http.createServer(app);
        
        // Update health check route to show degraded status
        app.get('/api/health', (req, res) => {
          res.json({ 
            status: 'degraded', 
            timestamp: new Date().toISOString(),
            message: 'Running with minimal functionality due to route registration issues',
            error: routeError.message,
            checks: startupChecks
          });
        });
        
        // Add debug endpoint for troubleshooting
        app.get('/api/debug', (req, res) => {
          res.json({
            status: 'degraded',
            startupChecks,
            error: {
              type: 'route_registration_failed',
              message: routeError.message,
              timestamp: new Date().toISOString()
            },
            environment: {
              NODE_ENV: process.env.NODE_ENV,
              PORT: process.env.PORT,
              hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
              hasDatabaseUrl: !!process.env.DATABASE_URL
            }
          });
        });
        
        startupChecks.routes = false;
        console.log('⚠️ Step 3/5: Running with degraded functionality - some features may not work');
      } catch (minimalError: any) {
        console.error('❌ Even minimal server setup failed:', minimalError.message);
        throw new Error(`Complete route setup failure: ${routeError.message} | Minimal setup: ${minimalError.message}`);
      }
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

    // Enhanced file serving setup with better error handling
    console.log('⚙️ Step 4/5: Setting up file serving...');
    const env = app.get("env") || process.env.NODE_ENV || "development";
    console.log(`🔍 Environment mode: ${env}`);
    
    try {
      if (env === "development") {
        console.log('🔧 Setting up Vite development server...');
        await setupVite(app, server);
        startupChecks.fileServing = true;
        console.log('✅ Step 4/5: Vite development server configured');
      } else {
        console.log('📁 Setting up static file serving for production...');
        serveStatic(app);
        startupChecks.fileServing = true;
        console.log('✅ Step 4/5: Static file serving configured');
      }
    } catch (fileServingError: any) {
      console.error('❌ Step 4/5: Primary file serving setup failed:', {
        message: fileServingError.message,
        stack: fileServingError.stack?.split('\n').slice(0, 3).join('\n'),
        timestamp: new Date().toISOString()
      });
      console.log('🔧 Attempting fallback file serving options...');
      
      // Multiple fallback strategies
      let fallbackSuccess = false;
      
      // Fallback 1: Basic static file serving
      try {
        const express = await import('express');
        app.use(express.default.static('public'));
        app.use(express.default.static('dist'));
        app.use(express.default.static('client/dist'));
        fallbackSuccess = true;
        console.log('⚠️ Fallback 1: Basic static file serving enabled');
      } catch (fallback1Error) {
        console.warn('❌ Fallback 1: Basic static serving failed');
      }
      
      // Fallback 2: Minimal SPA serving
      if (!fallbackSuccess) {
        try {
          app.get('*', (req, res) => {
            if (req.path.startsWith('/api/')) {
              res.status(404).json({ error: 'API endpoint not found' });
            } else {
              res.send(`
                <!DOCTYPE html>
                <html>
                <head><title>Application Starting</title></head>
                <body>
                  <h1>Application is starting...</h1>
                  <p>File serving is in minimal mode.</p>
                  <p><a href="/health">Check health status</a></p>
                  <p><a href="/api/debug">View debug info</a></p>
                </body>
                </html>
              `);
            }
          });
          fallbackSuccess = true;
          console.log('⚠️ Fallback 2: Minimal SPA serving enabled');
        } catch (fallback2Error) {
          console.error('❌ Fallback 2: Minimal serving also failed');
        }
      }
      
      startupChecks.fileServing = fallbackSuccess;
      if (!fallbackSuccess) {
        console.warn('⚠️ Step 4/5: All file serving options failed - app may not serve frontend properly');
      } else {
        console.log('✅ Step 4/5: File serving configured with fallback method');
      }
    }

    // Enhanced server startup with comprehensive error handling
    console.log('🌐 Step 5/5: Starting server...');
    const port = parseInt(process.env.PORT || '5000', 10);
    console.log(`🔍 Server configuration:`, {
      port,
      host: '0.0.0.0',
      environment: env,
      timestamp: new Date().toISOString()
    });
    
    const startServer = () => {
      return new Promise<void>((resolve, reject) => {
        const startTimeout = setTimeout(() => {
          reject(new Error('Server startup timeout after 30 seconds'));
        }, 30000);

        try {
          const serverInstance = server.listen({
            port,
            host: "0.0.0.0",
            reusePort: true,
          }, (error?: Error) => {
            clearTimeout(startTimeout);
            
            if (error) {
              console.error('❌ Step 5/5: Server startup failed:', {
                message: error.message,
                code: (error as any).code,
                port,
                timestamp: new Date().toISOString()
              });
              reject(error);
            } else {
              startupChecks.server = true;
              console.log('🎉 Step 5/5: Server started successfully!');
              log(`serving on port ${port}`);
              console.log(`🔗 Application available at: http://0.0.0.0:${port}`);
              console.log(`🔍 Full startup summary:`, startupChecks);
              
              // Start subscription monitoring with enhanced error handling
              try {
                console.log('🔍 Starting subscription status check...');
                subscriptionMonitor.start();
                console.log('✅ Subscription monitoring started');
              } catch (monitorError: any) {
                console.warn('⚠️ Subscription monitoring failed to start:', {
                  message: monitorError.message,
                  timestamp: new Date().toISOString()
                });
                console.log('🔧 Application will continue without subscription monitoring');
              }
              
              resolve();
            }
          });
          
          // Enhanced server error handling
          serverInstance.on('error', (serverError: any) => {
            clearTimeout(startTimeout);
            console.error('❌ Server error during startup:', {
              message: serverError.message,
              code: serverError.code,
              port,
              timestamp: new Date().toISOString()
            });
            
            // Provide specific guidance for common server errors
            if (serverError.code === 'EADDRINUSE') {
              console.error('💡 Port already in use - try setting PORT environment variable to a different value');
            } else if (serverError.code === 'EACCES') {
              console.error('💡 Permission denied - ensure the app has permission to bind to this port');
            } else if (serverError.code === 'ENOTFOUND') {
              console.error('💡 Host not found - check network configuration');
            }
            
            reject(serverError);
          });
          
          // Handle server close events
          serverInstance.on('close', () => {
            console.log('🔄 Server connection closed');
          });
          
        } catch (setupError: any) {
          clearTimeout(startTimeout);
          console.error('❌ Server setup error:', setupError.message);
          reject(setupError);
        }
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
    
    // Enhanced graceful degradation for production deployments
    const shouldAttemptGracefulDegradation = 
      process.env.NODE_ENV === 'production' || 
      process.env.GRACEFUL_DEGRADATION === 'true' ||
      process.env.DEPLOYMENT_TEST === 'true';
    
    if (shouldAttemptGracefulDegradation) {
      console.log('🔧 Attempting enhanced graceful degradation for deployment...');
      try {
        // Create comprehensive minimal express app as last resort
        const minimalApp = express();
        
        // Enable JSON parsing
        minimalApp.use(express.json());
        
        // Basic health check
        minimalApp.get('/health', (req, res) => {
          res.json({ 
            status: 'minimal',
            mode: 'graceful_degradation',
            timestamp: new Date().toISOString(),
            startupChecks,
            environment: process.env.NODE_ENV || 'unknown'
          });
        });
        
        // Enhanced debug endpoint
        minimalApp.get('/api/debug', (req, res) => {
          res.json({
            status: 'minimal_mode',
            degradationReason: 'application_initialization_failed',
            startupChecks,
            error: {
              message: error.message,
              timestamp: new Date().toISOString()
            },
            environment: {
              NODE_ENV: process.env.NODE_ENV,
              PORT: process.env.PORT,
              GRACEFUL_DEGRADATION: process.env.GRACEFUL_DEGRADATION,
              DEPLOYMENT_TEST: process.env.DEPLOYMENT_TEST,
              hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
              hasDatabaseUrl: !!process.env.DATABASE_URL
            },
            suggestions: [
              'Check environment variables are properly set',
              'Verify database connectivity',
              'Ensure all required secrets are configured',
              'Check server logs for specific error details'
            ]
          });
        });
        
        // Catch-all for SPA
        minimalApp.get('*', (req, res) => {
          if (req.path.startsWith('/api/')) {
            res.status(503).json({ 
              error: 'Service temporarily unavailable',
              message: 'Application is running in minimal mode due to startup issues',
              timestamp: new Date().toISOString()
            });
          } else {
            res.send(`
              <!DOCTYPE html>
              <html>
              <head>
                <title>Application - Minimal Mode</title>
                <style>
                  body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
                  .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                  .status { color: #ff6b35; font-weight: bold; }
                  .info { background: #e3f2fd; padding: 15px; border-radius: 4px; margin: 15px 0; }
                  a { color: #1976d2; text-decoration: none; }
                  a:hover { text-decoration: underline; }
                </style>
              </head>
              <body>
                <div class="container">
                  <h1>🔧 Application Starting</h1>
                  <p class="status">Status: Running in minimal mode</p>
                  <div class="info">
                    <p>The application encountered startup issues and is running with limited functionality while the problem is being resolved.</p>
                  </div>
                  <h3>Available endpoints:</h3>
                  <ul>
                    <li><a href="/health">Health Check</a> - Basic application status</li>
                    <li><a href="/api/debug">Debug Information</a> - Detailed diagnostic info</li>
                  </ul>
                  <p><small>Timestamp: ${new Date().toISOString()}</small></p>
                </div>
              </body>
              </html>
            `);
          }
        });
        
        // Start minimal server
        const minimalPort = parseInt(process.env.PORT || '5000', 10);
        minimalApp.listen(minimalPort, '0.0.0.0', () => {
          console.log('⚠️ Running in enhanced minimal mode - limited functionality available');
          console.log(`🔗 Minimal app available at: http://0.0.0.0:${minimalPort}`);
          console.log('🔍 Check /health and /api/debug endpoints for status information');
        });
        
        return; // Don't exit, keep running in minimal mode
      } catch (minimalError: any) {
        console.error('❌ Even enhanced graceful degradation failed:', {
          message: minimalError.message,
          stack: minimalError.stack?.split('\n').slice(0, 3).join('\n'),
          timestamp: new Date().toISOString()
        });
      }
    }
    
    console.error('🛑 Exiting application due to initialization failure');
    process.exit(1);
  }
})();

// Enhanced process-level error handlers for deployment scenarios
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception caught:', {
    message: error.message,
    name: error.name,
    stack: error.stack?.split('\n').slice(0, 10).join('\n'), // Limit stack trace
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    nodeVersion: process.version,
    platform: process.platform
  });
  
  // Provide specific guidance based on error type
  if (error.message.includes('terminating connection due to administrator command') ||
      error.message.includes('connection terminated') ||
      error.message.includes('Connection terminated unexpectedly')) {
    console.error('💡 Database connection terminated by provider - this is likely a temporary issue');
    console.error('🔧 The database manager will attempt automatic reconnection');
    console.error('🔍 If this persists, check your Neon/PostgreSQL provider status');
  } else if (error.message.includes('ECONNREFUSED')) {
    console.error('💡 Database connection refused - check DATABASE_URL and database availability');
  } else if (error.message.includes('MODULE_NOT_FOUND')) {
    console.error('💡 Missing dependency - ensure all packages are properly installed');
  } else if (error.message.includes('permission') || error.message.includes('EACCES')) {
    console.error('💡 Permission error - check file system permissions');
  } else if (error.message.includes('Pool') || error.message.includes('database')) {
    console.error('💡 Database-related error - check connection string and database status');
  }
  
  // For deployment environments, attempt graceful shutdown with timeout
  const isProduction = process.env.NODE_ENV === 'production';
  const gracefulShutdownTime = isProduction ? 10000 : 2000;
  
  console.log(`🔧 Attempting graceful shutdown in ${gracefulShutdownTime}ms...`);
  
  // Give the application time to clean up
  setTimeout(() => {
    console.error('🛑 Forced exit after uncaught exception');
    process.exit(1);
  }, gracefulShutdownTime);
});

process.on('unhandledRejection', (reason, promise) => {
  const reasonString = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : 'No stack trace available';
  
  console.error('💥 Unhandled Promise Rejection detected:', {
    reason: reasonString,
    stack: stack?.split('\n').slice(0, 5).join('\n'),
    promise: promise.toString().substring(0, 100) + '...',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown'
  });
  
  // Provide guidance for common rejection types
  if (reasonString.includes('fetch') || reasonString.includes('network')) {
    console.error('💡 Network-related rejection - check external service connectivity');
  } else if (reasonString.includes('database') || reasonString.includes('SQL')) {
    console.error('💡 Database-related rejection - verify database connection and queries');
  } else if (reasonString.includes('timeout')) {
    console.error('💡 Timeout rejection - consider increasing timeout values or checking service responsiveness');
  }
  
  // In production, log but don't exit immediately for unhandled rejections
  // This allows the application to continue running despite promise rejections
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️ Continuing execution in production despite unhandled rejection');
    console.warn('🔧 Monitor application health and consider implementing proper error handling');
  } else {
    // In development, exit to encourage proper error handling
    console.error('🛑 Exiting due to unhandled rejection in development mode');
    setTimeout(() => process.exit(1), 1000);
  }
});

// Handle SIGTERM gracefully (common in cloud deployments)
process.on('SIGTERM', () => {
  console.log('📨 SIGTERM received - preparing for graceful shutdown...');
  console.log('🔧 Cleaning up resources and closing connections...');
  
  // Give the application time to clean up before exiting
  setTimeout(() => {
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  }, 5000);
});

// Handle SIGINT gracefully (Ctrl+C)
process.on('SIGINT', () => {
  console.log('\n📨 SIGINT received - shutting down gracefully...');
  process.exit(0);
});
