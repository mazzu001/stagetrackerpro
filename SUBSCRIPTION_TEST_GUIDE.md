# Subscription Testing Guide

## How to Test the Subscription Flow

### Current Test Users Available:

1. **Free User (Current)**
   - Email: `brooke@mnb.com`
   - Password: `demo123`
   - Subscription: Free (tier 1)
   - Features: Can see upgrade button, no unsubscribe option

2. **Premium User (Test)**
   - Email: `paid@test.com` 
   - Password: `test123`
   - Subscription: Premium (tier 2)
   - Features: Can see unsubscribe option, upgrade to professional

3. **Professional User (Test)**
   - Email: `pro@test.com`
   - Password: `test123`
   - Subscription: Professional (tier 3) 
   - Features: Can see unsubscribe option, no upgrade needed

### Testing Steps:

#### 1. Test Free User Experience
- Login as `brooke@mnb.com` / `demo123`
- Click settings gear icon
- Verify: Shows "Free User" status
- Verify: Shows purple gradient "Upgrade" button
- Verify: No "Unsubscribe" option in dropdown
- Click upgrade button to test subscription flow

#### 2. Test Premium User Experience  
- Login as `paid@test.com` / `test123`
- Click settings gear icon
- Verify: Shows "Paid User" status
- Verify: Shows "Upgrade to Pro" button
- Verify: Shows "Unsubscribe" option in dropdown
- Test unsubscribe flow with retention offers

#### 3. Test Professional User Experience
- Login as `pro@test.com` / `test123`
- Click settings gear icon  
- Verify: Shows "Professional User" status
- Verify: No upgrade button (already highest tier)
- Verify: Shows "Unsubscribe" option in dropdown
- Test unsubscribe flow

#### 4. Test Subscription Upgrade Flow
- As free user, click "Upgrade" button
- Should redirect to Stripe payment page
- Use test card: `4242 4242 4242 4242`
- Expiry: Any future date, CVC: Any 3 digits
- Complete payment and verify redirect back to app

#### 5. Test Unsubscribe Flow
- As paid user, click settings → "Unsubscribe"
- Test retention offers:
  - Pause subscription
  - 50% discount offer  
  - Downgrade to lower tier
- Complete cancellation and verify status updates

### Manual User Creation (if needed):

To create additional test users manually:

```sql
-- Create user in database
INSERT INTO users (id, email, first_name, last_name, subscription_status) 
VALUES ('test_user_id', 'test@example.com', 'Test', 'User', 2);

-- Update subscription status:
-- 1 = Free
-- 2 = Premium  
-- 3 = Professional
```

### API Testing:

```bash
# Verify subscription status
curl -X POST http://localhost:5000/api/verify-subscription \
  -H "Content-Type: application/json" \
  -d '{"email":"paid@test.com"}'

# Test cancellation
curl -X POST http://localhost:5000/api/cancel-subscription \
  -H "Content-Type: application/json" \
  -d '{"email":"paid@test.com","reasons":["too_expensive"],"feedback":"Testing"}'
```

This guide allows you to test all subscription features without needing real payments.