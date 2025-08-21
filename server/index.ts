import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { subscriptionMonitor } from "./subscription-monitor";
import { setupVite, serveStatic, log } from "./vite";

// Environment variable validation
function validateEnvironment() {
  const requiredEnvVars = ['STRIPE_SECRET_KEY'];
  const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars);
    console.error('Please ensure all required secrets are configured in your deployment environment.');
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
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
    
    // Validate environment variables first
    validateEnvironment();
    
    console.log('📋 Registering routes and setting up server...');
    const server = await registerRoutes(app);
    console.log('✅ Routes registered successfully');

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

    // Setup Vite or static file serving
    console.log('⚙️ Setting up file serving...');
    const env = app.get("env") || process.env.NODE_ENV || "development";
    console.log(`Environment: ${env}`);
    
    if (env === "development") {
      console.log('🔧 Setting up Vite development server...');
      await setupVite(app, server);
      console.log('✅ Vite development server configured');
    } else {
      console.log('📁 Setting up static file serving for production...');
      serveStatic(app);
      console.log('✅ Static file serving configured');
    }

    // Start the server
    const port = parseInt(process.env.PORT || '5000', 10);
    console.log(`🌐 Starting server on port ${port}...`);
    
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      console.log('🎉 Application started successfully!');
      log(`serving on port ${port}`);
      console.log(`🔗 Application available at: http://0.0.0.0:${port}`);
      
      // Start subscription monitoring
      subscriptionMonitor.start();
    });

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
      name: error.name
    });
    
    // Provide specific guidance based on error type
    if (error.message.includes('Missing required environment variables')) {
      console.error('💡 Solution: Add the missing environment variables to your deployment configuration');
    } else if (error.message.includes('database')) {
      console.error('💡 Solution: Check your database connection and ensure DATABASE_URL is correct');
    } else if (error.message.includes('STRIPE')) {
      console.error('💡 Solution: Ensure STRIPE_SECRET_KEY is properly configured');
    } else {
      console.error('💡 Solution: Check the error details above and ensure all dependencies are properly installed');
    }
    
    console.error('🛑 Exiting application due to initialization failure');
    process.exit(1);
  }
})();
