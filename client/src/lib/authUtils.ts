export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

export function isSubscriptionRequiredError(error: Error): boolean {
  return /^403: .*Subscription required/.test(error.message) || 
         /^403: .*Subscription expired/.test(error.message);
}