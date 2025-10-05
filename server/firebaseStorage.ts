import { firestore } from './firebase';
import { type User, type UpsertUser } from "@shared/schema";

export class FirebaseUserStorage {
  private usersCollection = firestore.collection('users');

  constructor() {
    console.log('🔥 Firebase user storage initialized');
  }

  async getUser(id: string): Promise<User | undefined> {
    try {
      const doc = await this.usersCollection.doc(id).get();
      if (!doc.exists) return undefined;
      
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data?.createdAt?.toDate?.() || new Date(),
        updatedAt: data?.updatedAt?.toDate?.() || new Date(),
        subscriptionEndDate: data?.subscriptionEndDate?.toDate?.() || null,
      } as User;
    } catch (error) {
      console.error('Error getting user:', error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const snapshot = await this.usersCollection.where('email', '==', email).limit(1).get();
      if (snapshot.empty) return undefined;
      
      const doc = snapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data?.createdAt?.toDate?.() || new Date(),
        updatedAt: data?.updatedAt?.toDate?.() || new Date(),
        subscriptionEndDate: data?.subscriptionEndDate?.toDate?.() || null,
      } as User;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return undefined;
    }
  }

  async getUserByStripeCustomerId(customerId: string): Promise<User | undefined> {
    try {
      const snapshot = await this.usersCollection.where('stripeCustomerId', '==', customerId).limit(1).get();
      if (snapshot.empty) return undefined;
      
      const doc = snapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data?.createdAt?.toDate?.() || new Date(),
        updatedAt: data?.updatedAt?.toDate?.() || new Date(),
        subscriptionEndDate: data?.subscriptionEndDate?.toDate?.() || null,
      } as User;
    } catch (error) {
      console.error('Error getting user by Stripe customer ID:', error);
      return undefined;
    }
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    try {
      const docData = {
        ...userData,
        subscriptionStatus: userData.subscriptionStatus || 1,
        updatedAt: new Date(),
        createdAt: new Date(), // Will be overwritten if document exists
      };

      if (userData.id) {
        // Update existing user
        await this.usersCollection.doc(userData.id).set(docData, { merge: true });
        const user = await this.getUser(userData.id);
        if (!user) throw new Error('Failed to retrieve updated user');
        return user;
      } else {
        // Create new user
        const docRef = await this.usersCollection.add(docData);
        const user = await this.getUser(docRef.id);
        if (!user) throw new Error('Failed to retrieve created user');
        return user;
      }
    } catch (error) {
      console.error('Error upserting user:', error);
      throw error;
    }
  }

  async updateUserStripeInfo(id: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User | undefined> {
    try {
      await this.usersCollection.doc(id).update({
        stripeCustomerId,
        stripeSubscriptionId,
        subscriptionStatus: 2, // Premium active
        updatedAt: new Date(),
      });
      
      return await this.getUser(id);
    } catch (error) {
      console.error('Error updating user Stripe info:', error);
      return undefined;
    }
  }

  async updateUserSubscriptionStatus(id: string, status: string, endDate: number): Promise<User | undefined> {
    try {
      const endDateValue = new Date(endDate * 1000);
      
      await this.usersCollection.doc(id).update({
        subscriptionStatus: parseInt(status),
        subscriptionEndDate: endDateValue,
        updatedAt: new Date(),
      });
      
      return await this.getUser(id);
    } catch (error) {
      console.error('Error updating user subscription status:', error);
      return undefined;
    }
  }

  async getAllUsersWithSubscriptions(): Promise<User[]> {
    try {
      const snapshot = await this.usersCollection.where('stripeSubscriptionId', '!=', null).get();
      const users: User[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        users.push({
          id: doc.id,
          ...data,
          createdAt: data?.createdAt?.toDate?.() || new Date(),
          updatedAt: data?.updatedAt?.toDate?.() || new Date(),
          subscriptionEndDate: data?.subscriptionEndDate?.toDate?.() || null,
        } as User);
      });
      
      return users;
    } catch (error) {
      console.error('Error getting users with subscriptions:', error);
      return [];
    }
  }

  async updateUserSubscription(userId: string, data: { subscriptionStatus: number; subscriptionEndDate: string | null }): Promise<void> {
    try {
      const updateData: any = {
        subscriptionStatus: data.subscriptionStatus,
        updatedAt: new Date(),
      };
      
      if (data.subscriptionEndDate) {
        updateData.subscriptionEndDate = new Date(data.subscriptionEndDate);
      } else {
        updateData.subscriptionEndDate = null;
      }
      
      await this.usersCollection.doc(userId).update(updateData);
      console.log(`✅ Updated subscription for user ${userId}: status=${data.subscriptionStatus}`);
    } catch (error) {
      console.error(`❌ Error updating subscription for user ${userId}:`, error);
      throw error;
    }
  }

  async updateUserProfilePhoto(email: string, photoData: string): Promise<User | undefined> {
    try {
      const user = await this.getUserByEmail(email);
      if (!user) return undefined;
      
      await this.usersCollection.doc(user.id).update({
        profilePhoto: photoData,
        updatedAt: new Date(),
      });
      
      return await this.getUser(user.id);
    } catch (error) {
      console.error(`❌ Error updating profile photo for ${email}:`, error);
      throw error;
    }
  }

  async updateUserProfile(email: string, profileData: { firstName?: string; lastName?: string; phone?: string; customBroadcastId?: string }): Promise<User | undefined> {
    try {
      const user = await this.getUserByEmail(email);
      if (!user) return undefined;
      
      const updateData: any = {
        updatedAt: new Date(),
      };

      if (profileData.firstName !== undefined) updateData.firstName = profileData.firstName;
      if (profileData.lastName !== undefined) updateData.lastName = profileData.lastName;
      if (profileData.phone !== undefined) updateData.phone = profileData.phone;
      if (profileData.customBroadcastId !== undefined) updateData.customBroadcastId = profileData.customBroadcastId;

      await this.usersCollection.doc(user.id).update(updateData);
      
      return await this.getUser(user.id);
    } catch (error) {
      console.error(`❌ Error updating profile for ${email}:`, error);
      throw error;
    }
  }
}

export const firebaseUserStorage = new FirebaseUserStorage();