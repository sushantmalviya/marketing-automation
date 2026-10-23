import type { UserRole } from "@/constants/roles";

export interface AuthUser {
  id: number;
  email: string;
  username?: string | null;
  first_name?: string;
  last_name?: string;
  mobile_no?: string | null;
  phone_no?: string | null;
  phone?: string | null;
  is_active: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
  last_login?: string | null;
  date_joined?: string;
  role: UserRole;
  organization_id?: string | null;
  organization_name?: string | null;
  rental_status?: string | null;
  wallet_balance?: string | null;
  subscription_start_date?: string | null;
  subscription_end_date?: string | null;
  subscription_expire_date?: string | null;
  subscription_expiry_date?: string | null;
  rent_start_date?: string | null;
  rent_end_date?: string | null;
  subscriptionStartDate?: string | null;
  subscriptionEndDate?: string | null;
  subscriptionExpireDate?: string | null;
  subscriptionExpiryDate?: string | null;
  subscription?: {
    start_date?: string | null;
    end_date?: string | null;
    expire_date?: string | null;
    rent_start_date?: string | null;
    rent_end_date?: string | null;
    rent_status?: string | null;
    [key: string]: any;
  } | null;
  organization?: {
    id?: string;
    name?: string;
    subscription?: {
      start_date?: string | null;
      end_date?: string | null;
      expire_date?: string | null;
      rent_start_date?: string | null;
      rent_end_date?: string | null;
      rent_status?: string | null;
      [key: string]: any;
    } | null;
    [key: string]: any;
  } | null;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: { access: string; refresh: string; user: AuthUser };
}

export interface Paginated<T> { count: number; next: string | null; previous: string | null; results: T[] }
