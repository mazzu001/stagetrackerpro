import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

// Enhanced environment variable checking for deployment scenarios
if (!process.env.REPLIT_DOMAINS) {
  const isDeploymentTest = process.env.DEPLOYMENT_TEST === 'true';
  const isGracefulDegradation = process.env.GRACEFUL_DEGRADATION === 'true';
  
  if (isDeploymentTest || isGracefulDegradation) {
    console.warn('⚠️ REPLIT_DOMAINS not provided - using fallback for deployment test');
    // Set a fallback domain for deployment testing
    process.env.REPLIT_DOMAINS = process.env.REPL_SLUG || 'localhost:5000';
  } else {
    throw new Error("Environment variable REPLIT_DOMAINS not provided");
  }
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  try {
    // Try to use PostgreSQL session store
    const pgStore = connectPg(session);
    const sessionStore = new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: false,
      ttl: sessionTtl,
      tableName: "sessions",
    });
    
    const sessionSecret = process.env.SESSION_SECRET || 'fallback-session-secret-for-deployment-test';
    
    return session({
      secret: sessionSecret,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: sessionTtl,
      },
    });
  } catch (sessionError: any) {
    console.warn('⚠️ Failed to setup PostgreSQL session store:', sessionError.message);
    
    // Fallback to memory store for deployment testing
    if (process.env.DEPLOYMENT_TEST === 'true' || process.env.GRACEFUL_DEGRADATION === 'true') {
      console.log('🔧 Using memory session store as fallback');
      const MemoryStore = require('memorystore')(session);
      
      return session({
        secret: process.env.SESSION_SECRET || 'fallback-session-secret-for-deployment-test',
        store: new MemoryStore({
          checkPeriod: 86400000 // Prune expired entries every 24h
        }),
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: sessionTtl,
        },
      });
    }
    
    throw sessionError;
  }
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  try {
    app.set("trust proxy", 1);
    
    // Enhanced session setup with error handling
    try {
      app.use(getSession());
    } catch (sessionError: any) {
      console.error('❌ Session setup failed:', sessionError.message);
      if (process.env.DEPLOYMENT_TEST !== 'true' && process.env.GRACEFUL_DEGRADATION !== 'true') {
        throw sessionError;
      }
      console.log('🔧 Continuing without session store due to graceful degradation');
    }
    
    app.use(passport.initialize());
    app.use(passport.session());

    // Enhanced OIDC config with better error handling
    let config;
    try {
      config = await getOidcConfig();
    } catch (configError: any) {
      console.error('❌ Failed to get OIDC config:', configError.message);
      
      // For deployment scenarios, provide a fallback or skip auth setup
      if (process.env.DEPLOYMENT_TEST === 'true' || process.env.GRACEFUL_DEGRADATION === 'true') {
        console.log('🔧 Skipping OIDC setup for deployment test - auth will be disabled');
        return;
      }
      throw configError;
    }

    const verify: VerifyFunction = async (
      tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
      verified: passport.AuthenticateCallback
    ) => {
      try {
        const user = {};
        updateUserSession(user, tokens);
        await upsertUser(tokens.claims());
        verified(null, user);
      } catch (verifyError: any) {
        console.error('❌ Auth verification error:', verifyError.message);
        verified(verifyError, null);
      }
    };

    // Enhanced domain handling with better error checking
    const replitDomains = process.env.REPLIT_DOMAINS;
    if (!replitDomains) {
      throw new Error('REPLIT_DOMAINS environment variable is required');
    }

    const domains = replitDomains.split(",");
    let successfulStrategies = 0;

    for (const domain of domains) {
      try {
        const strategy = new Strategy(
          {
            name: `replitauth:${domain}`,
            config,
            scope: "openid email profile offline_access",
            callbackURL: `https://${domain}/api/callback`,
          },
          verify,
        );
        passport.use(strategy);
        successfulStrategies++;
        console.log(`✅ Auth strategy configured for domain: ${domain}`);
      } catch (strategyError: any) {
        console.error(`❌ Failed to setup auth strategy for domain ${domain}:`, strategyError.message);
        
        // Continue with other domains rather than failing completely
        if (process.env.GRACEFUL_DEGRADATION === 'true') {
          console.log('🔧 Continuing with other domains due to graceful degradation');
          continue;
        }
        throw strategyError;
      }
    }

    if (successfulStrategies === 0) {
      throw new Error('No authentication strategies were successfully configured');
    }

    console.log(`✅ Authentication setup completed with ${successfulStrategies}/${domains.length} domains`);
  } catch (setupError: any) {
    console.error('❌ Authentication setup failed:', {
      message: setupError.message,
      timestamp: new Date().toISOString()
    });
    
    // For deployment scenarios, provide guidance
    if (setupError.message.includes('REPLIT_DOMAINS')) {
      console.error('💡 Ensure REPLIT_DOMAINS environment variable is set with comma-separated domains');
    } else if (setupError.message.includes('OIDC')) {
      console.error('💡 Check OIDC configuration and ensure all required auth environment variables are set');
    } else if (setupError.message.includes('session')) {
      console.error('💡 Check database connectivity for session storage');
    }
    
    throw setupError;
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", async (req, res) => {
    try {
      const logoutConfig = await getOidcConfig();
      req.logout(() => {
        res.redirect(
          client.buildEndSessionUrl(logoutConfig, {
            client_id: process.env.REPL_ID!,
            post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
          }).href
        );
      });
    } catch (logoutError) {
      console.error('❌ Logout error:', logoutError);
      // Fallback: simple logout without OIDC redirect
      req.logout(() => {
        res.redirect('/');
      });
    }
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};