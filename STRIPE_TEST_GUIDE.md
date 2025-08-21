# Stripe Test Mode Guide

## Overview
StageTracker Pro is configured to run in Stripe TEST mode, which means **NO REAL CHARGES** will be made to your credit card. You can test the entire subscription flow safely.

## Test Credit Cards

### ✅ Successful Payments
- **4242 4242 4242 4242** - Visa (most common for testing)
- **5555 5555 5555 4444** - Mastercard
- **3782 822463 10005** - American Express

### ❌ Declined Payments
- **4000 0000 0000 0002** - Generic decline
- **4000 0000 0000 9995** - Insufficient funds
- **4000 0000 0000 9987** - Lost card

### 🔐 3D Secure Authentication
- **4000 0025 0000 3155** - Requires authentication
- **4000 0000 0000 3220** - 3D Secure 2 authentication

## Card Details for Testing
- **Expiry Date**: Use any future date (e.g., 12/25, 01/26, etc.)
- **CVC**: Use any 3-digit number (e.g., 123, 456, 789)
- **Postal Code**: Use any valid postal code (e.g., 90210, 10001)

## Test Scenarios

### 1. Successful Subscription
1. Use card: `4242 4242 4242 4242`
2. Complete payment
3. Verify subscription status shows "Premium"
4. Verify unlimited song creation works

### 2. Failed Payment
1. Use card: `4000 0000 0000 0002`
2. Payment should be declined
3. Verify subscription remains "Free"
4. Verify error message is displayed

### 3. Authentication Required
1. Use card: `4000 0025 0000 3155`
2. Complete additional authentication step
3. Verify subscription activates after authentication

## Verifying Test Mode

### Visual Indicators
- 🧪 "TEST MODE" banner on subscription page
- Test card numbers displayed prominently
- No real money amounts in Stripe dashboard

### Backend Logs
Check server console for:
```
💰 Creating Stripe subscription for email: test@example.com
✅ Subscription created: sub_test_xxxxx
```

### Stripe Dashboard
- Go to https://dashboard.stripe.com
- Ensure you're in "Test" mode (toggle in top-left)
- View test transactions under "Payments"

## Safety Guarantees
1. **No Real Charges**: Test mode transactions are completely separate from live transactions
2. **Test Data Only**: All customer data is marked as test data
3. **Reversible**: Test transactions can be deleted without consequence
4. **No Bank Communication**: Test payments never reach your actual bank

## Troubleshooting

### If You See Real Charges
If you accidentally see real charges:
1. Check if Stripe keys are in live mode
2. Contact Stripe support immediately
3. All test transactions should have "test" in the transaction ID

### Common Test Issues
- **Payment Failed**: Ensure you're using exact test card numbers
- **No Client Secret**: Check server logs for Stripe errors
- **Subscription Not Activated**: Verify webhook endpoints are working

## Production Deployment
When ready for production:
1. Replace test Stripe keys with live keys
2. Remove test mode indicators from UI
3. Test with small real amounts first
4. Set up production webhook endpoints