// Debug MIDI Event Flow Test
console.log('🎯 TESTING MIDI EVENT FLOW');

// Test 1: Check if event listeners are working
console.log('Test 1: Adding test event listener...');
window.addEventListener('sendBluetoothMIDI', (event) => {
  console.log('✅ sendBluetoothMIDI event received:', event.detail);
});

// Test 2: Dispatch a test event
console.log('Test 2: Dispatching test event...');
window.dispatchEvent(new CustomEvent('sendBluetoothMIDI', {
  detail: { command: '[[PC:5:1]]' }
}));

// Test 3: Check the Bluetooth manager's state
console.log('Test 3: Checking Bluetooth manager state...');
console.log('- Is performance page loaded?', !!document.querySelector('[data-testid="performance-page"]'));
console.log('- Is Bluetooth manager loaded?', !!document.querySelector('[data-testid="bluetooth-manager"]'));

// Test 4: Simulate manual MIDI send
setTimeout(() => {
  console.log('Test 4: Simulating manual send...');
  const event = new CustomEvent('sendBluetoothMIDI', {
    detail: { command: '[[PC:10:1]]' }
  });
  window.dispatchEvent(event);
}, 2000);

console.log('🎯 MIDI EVENT FLOW TESTS COMPLETED');