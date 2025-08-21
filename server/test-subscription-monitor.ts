// Manual test script for subscription monitoring
import { subscriptionMonitor } from "./subscription-monitor";

async function testSubscriptionMonitor() {
  console.log('🧪 Testing subscription monitor...');
  
  // Start the monitor (this will run immediately then every 24 hours)
  subscriptionMonitor.start();
  
  // Wait a bit to see the initial check
  setTimeout(() => {
    console.log('✅ Test completed - check logs above for subscription status updates');
    subscriptionMonitor.stop();
    process.exit(0);
  }, 3000);
}

// Run the test if this file is executed directly
if (require.main === module) {
  testSubscriptionMonitor();
}