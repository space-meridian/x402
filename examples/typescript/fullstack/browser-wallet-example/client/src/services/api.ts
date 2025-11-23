import axios from "axios";
import type { AxiosInstance } from "axios";
import type { WalletClient } from "viem";
import { withPaymentInterceptor } from "x402-axios";
import { ZKPassport } from "@zkpassport/sdk";
import qrcode from "qrcode";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
const zkPassport = new ZKPassport();

// Base axios instance without payment interceptor
const baseApiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// This will be dynamically set based on wallet connection
let apiClient: AxiosInstance = baseApiClient;

// Update the API client with a wallet
export async function updateApiClient(walletClient: WalletClient | null) {
  if (walletClient && walletClient.account) {
    const queryBuilder = await zkPassport.request({
      name: "ZKPassport",
      logo: "https://zkpassport.id/logo.png",
      purpose: "Prove you are 18+ years old",
      scope: "adult",
      devMode: true,
    });
    console.log('got query builder')
    const { url, onResult } = queryBuilder.gte("age", 18).done();
    await qrcode.toCanvas(document.getElementById('canvas'), url);
    onResult(({ verified, result }) => {
      console.log('on result')
      if (verified) {
        const isOver18 = result.age?.gte?.result;
        console.log("User is 18+ years old", isOver18);
      } else {
        console.log("Verification failed");
      }
    });

    // Create axios instance with x402 payment interceptor
    apiClient = withPaymentInterceptor(baseApiClient, walletClient as any, undefined, undefined, "KYC");
    console.log("💳 API client updated with wallet:", walletClient.account.address);
  } else {
    // No wallet connected - reset to base client
    apiClient = baseApiClient;
    console.log("⚠️ API client reset - no wallet connected");
  }
}

// API endpoints
export const api = {
  // Free endpoints
  getHealth: async () => {
    const response = await apiClient.get("/api/health");
    return response.data;
  },

  getPaymentOptions: async () => {
    const response = await apiClient.get("/api/payment-options");
    return response.data;
  },

  validateSession: async (sessionId: string) => {
    const response = await apiClient.get(`/api/session/${sessionId}`);
    return response.data;
  },

  getActiveSessions: async () => {
    const response = await apiClient.get("/api/sessions");
    return response.data;
  },

  // Paid endpoints
  purchase24HourSession: async () => {
    console.log("🔐 Purchasing 24-hour session access...");
    const response = await apiClient.post("/api/pay/session");
    console.log("✅ 24-hour session created:", response.data);
    return response.data;
  },

  purchaseOneTimeAccess: async () => {
    console.log("⚡ Purchasing one-time access...");
    const response = await apiClient.post("/api/pay/onetime");
    console.log("✅ One-time access granted:", response.data);
    return response.data;
  },
};

// Types for API responses
export interface PaymentOption {
  name: string;
  endpoint: string;
  price: string;
  description: string;
}

export interface Session {
  id: string;
  type: "24hour" | "onetime";
  createdAt: string;
  expiresAt: string;
  validFor?: string;
  remainingTime?: number;
}

export interface SessionValidation {
  valid: boolean;
  error?: string;
  session?: Session;
} 