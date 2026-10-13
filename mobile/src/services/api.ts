/**
 * Pinko App API Client
 * Enforces: Strict Online-Only Contract, Idempotency, and Arabic Error States
 */

const BASE_URL = '/api';

export class ApiClient {
  private static userRole: string = 'owner';

  static setUserRole(role: string) {
    this.userRole = role;
  }

  static getUserRole() {
    return this.userRole;
  }

  static async request(endpoint: string, options: RequestInit = {}) {
    // 1. Strict Online Check
    if (!navigator.onLine) {
      throw new Error('لا يوجد اتصال بالإنترنت. لم يتم تسجيل العملية.');
    }

    const headers = {
      'Content-Type': 'application/json',
      'x-user-role': this.userRole,
      ...(options.headers || {})
    };

    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `خطأ في استجابة الخادم (${response.status})`);
      }

      return await response.json();
    } catch (err: any) {
      if (err.message && err.message.includes('Failed to fetch')) {
        throw new Error('لا يوجد اتصال بالإنترنت. لم يتم تسجيل العملية.');
      }
      throw err;
    }
  }

  static async getHealth() {
    return this.request('/health');
  }

  static async getLocations() {
    return this.request('/locations');
  }

  static async getProducts(locationId?: string) {
    const q = locationId ? `?locationId=${locationId}` : '';
    return this.request(`/products${q}`);
  }

  static async commitSale(salePayload: any, idempotencyKey: string) {
    return this.request('/sales', {
      method: 'POST',
      headers: {
        'idempotency-key': idempotencyKey
      },
      body: JSON.stringify({ ...salePayload, idempotencyKey })
    });
  }

  static async createTransfer(payload: any) {
    return this.request('/transfers', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  static async dispatchTransfer(transferId: string) {
    return this.request(`/transfers/${transferId}/dispatch`, {
      method: 'POST'
    });
  }

  static async receiveTransfer(transferId: string, receivedAllocations: any[]) {
    return this.request(`/transfers/${transferId}/receive`, {
      method: 'POST',
      body: JSON.stringify({ receivedAllocations })
    });
  }

  static async getCustomers() {
    return this.request('/customers');
  }

  static async collectCustomerDebt(customerId: string, amountPiastres: number, notes?: string) {
    return this.request('/customers/collect', {
      method: 'POST',
      body: JSON.stringify({ customerId, amountPiastres, notes })
    });
  }

  static async startVehicleRoute(notes?: string) {
    return this.request('/vehicle/start-route', {
      method: 'POST',
      body: JSON.stringify({ notes })
    });
  }

  static async closeVehicleRoute(sessionId: string, countedCashPiastres: number, notes?: string) {
    return this.request('/vehicle/close-route', {
      method: 'POST',
      body: JSON.stringify({ sessionId, countedCashPiastres, notes })
    });
  }

  static async getAuditLogs() {
    return this.request('/audit-logs');
  }
}
